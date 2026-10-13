import StudentProfile from '../models/StudentProfile.js';
import User from '../models/User.js';
import GroupMember from '../models/GroupMember.js';
import ProjectGroup from '../models/ProjectGroup.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Notification from '../models/Notification.js';
import { z } from 'zod';

const updateProfileSchema = z.object({
  skills: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  bio: z.string().optional(),
  preferredRoles: z.array(z.string()).optional(),
  githubUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
});

export const getStudentDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Check group memberships
    const memberships = await GroupMember.find({ userId, status: 'ACCEPTED' }).populate('groupId');
    const validMemberships = memberships.filter((m) => m.groupId);

    if (validMemberships.length === 0) {
      // New student without a group
      const unreadNotifications = await Notification.countDocuments({ recipientId: userId, isRead: false });

      return res.status(200).json({
        success: true,
        hasGroup: false,
        group: null,
        groups: [],
        project: null,
        tasks: { pending: 0, inProgress: 0, dueSoon: 0 },
        notificationsCount: unreadNotifications,
        progress: null,
        deadlines: [],
        activity: [
          { id: 1, text: 'Welcome to TeamSync! Form or join a group in My Group tab to get started.', type: 'comment', time: 'Just now' }
        ]
      });
    }

    const requestedGroupId = req.query.groupId;
    let membership = validMemberships[0];
    if (requestedGroupId) {
      const match = validMemberships.find((m) => String(m.groupId._id) === String(requestedGroupId));
      if (match) membership = match;
    }

    // Fetch Group
    const group = await ProjectGroup.findById(membership.groupId._id).populate('leaderId', 'name enrollmentNumber');
    const membersCount = await GroupMember.countDocuments({ groupId: group._id, status: 'ACCEPTED' });

    // Fetch Active Project
    const project = await Project.findOne({ groupId: group._id });

    let tasksSummary = { pending: 0, inProgress: 0, dueSoon: 0 };
    let projectProgress = { overall: 0, features: 0, tasks: 0, milestones: 0 };
    let deadlines = [];

    if (project) {
      const myTasks = await Task.find({ projectId: project._id, assigneeId: userId });
      const pending = myTasks.filter(t => t.status === 'TODO').length;
      const inProgress = myTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
      const done = myTasks.filter(t => t.status === 'DONE').length;

      const totalTasks = myTasks.length;
      const taskProgressPercentage = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;

      tasksSummary = {
        pending,
        inProgress,
        dueSoon: myTasks.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(Date.now() + 86400000 * 2)).length
      };

      projectProgress = {
        overall: taskProgressPercentage,
        features: 0,
        tasks: taskProgressPercentage,
        milestones: 0
      };

      deadlines = myTasks.slice(0, 3).map((t, idx) => ({
        id: t._id || idx,
        type: 'TASK',
        title: t.title,
        due: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No date',
        urgency: t.priority === 'HIGH' ? 'high' : 'medium'
      }));
    }

    const unreadNotifications = await Notification.countDocuments({ recipientId: userId, isRead: false });

    const groupsList = validMemberships.map((m) => ({
      _id: m.groupId._id,
      id: m.groupId._id,
      name: m.groupId.name,
      code: m.groupId.code,
      userRole: m.role,
    }));

    res.status(200).json({
      success: true,
      hasGroup: true,
      group: {
        _id: group._id,
        name: group.name,
        code: group.code,
        status: group.status,
        membersCount
      },
      groups: groupsList,
      project: project ? {
        _id: project._id,
        title: project.title,
        status: project.status
      } : null,
      tasks: tasksSummary,
      notificationsCount: unreadNotifications,
      progress: projectProgress,
      deadlines,
      activity: [
        { id: 1, text: `Active in group ${group.name || group.code}`, type: 'feature', time: 'Recently' }
      ]
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentProfile = async (req, res, next) => {
  try {
    const user = req.user;
    let profile = await StudentProfile.findOne({ userId: user._id }).populate('departmentId', 'name code');

    if (!profile) {
      profile = await StudentProfile.create({
        userId: user._id,
        enrollmentNumber: user.enrollmentNumber || 'UNKNOWN',
      });
    }

    res.status(200).json({
      success: true,
      user: user.toJSON(),
      profile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudentProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const validated = updateProfileSchema.parse(req.body);

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: user._id },
      {
        ...(validated.skills && { skills: validated.skills }),
        ...(validated.interests && { interests: validated.interests }),
        ...(validated.bio !== undefined && { bio: validated.bio }),
        ...(validated.preferredRoles && { preferredRoles: validated.preferredRoles }),
        ...(validated.githubUrl !== undefined && { githubUrl: validated.githubUrl }),
        ...(validated.linkedinUrl !== undefined && { linkedinUrl: validated.linkedinUrl }),
        ...(validated.portfolioUrl !== undefined && { portfolioUrl: validated.portfolioUrl }),
      },
      { new: true, upsert: true }
    ).populate('departmentId', 'name code');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      profile,
    });
  } catch (error) {
    next(error);
  }
};
