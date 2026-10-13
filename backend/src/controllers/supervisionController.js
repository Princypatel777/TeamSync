import GuidanceLog from '../models/GuidanceLog.js';
import PeerEvaluation from '../models/PeerEvaluation.js';
import Project from '../models/Project.js';
import GroupMember from '../models/GroupMember.js';
import Task from '../models/Task.js';
import Bug from '../models/Bug.js';

import { resolveAndVerifyProjectId } from '../utils/projectAccess.js';

// ================= FACULTY LOGBOOK (FR-1303) =================
export const getGuidanceLogs = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, logs: [] });

    const logs = await GuidanceLog.find({ projectId })
      .populate('facultyId', 'name email designation')
      .sort({ meetingDate: -1 });

    res.status(200).json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

export const createGuidanceLog = async (req, res, next) => {
  try {
    const facultyUser = req.user;
    const { projectId, topic, discussionSummary, actionableItems, rating, nextMeetingDate } = req.body;

    if (!projectId || !topic || !discussionSummary) {
      return res.status(400).json({ success: false, message: 'Project ID, topic, and discussion summary are required.' });
    }

    const logDoc = await GuidanceLog.create({
      projectId,
      facultyId: facultyUser._id,
      topic,
      discussionSummary,
      actionableItems: actionableItems || [],
      rating: rating || 4,
      nextMeetingDate: nextMeetingDate || null,
    });

    const populatedLog = await GuidanceLog.findById(logDoc._id).populate('facultyId', 'name email designation');

    res.status(201).json({ success: true, log: populatedLog });
  } catch (error) {
    next(error);
  }
};

// ================= FACULTY SUPERVISION DASHBOARD (FR-1301) =================
export const getFacultySupervisionSummary = async (req, res, next) => {
  try {
    const facultyUser = req.user;

    // Backward compatibility: Find projects where this faculty is the guide
    const legacyProjects = await Project.find({ facultyGuideId: facultyUser._id }).lean();
    const legacyGroupIds = legacyProjects.map(p => p.groupId).filter(Boolean);

    // Find all groups assigned to this faculty
    let groups = await ProjectGroup.find({
      $or: [
        { guideId: facultyUser._id },
        { coGuideId: facultyUser._id },
        { _id: { $in: legacyGroupIds } }
      ]
    })
      .populate('leaderId', 'name enrollmentNumber')
      .lean();

    // Strictly scope groups to authorized assignments only (no all-groups fallback)
    const summaries = await Promise.all(
      groups.map(async (group) => {
        // Find project for this group
        let proj = await Project.findOne({ groupId: group._id })
          .populate({
            path: 'groupId',
            populate: { path: 'leaderId', select: 'name enrollmentNumber' },
          })
          .lean();

        // If no project document exists yet, fallback to legacy project or group placeholder
        if (!proj) {
          proj = legacyProjects.find(p => String(p.groupId) === String(group._id));
        }

        if (!proj) {
          proj = {
            _id: group._id,
            title: `Group ${group.code}`,
            projectKey: group.code,
            domain: 'SGP Project',
            status: group.status || 'ACTIVE',
            groupId: group
          };
        } else if (!proj.groupId) {
          proj.groupId = group;
        }

        const totalTasks = proj._id ? await Task.countDocuments({ projectId: proj._id }) : 0;
        const doneTasks = proj._id ? await Task.countDocuments({ projectId: proj._id, status: 'DONE' }) : 0;
        const totalBugs = proj._id ? await Bug.countDocuments({ projectId: proj._id }) : 0;
        const openBugs = proj._id ? await Bug.countDocuments({ projectId: proj._id, status: { $in: ['OPEN', 'IN_PROGRESS'] } }) : 0;
        const logsCount = proj._id ? await GuidanceLog.countDocuments({ projectId: proj._id }) : 0;

        return {
          project: proj,
          metrics: {
            totalTasks,
            doneTasks,
            taskCompletionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
            totalBugs,
            openBugs,
            logsCount,
          },
        };
      })
    );

    res.status(200).json({ success: true, summaries });
  } catch (error) {
    next(error);
  }
};

// ================= PEER EVALUATIONS (FR-1401 & FR-1402) =================
export const getTeammatesForEval = async (req, res, next) => {
  try {
    const user = req.user;
    const requestedGroupId = req.query.groupId;
    const requestedProjectId = req.query.projectId;

    const memberships = await GroupMember.find({ userId: user._id, status: 'ACCEPTED' });
    if (!memberships || memberships.length === 0) return res.status(200).json({ success: true, teammates: [] });

    let targetGroupId;
    if (requestedGroupId) {
      const match = memberships.find((m) => String(m.groupId) === String(requestedGroupId));
      if (match) targetGroupId = match.groupId;
    } else if (requestedProjectId) {
      const proj = await Project.findById(requestedProjectId);
      if (proj && memberships.some((m) => String(m.groupId) === String(proj.groupId))) {
        targetGroupId = proj.groupId;
      }
    }
    if (!targetGroupId) {
      targetGroupId = memberships[0].groupId;
    }

    const allMembers = await GroupMember.find({
      groupId: targetGroupId,
      status: 'ACCEPTED',
    }).populate('userId', 'name enrollmentNumber email role');

    const teammates = allMembers
      .filter((m) => String(m.userId._id) !== String(user._id))
      .map((m) => m.userId);

    res.status(200).json({ success: true, teammates });
  } catch (error) {
    next(error);
  }
};

export const submitPeerEvaluation = async (req, res, next) => {
  try {
    const evaluator = req.user;
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project required.' });

    const { evaluateeId, contributionScore, teamworkScore, technicalScore, communicationScore, comments } = req.body;

    if (!evaluateeId) {
      return res.status(400).json({ success: false, message: 'Teammate ID is required.' });
    }

    const overallScore = Math.round(
      ((Number(contributionScore) + Number(teamworkScore) + Number(technicalScore) + Number(communicationScore)) / 4) * 10
    ) / 10;

    const evaluation = await PeerEvaluation.findOneAndUpdate(
      { projectId, evaluatorId: evaluator._id, evaluateeId },
      {
        contributionScore: Number(contributionScore),
        teamworkScore: Number(teamworkScore),
        technicalScore: Number(technicalScore),
        communicationScore: Number(communicationScore),
        overallScore,
        comments: comments || '',
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, evaluation });
  } catch (error) {
    next(error);
  }
};

export const getPeerEvaluations = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, evaluations: [] });

    const evaluations = await PeerEvaluation.find({ projectId })
      .populate('evaluateeId', 'name enrollmentNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, evaluations });
  } catch (error) {
    next(error);
  }
};
