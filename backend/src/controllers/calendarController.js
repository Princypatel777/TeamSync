import Task from '../models/Task.js';
import Bug from '../models/Bug.js';
import Milestone from '../models/Milestone.js';
import Review from '../models/Review.js';
import Release from '../models/Release.js';
import Feature from '../models/Feature.js';
import Sprint from '../models/Sprint.js';
import ProjectGroup from '../models/ProjectGroup.js';
import Project from '../models/Project.js';
import GroupMember from '../models/GroupMember.js';

// ================= AGGREGATED CALENDAR EVENTS =================

export const getCalendarEvents = async (req, res, next) => {
  try {
    const events = [];
    let userProjects = [];
    let targetProjectIds = [];

    const requestedProjectId = req.query.projectId;

    if (req.user.role === 'STUDENT') {
      // Find all groups the student belongs to
      const memberships = await GroupMember.find({
        userId: req.user._id,
        status: 'ACCEPTED',
      });
      const groupIds = memberships.map((m) => m.groupId);

      // Find all projects for these groups
      const projects = await Project.find({ groupId: { $in: groupIds } }).lean();
      userProjects = projects.map((p) => ({
        _id: p._id,
        title: p.title,
        projectKey: p.projectKey,
        groupId: p.groupId,
      }));

      if (requestedProjectId) {
        const found = projects.find((p) => String(p._id) === String(requestedProjectId));
        if (found) {
          targetProjectIds = [found._id];
        } else {
          targetProjectIds = [];
        }
      } else {
        targetProjectIds = projects.map((p) => p._id);
      }
    } else if (req.user.role === 'FACULTY') {
      const groups = await ProjectGroup.find({
        $or: [{ guideId: req.user._id }, { coGuideId: req.user._id }],
      });
      const groupIds = groups.map((g) => g._id);

      const legacyProjects = await Project.find({ facultyGuideId: req.user._id }).lean();
      const activeProjects = await Project.find({ groupId: { $in: groupIds } }).lean();

      const combined = [...activeProjects, ...legacyProjects];
      const seen = new Set();
      const uniqueProjects = [];
      for (const p of combined) {
        if (!seen.has(String(p._id))) {
          seen.add(String(p._id));
          uniqueProjects.push(p);
        }
      }

      userProjects = uniqueProjects.map((p) => ({
        _id: p._id,
        title: p.title,
        projectKey: p.projectKey,
        groupId: p.groupId,
      }));

      if (requestedProjectId) {
        const found = uniqueProjects.find((p) => String(p._id) === String(requestedProjectId));
        if (found) {
          targetProjectIds = [found._id];
        } else {
          targetProjectIds = [];
        }
      } else {
        targetProjectIds = uniqueProjects.map((p) => p._id);
      }
    } else if (['ADMIN', 'COORDINATOR'].includes(req.user.role)) {
      if (requestedProjectId) {
        const proj = await Project.findById(requestedProjectId).lean();
        if (proj) {
          targetProjectIds = [proj._id];
          userProjects = [{ _id: proj._id, title: proj.title, projectKey: proj.projectKey }];
        }
      } else {
        const allProj = await Project.find({}).limit(50).lean();
        userProjects = allProj.map((p) => ({
          _id: p._id,
          title: p.title,
          projectKey: p.projectKey,
        }));
      }
    }

    // Base filter for project-scoped items
    let baseFilter = null;
    if (requestedProjectId) {
      baseFilter = targetProjectIds.length > 0 ? { projectId: targetProjectIds[0] } : { projectId: null };
    } else if (targetProjectIds.length > 0) {
      baseFilter = { projectId: { $in: targetProjectIds } };
    } else if (req.user.role === 'ADMIN') {
      baseFilter = {};
    }

    // If student/faculty has baseFilter, fetch project items
    if (baseFilter) {
      // 1. Fetch Tasks (Blue)
      const tasks = await Task.find(baseFilter)
        .populate('assigneeId', 'name email')
        .populate('reporterId', 'name')
        .populate('projectId', 'title projectKey')
        .populate('featureId', 'title')
        .populate('sprintId', 'name');

      tasks.forEach((task) => {
        const deadline = task.dueDate || task.startDate || task.createdAt;
        if (deadline) {
          const prefix = task.projectId ? `[${task.projectId.projectKey || task.projectId.title}] ` : '';
          const isDone = task.status === 'DONE';
          events.push({
            id: `task-${task._id}`,
            title: `${prefix}${task.title}`,
            start: task.startDate || deadline,
            end: task.dueDate || task.startDate || deadline,
            dueDate: task.dueDate,
            startDate: task.startDate,
            dueTime: task.dueTime,
            startTime: task.startTime,
            type: 'TASK',
            color: '#3b82f6',
            responsible: task.assigneeId ? task.assigneeId.name : 'Unassigned',
            status: task.status,
            priority: task.priority || 'MEDIUM',
            isDone,
            details: {
              ...task.toObject(),
              assignee: task.assigneeId,
              reporter: task.reporterId,
              project: task.projectId,
              feature: task.featureId,
              sprint: task.sprintId,
            },
          });
        }
      });

      // 2. Fetch Milestones (Amber)
      const milestones = await Milestone.find(baseFilter).populate('projectId', 'title projectKey');
      milestones.forEach((milestone) => {
        const milestoneDeadline = milestone.targetDate || milestone.startDate;
        if (milestoneDeadline) {
          const prefix = milestone.projectId ? `[${milestone.projectId.projectKey || milestone.projectId.title}] ` : '';
          const isDone = milestone.status === 'COMPLETED';
          events.push({
            id: `milestone-${milestone._id}`,
            title: `${prefix}${milestone.title}`,
            start: milestone.startDate || milestoneDeadline,
            end: milestoneDeadline,
            dueDate: milestoneDeadline,
            startDate: milestone.startDate,
            type: 'MILESTONE',
            color: '#f59e0b',
            responsible: 'Team Milestone',
            status: milestone.status,
            progress: milestone.progressPercentage || 0,
            isDone,
            details: {
              ...milestone.toObject(),
              project: milestone.projectId,
              requirements: milestone.requirements || [],
            },
          });
        }
      });

      // 3. Fetch Features (Teal)
      const features = await Feature.find(baseFilter)
        .populate('createdBy', 'name')
        .populate('projectId', 'title projectKey');

      features.forEach((feature) => {
        const featureDeadline = feature.targetEndDate || feature.startDate;
        if (featureDeadline) {
          const prefix = feature.projectId ? `[${feature.projectId.projectKey || feature.projectId.title}] ` : '';
          const checklist = feature.checklistItems || [];
          const allCompleted = checklist.length > 0 && checklist.every((c) => c.isCompleted);
          const isDone = feature.status === 'DONE' || allCompleted;
          events.push({
            id: `feature-${feature._id}`,
            title: `${prefix}${feature.title}`,
            start: feature.startDate || featureDeadline,
            end: featureDeadline,
            dueDate: featureDeadline,
            startDate: feature.startDate,
            type: 'FEATURE',
            color: '#0d9488',
            responsible: feature.createdBy ? feature.createdBy.name : 'Team',
            status: feature.status,
            priority: feature.priority || 'MEDIUM',
            isDone,
            details: {
              ...feature.toObject(),
              project: feature.projectId,
              checklistItems: feature.checklistItems || [],
            },
          });
        }
      });

      // 4. Fetch Bugs (Red)
      const bugs = await Bug.find(baseFilter)
        .populate('assigneeId', 'name')
        .populate('projectId', 'title projectKey');

      bugs.forEach((bug) => {
        const deadline = bug.dueDate || bug.createdAt;
        if (deadline) {
          const prefix = bug.projectId ? `[${bug.projectId.projectKey || bug.projectId.title}] ` : '';
          const isDone = ['FIXED', 'CLOSED', 'RESOLVED'].includes(bug.status);
          events.push({
            id: `bug-${bug._id}`,
            title: `${prefix}${bug.title}`,
            start: bug.dueDate || bug.createdAt,
            end: bug.dueDate || bug.createdAt,
            dueDate: bug.dueDate,
            startDate: bug.createdAt,
            type: 'BUG',
            color: '#ef4444',
            responsible: bug.assigneeId ? bug.assigneeId.name : 'Unassigned',
            status: bug.status,
            priority: bug.priority || 'MEDIUM',
            isDone,
            details: {
              ...bug.toObject(),
              project: bug.projectId,
            },
          });
        }
      });

      // 5. Fetch Sprints (Indigo)
      const sprints = await Sprint.find(baseFilter).populate('projectId', 'title projectKey');
      sprints.forEach((sprint) => {
        if (sprint.startDate || sprint.endDate) {
          const prefix = sprint.projectId ? `[${sprint.projectId.projectKey || sprint.projectId.title}] ` : '';
          const isDone = sprint.status === 'COMPLETED';
          events.push({
            id: `sprint-${sprint._id}`,
            title: `${prefix}Sprint: ${sprint.name}`,
            start: sprint.startDate,
            end: sprint.endDate,
            dueDate: sprint.endDate,
            startDate: sprint.startDate,
            type: 'SPRINT',
            color: '#6366f1',
            responsible: 'Agile Team',
            status: sprint.status,
            isDone,
            details: {
              ...sprint.toObject(),
              project: sprint.projectId,
            },
          });
        }
      });

      // 6. Fetch Releases (Emerald)
      const releaseFilter = { ...baseFilter, status: { $ne: 'DRAFT' } };
      const releases = await Release.find(releaseFilter).populate('projectId', 'title projectKey');
      releases.forEach((release) => {
        if (release.releaseDate) {
          const prefix = release.projectId ? `[${release.projectId.projectKey || release.projectId.title}] ` : '';
          const isDone = release.status === 'RELEASED';
          events.push({
            id: `release-${release._id}`,
            title: `${prefix}${release.version} - ${release.title}`,
            start: release.releaseDate,
            end: release.releaseDate,
            dueDate: release.releaseDate,
            startDate: release.releaseDate,
            type: 'RELEASE',
            color: '#10b981',
            responsible: 'Release Team',
            status: release.status,
            isDone,
            details: {
              ...release.toObject(),
              project: release.projectId,
            },
          });
        }
      });
    }

    // 7. Fetch Reviews (Purple)
    // Reviews are department/academic schedule. Students and faculty can always see scheduled reviews!
    const reviewFilter = {};
    if (req.user.role === 'STUDENT') {
      reviewFilter.status = { $ne: 'DRAFT' };
    } else if (req.user.role === 'FACULTY') {
      reviewFilter.$or = [
        { facultyReviewers: req.user._id },
        { status: { $ne: 'DRAFT' } }
      ];
    }
    const reviews = await Review.find(reviewFilter)
      .populate('facultyReviewers', 'name email')
      .populate('assignedGroups', 'name');

    reviews.forEach((review) => {
      if (review.reviewDate) {
        const timeStr = review.startTime ? ` (${review.startTime}${review.endTime ? ' - ' + review.endTime : ''})` : '';
        const isDone = review.status === 'COMPLETED';
        events.push({
          id: `review-${review._id}`,
          title: `[Review] ${review.title}${timeStr}`,
          start: review.reviewDate,
          end: review.reviewDate,
          dueDate: review.reviewDate,
          startDate: review.reviewDate,
          type: 'REVIEW',
          color: '#8b5cf6',
          responsible: review.facultyReviewers?.length > 0
            ? review.facultyReviewers.map((f) => f.name).join(', ')
            : 'Department Panel',
          status: review.status,
          isDone,
          details: {
            ...review.toObject(),
            reviewers: review.facultyReviewers,
            assignedGroups: review.assignedGroups,
          },
        });
      }
    });

    res.status(200).json({
      success: true,
      events,
      projects: userProjects,
    });
  } catch (error) {
    next(error);
  }
};

