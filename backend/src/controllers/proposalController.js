import Project from '../models/Project.js';
import GroupMember from '../models/GroupMember.js';
import ProjectGroup from '../models/ProjectGroup.js';
import ProposalFeedback from '../models/ProposalFeedback.js';
import StudentProfile from '../models/StudentProfile.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { generateProjectRecommendations, computeProjectSimilarity } from '../services/aiService.js';
import { logAuditEvent } from '../utils/auditLogger.js';

/**
 * @desc Get current student's group project proposal draft
 * @route GET /api/proposals/my-proposal
 */
export const getMyProposal = async (req, res, next) => {
  try {
    const user = req.user;

    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    }).populate('groupId');

    const validMemberships = memberships.filter((m) => m.groupId);

    if (validMemberships.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You must belong to a project group before drafting a proposal.',
      });
    }

    const requestedGroupId = req.query.groupId;
    let membership = validMemberships[0];
    if (requestedGroupId) {
      const match = validMemberships.find((m) => String(m.groupId._id) === String(requestedGroupId));
      if (match) membership = match;
    }

    const group = membership.groupId;
    let projects = await Project.find({ groupId: group._id })
      .populate('facultyGuideId', 'name email role')
      .populate('departmentId', 'name code')
      .sort({ createdAt: 1 });

    let project = projects[0];

    if (!project) {
      // Auto-create initial draft project for group
      const defaultKey = group.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .substring(0, 4);

      project = await Project.create({
        groupId: group._id,
        departmentId: group.departmentId || null,
        sgpCycleId: group.sgpCycleId || null,
        title: `${group.name} SGP Project`,
        projectKey: defaultKey || 'PROJ',
        status: 'DRAFT',
      });
      projects = [project];
    }

    // Fetch review feedback history for all projects of this group
    const feedbackHistory = await ProposalFeedback.find({ projectId: { $in: projects.map(p => p._id) } })
      .populate('facultyId', 'name email role')
      .sort({ createdAt: -1 });

    // Fetch members of this specific group
    const memberDocs = await GroupMember.find({
      groupId: group._id,
      status: 'ACCEPTED',
    }).populate('userId', 'name email enrollmentNumber');

    // Groups list for switching between student's groups
    const groupsList = validMemberships.map((m) => ({
      _id: m.groupId._id,
      id: m.groupId._id,
      name: m.groupId.name,
      code: m.groupId.code,
      userRole: m.role,
    }));

    res.status(200).json({
      success: true,
      project, // For backwards compatibility
      projects, // Array of up to 3 proposals for this group
      group,
      groups: groupsList, // All groups student belongs to
      members: memberDocs, // Members of this specific group
      userRoleInGroup: membership.role,
      feedbackHistory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Save/Update proposal draft
 * @route PUT /api/proposals/draft
 */
export const saveProposalDraft = async (req, res, next) => {
  try {
    const user = req.user;
    const { title, description, domain, techStack, problemStatement, objectives, scope, expectedOutcome, innovation, githubRepositoryUrl } = req.body;

    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!memberships || memberships.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You do not belong to an active group.',
      });
    }

    const groupIds = memberships.map((m) => m.groupId);

    // Get specific project or the first active one
    const projectId = req.query.projectId || req.body.projectId;
    let project;
    if (projectId) {
      project = await Project.findOne({ _id: projectId, groupId: { $in: groupIds } });
    } else {
      project = await Project.findOne({ groupId: { $in: groupIds }, isArchived: false });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project draft not found.',
      });
    }

    if (project.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Approved proposals cannot be modified.',
      });
    }

    if (project.status === 'SUBMITTED' || project.status === 'UNDER_REVIEW') {
      return res.status(400).json({
        success: false,
        message: 'Proposal is currently under review and cannot be edited until feedback is received.',
      });
    }

    // Auto-generate project key
    const projectKey = (title || 'PROJ')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .substring(0, 5) || 'PROJ';

    project.title = title || project.title;
    project.projectKey = projectKey;
    project.description = description !== undefined ? description : project.description;
    project.domain = domain || project.domain;
    project.techStack = Array.isArray(techStack) ? techStack : project.techStack;
    project.problemStatement = problemStatement !== undefined ? problemStatement : project.problemStatement;
    project.objectives = Array.isArray(objectives) ? objectives : project.objectives;
    project.scope = scope !== undefined ? scope : project.scope;
    project.expectedOutcome = expectedOutcome !== undefined ? expectedOutcome : project.expectedOutcome;
    project.innovation = innovation !== undefined ? innovation : project.innovation;
    if (githubRepositoryUrl !== undefined) project.githubRepositoryUrl = githubRepositoryUrl;

    await project.save();

    await logAuditEvent({
      actor: user,
      action: 'PROPOSAL_DRAFT_UPDATED',
      targetEntity: 'Project',
      targetId: project._id,
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Proposal draft saved successfully.',
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create a new proposal slot for the group (max 3)
 * @route POST /api/proposals/create
 */
export const createNewProposal = async (req, res, next) => {
  try {
    const user = req.user;
    const requestedGroupId = req.body.groupId || req.query.groupId;

    let membership;
    if (requestedGroupId) {
      membership = await GroupMember.findOne({
        userId: user._id,
        groupId: requestedGroupId,
        status: 'ACCEPTED',
      }).populate('groupId');
    } else {
      membership = await GroupMember.findOne({
        userId: user._id,
        status: 'ACCEPTED',
      }).populate('groupId');
    }

    if (!membership || !membership.groupId) {
      return res.status(400).json({ success: false, message: 'You must belong to a group.' });
    }

    if (membership.role !== 'LEADER') {
      return res.status(403).json({ success: false, message: 'Only the group leader can create a new proposal.' });
    }

    const group = membership.groupId;
    
    // Count non-archived projects (max 3 active proposals per group)
    const activeProjectsCount = await Project.countDocuments({ groupId: group._id, isArchived: false, status: { $ne: 'REJECTED' } });
    if (activeProjectsCount >= 3) {
      return res.status(400).json({ success: false, message: 'You have reached the maximum limit of 3 active proposals.' });
    }

    const defaultKey = group.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .substring(0, 4);

    const project = await Project.create({
      groupId: group._id,
      departmentId: group.departmentId || null,
      sgpCycleId: group.sgpCycleId || null,
      title: `${group.name} SGP Project (Option ${activeProjectsCount + 1})`,
      projectKey: defaultKey || 'PROJ',
      status: 'DRAFT',
    });

    res.status(201).json({
      success: true,
      message: 'New proposal draft created successfully.',
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get AI Recommendations tailored to group skills & interests
 * @route POST /api/proposals/ai-recommendations
 */
export const getAiRecommendations = async (req, res, next) => {
  try {
    const user = req.user;
    const { domain, projectId, groupId } = req.body;

    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!memberships || memberships.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You must belong to a group to request AI recommendations.',
      });
    }

    let targetGroupId = groupId;
    if (!targetGroupId && projectId) {
      const p = await Project.findById(projectId);
      if (p) targetGroupId = p.groupId;
    }
    if (!targetGroupId) {
      targetGroupId = memberships[0].groupId;
    }

    const isMember = memberships.some((m) => String(m.groupId) === String(targetGroupId));
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied to this project group.' });
    }

    // Fetch skills & interests of all accepted group members
    const groupMembers = await GroupMember.find({ groupId: targetGroupId, status: 'ACCEPTED' });
    const memberUserIds = groupMembers.map((m) => m.userId);

    const profiles = await StudentProfile.find({ userId: { $in: memberUserIds } });

    const combinedSkills = [...new Set(profiles.flatMap((p) => p.skills || []))];
    const combinedInterests = [...new Set(profiles.flatMap((p) => p.interests || []))];

    const result = await generateProjectRecommendations(combinedSkills, combinedInterests, domain);

    res.status(200).json({
      success: true,
      isAiLive: result.isAiLive,
      recommendations: result.recommendations,
      combinedSkills,
      combinedInterests,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Run AI similarity & plagiarism check against DB projects
 * @route POST /api/proposals/similarity-check
 */
export const runSimilarityCheck = async (req, res, next) => {
  try {
    const user = req.user;

    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!memberships || memberships.length === 0) {
      return res.status(400).json({ success: false, message: 'You must belong to a group.' });
    }

    const groupIds = memberships.map((m) => m.groupId);

    const projectId = req.query.projectId || req.body.projectId;
    let project;
    if (projectId) {
      project = await Project.findOne({ _id: projectId, groupId: { $in: groupIds } });
    } else {
      project = await Project.findOne({ groupId: { $in: groupIds }, isArchived: false });
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Draft project not found.' });
    }

    const similarityReport = await computeProjectSimilarity(project, project._id);

    // Save similarity results to project
    project.similarityScore = similarityReport.similarityScore;
    project.similarProjects = similarityReport.similarProjects;
    await project.save();

    await logAuditEvent({
      actor: user,
      action: 'PROPOSAL_SIMILARITY_CHECKED',
      targetEntity: 'Project',
      targetId: project._id,
      details: { similarityScore: similarityReport.similarityScore },
      req,
    });

    res.status(200).json({
      success: true,
      similarityReport,
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Submit proposal for faculty review
 * @route POST /api/proposals/submit
 */
export const submitProposal = async (req, res, next) => {
  try {
    const user = req.user;

    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!memberships || memberships.length === 0) {
      return res.status(400).json({ success: false, message: 'You must belong to a group.' });
    }

    const groupIds = memberships.map((m) => m.groupId);

    const projectId = req.query.projectId || req.body.projectId;
    let project;
    if (projectId) {
      project = await Project.findOne({ _id: projectId, groupId: { $in: groupIds } });
    } else {
      project = await Project.findOne({ groupId: { $in: groupIds }, isArchived: false });
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project draft not found.' });
    }

    const projectMembership = memberships.find((m) => String(m.groupId) === String(project.groupId));
    if (!projectMembership || projectMembership.role !== 'LEADER') {
      return res.status(403).json({
        success: false,
        message: 'Only the group leader can submit the final proposal.',
      });
    }

    // Validation checks
    if (!project.title || project.title.length < 5) {
      return res.status(400).json({ success: false, message: 'Project title must be at least 5 characters long.' });
    }
    if (!project.problemStatement || project.problemStatement.length < 15) {
      return res.status(400).json({ success: false, message: 'Problem statement must be detailed (at least 15 characters).' });
    }
    if (!project.techStack || project.techStack.length === 0) {
      return res.status(400).json({ success: false, message: 'Please specify at least 1 technology in your tech stack.' });
    }

    if (project.submissionCount >= 3 && project.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'You have reached the maximum of 3 proposal submissions.' });
    }

    // Attempt automated similarity check gracefully without blocking proposal submission
    try {
      const similarityReport = await computeProjectSimilarity(project, project._id);
      project.similarityScore = similarityReport.similarityScore || 0;
      project.similarProjects = similarityReport.similarProjects || [];
      project.aiStatus = similarityReport.isHighRisk ? 'HIGH_SIMILARITY_FLAGGED' : 'SIMILARITY_CHECK_COMPLETED';
    } catch (aiErr) {
      console.warn('[AI Service Warning]: Similarity check failed during submission, preserving proposal data:', aiErr.message);
      project.similarityScore = 0;
      project.similarProjects = [];
      project.aiStatus = 'SIMILARITY_CHECK_FAILED';
    }

    const nextStatus = project.status === 'REVISION_REQUIRED' ? 'RESUBMITTED' : 'SUBMITTED';
    project.status = nextStatus;
    project.submissionCount = (project.submissionCount || 0) + 1;

    project.statusHistory.push({
      status: nextStatus,
      changedBy: user._id,
      timestamp: new Date(),
      feedback: 'Proposal submitted by group leader for faculty review.',
    });

    await project.save();

    await logAuditEvent({
      actor: user,
      action: 'PROPOSAL_SUBMITTED',
      targetEntity: 'Project',
      targetId: project._id,
      details: { title: project.title, similarityScore: project.similarityScore },
      req,
    });

    // Notify assigned faculty guide if one is allocated
    if (project.facultyGuideId) {
      await Notification.create({
        userId: project.facultyGuideId,
        title: 'Project Proposal Submitted',
        message: `Group leader ${user.name} submitted proposal "${project.title}" for your review.`,
        type: 'PROPOSAL',
        linkUrl: '/faculty/proposals',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Proposal successfully submitted for faculty guide review!',
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Faculty / Coordinator Review Proposal (Approve, Request Revision, Reject)
 * @route POST /api/proposals/:id/review
 */
export const reviewProposal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, feedback } = req.body;
    const user = req.user;

    const project = await Project.findById(id).populate('groupId');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project proposal not found.' });
    }

    // Role check: Faculty can only review proposals assigned to them, or unassigned proposals
    if (user.role === 'FACULTY') {
      if (project.facultyGuideId && String(project.facultyGuideId) !== String(user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not the assigned faculty guide for this project proposal.',
        });
      }
    }

    if (!['APPROVE', 'REQUEST_REVISION', 'REJECT', 'APPROVE_EDIT_REQUEST'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid review action.' });
    }

    if (['REQUEST_REVISION', 'REJECT'].includes(action) && (!feedback || !feedback.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Feedback comments are mandatory when requesting revision or rejecting a proposal.',
      });
    }

    let newStatus = 'UNDER_REVIEW';
    if (action === 'APPROVE') {
      newStatus = 'APPROVED';
    }
    if (action === 'REQUEST_REVISION') newStatus = 'REVISION_REQUIRED';
    if (action === 'REJECT') {
      newStatus = 'REJECTED';
      // Give the student a chance back if rejected
      project.submissionCount = Math.max(0, (project.submissionCount || 0) - 1);
    }
    if (action === 'APPROVE_EDIT_REQUEST') {
      newStatus = 'CHANGE_APPROVED';
      
      // Find the pending change request and approve it
      const pendingRequest = project.changeRequests.find(cr => cr.status === 'PENDING');
      if (pendingRequest) {
        pendingRequest.status = 'APPROVED';
        project.unlockedFields = pendingRequest.fields;
      } else {
        project.unlockedFields = ['title', 'domain', 'techStack', 'problemStatement', 'objectives', 'scope', 'expectedOutcome', 'innovation'];
      }
    }

    project.status = newStatus;
    
    // Auto-assign faculty reviewer as guide if not assigned yet
    if (!project.facultyGuideId) {
      project.facultyGuideId = user._id;
    }

    project.statusHistory.push({
      status: newStatus,
      changedBy: user._id,
      timestamp: new Date(),
      feedback: feedback || `Proposal ${newStatus.toLowerCase()} by faculty guide.`,
    });

    await project.save();

    // Log feedback
    await ProposalFeedback.create({
      projectId: project._id,
      facultyId: user._id,
      action,
      feedback: feedback || `Proposal marked as ${newStatus}.`,
    });

    await logAuditEvent({
      actor: user,
      action: `PROPOSAL_${action}`,
      targetEntity: 'Project',
      targetId: project._id,
      details: { action, feedback },
      req,
    });

    // Notify all accepted student group members
    const groupMembers = await GroupMember.find({ groupId: project.groupId, status: 'ACCEPTED' });
    const statusLabels = {
      APPROVE: 'Approved',
      REQUEST_REVISION: 'Changes Requested',
      REJECT: 'Rejected',
      APPROVE_EDIT_REQUEST: 'Edit Request Approved',
    };
    const notifTitle = `Proposal ${statusLabels[action] || action}`;
    const notifMsg = `Dr./Prof. ${user.name} has marked your project proposal "${project.title}" as ${statusLabels[action] || action}.${feedback ? ` Feedback: "${feedback}"` : ''}`;
    for (const member of groupMembers) {
      await Notification.create({
        userId: member.userId,
        title: notifTitle,
        message: notifMsg,
        type: 'PROPOSAL',
        linkUrl: '/student/proposal',
      });
    }

    res.status(200).json({
      success: true,
      message: `Proposal ${action.toLowerCase().replace('_', ' ')}d successfully.`,
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get assigned proposals for Faculty / Coordinator
 * @route GET /api/proposals/assigned
 */
export const getAssignedProposals = async (req, res, next) => {
  try {
    const user = req.user;
    const { status, search } = req.query;

    const query = {};

    if (user.role === 'FACULTY') {
      // Allow faculty to see proposals assigned to them, OR unassigned proposals (so they can review/adopt them)
      query.$or = [
        { facultyGuideId: user._id },
        { facultyGuideId: null, status: 'SUBMITTED' },
        { facultyGuideId: null, status: 'RESUBMITTED' }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ title: regex }, { domain: regex }, { projectKey: regex }];
    }

    const proposals = await Project.find(query)
      .populate({
        path: 'groupId',
        populate: { path: 'leaderId', select: 'name enrollmentNumber email' },
      })
      .populate('facultyGuideId', 'name email')
      .populate('departmentId', 'name code')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      proposals,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Assign Faculty Guide to Project / Group
 * @route POST /api/proposals/:id/assign-guide
 */
export const assignFacultyGuide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { facultyGuideId } = req.body;
    const user = req.user;

    // Handle unassigning guide if facultyGuideId is null / empty
    if (!facultyGuideId) {
      let project = await Project.findById(id);
      if (project) {
        project.facultyGuideId = null;
        await project.save();
        if (project.groupId) {
          await ProjectGroup.findByIdAndUpdate(project.groupId, { guideId: null });
        }
      } else {
        const group = await ProjectGroup.findById(id);
        if (group) {
          group.guideId = null;
          await group.save();
          await Project.updateMany({ groupId: group._id }, { facultyGuideId: null });
        } else {
          return res.status(404).json({ success: false, message: 'Project or Group not found.' });
        }
      }

      await logAuditEvent({
        actor: user,
        action: 'FACULTY_GUIDE_UNASSIGNED',
        targetEntity: 'Project',
        targetId: id,
        req,
      });

      return res.status(200).json({
        success: true,
        message: 'Faculty guide assignment removed successfully.',
      });
    }

    const faculty = await User.findOne({ _id: facultyGuideId, role: { $in: ['FACULTY', 'COORDINATOR'] } });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty guide account not found.' });
    }

    let project = await Project.findById(id);
    let group;

    if (project) {
      project.facultyGuideId = facultyGuideId;
      await project.save();
      project = await Project.findById(id).populate('facultyGuideId', 'name email role');
      if (project.groupId) {
        await ProjectGroup.findByIdAndUpdate(project.groupId, { guideId: facultyGuideId });
        group = await ProjectGroup.findById(project.groupId);
      }
    } else {
      group = await ProjectGroup.findById(id);
      if (group) {
        group.guideId = facultyGuideId;
        await group.save();
        await Project.updateMany({ groupId: group._id }, { facultyGuideId });
      } else {
        return res.status(404).json({ success: false, message: 'Project or Group not found.' });
      }
    }

    // Notify assigned faculty and group students
    const groupName = group?.name || project?.title || 'Project Group';
    await Notification.create({
      userId: faculty._id,
      title: 'New SGP Group Assigned',
      message: `You have been assigned as the faculty guide for "${groupName}".`,
      type: 'SUPERVISION',
      linkUrl: `/faculty/projects`,
    });

    if (group) {
      const groupMembers = await GroupMember.find({ groupId: group._id, status: 'ACCEPTED' });
      for (const m of groupMembers) {
        await Notification.create({
          userId: m.userId,
          title: 'Faculty Guide Assigned',
          message: `Dr./Prof. ${faculty.name} has been assigned as your project guide.`,
          type: 'SUPERVISION',
          linkUrl: '/student/group',
        });
      }
    }

    await logAuditEvent({
      actor: user,
      action: 'FACULTY_GUIDE_ASSIGNED',
      targetEntity: 'Project',
      targetId: id,
      details: { facultyGuideId, facultyName: faculty.name },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Assigned Dr./Prof. ${faculty.name} as Faculty Guide.`,
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Request Edit for Approved Proposal
 * @route POST /api/proposals/request-edit
 */
export const requestEdit = async (req, res, next) => {
  try {
    const user = req.user;
    const { reason, fields, projectId } = req.body;

    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!memberships || memberships.length === 0) {
      return res.status(400).json({ success: false, message: 'You must belong to a group.' });
    }

    const groupIds = memberships.map((m) => m.groupId);

    let project;
    if (projectId) {
      project = await Project.findOne({ _id: projectId, groupId: { $in: groupIds } });
    } else {
      project = await Project.findOne({ groupId: { $in: groupIds }, status: 'APPROVED' });
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project draft not found.' });
    }

    if (project.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Only approved proposals can request an edit.' });
    }

    project.status = 'CHANGE_REQUESTED';
    
    project.changeRequests.push({
      fields: Array.isArray(fields) ? fields : [],
      reason: reason || 'Student requested to change specific fields.',
      status: 'PENDING'
    });

    project.statusHistory.push({
      status: 'CHANGE_REQUESTED',
      changedBy: user._id,
      timestamp: new Date(),
      feedback: reason || 'Student requested to edit the approved proposal.',
    });

    await project.save();

    await logAuditEvent({
      actor: user,
      action: 'PROPOSAL_EDIT_REQUESTED',
      targetEntity: 'Project',
      targetId: project._id,
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Edit request sent to faculty guide successfully.',
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Withdraw a submitted proposal back to draft for editing
 * @route POST /api/proposals/withdraw
 */
export const withdrawProposal = async (req, res, next) => {
  try {
    const user = req.user;
    const { projectId } = req.body;

    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!memberships || memberships.length === 0) {
      return res.status(400).json({ success: false, message: 'You must belong to a group.' });
    }

    const groupIds = memberships.map((m) => m.groupId);

    let project;
    if (projectId) {
      project = await Project.findOne({ _id: projectId, groupId: { $in: groupIds } });
    } else {
      project = await Project.findOne({ groupId: { $in: groupIds }, status: { $in: ['SUBMITTED', 'RESUBMITTED'] } });
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Proposal not found.' });
    }

    const projectMembership = memberships.find((m) => String(m.groupId) === String(project.groupId));
    if (!projectMembership || projectMembership.role !== 'LEADER') {
      return res.status(403).json({ success: false, message: 'Only the group leader can withdraw a proposal.' });
    }

    if (!['SUBMITTED', 'RESUBMITTED'].includes(project.status)) {
      return res.status(400).json({ success: false, message: `Only submitted proposals can be withdrawn (current status: ${project.status}).` });
    }

    project.status = 'DRAFT';
    project.statusHistory.push({
      status: 'DRAFT',
      changedBy: user._id,
      timestamp: new Date(),
      feedback: 'Proposal withdrawn back to draft by group leader.',
    });

    await project.save();

    await logAuditEvent({
      actor: user,
      action: 'PROPOSAL_WITHDRAWN',
      targetEntity: 'Project',
      targetId: project._id,
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Proposal withdrawn to draft. You can now edit and resubmit.',
      project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete a project proposal (Leader for DRAFT, Admin/Coordinator for any)
 * @route DELETE /api/proposals/:id
 */
export const deleteProposal = async (req, res, next) => {
  try {
    const proposalId = req.params.id;
    const project = await Project.findById(proposalId);
    
    if (!project) {
      return res.status(404).json({ success: false, detail: 'Proposal not found' });
    }

    if (req.user.role === 'STUDENT') {
      const membership = await GroupMember.findOne({
        userId: req.user._id,
        groupId: project.groupId,
        status: 'ACCEPTED',
      });
      if (!membership || membership.role !== 'LEADER') {
        return res.status(403).json({ success: false, message: 'Only group leaders can delete group proposals.' });
      }
      if (project.status !== 'DRAFT') {
        return res.status(400).json({ success: false, message: 'Only draft proposals can be deleted.' });
      }
    }

    await Project.findByIdAndDelete(proposalId);

    res.status(200).json({ success: true, message: 'Project proposal deleted successfully' });
  } catch (error) {
    next(error);
  }
};

