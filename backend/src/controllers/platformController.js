import User from '../models/User.js';
import ProjectGroup from '../models/ProjectGroup.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Bug from '../models/Bug.js';
import StudentMark from '../models/StudentMark.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import SystemConfig from '../models/SystemConfig.js';
import GithubIntegration from '../models/GithubIntegration.js';
import Department from '../models/Department.js';
import SGPCycle from '../models/SGPCycle.js';
import AcademicYear from '../models/AcademicYear.js';
import { notifyProjectMembers } from '../utils/notificationUtils.js';

// ================= INSTITUTIONAL ANALYTICS (FR-1701 & FR-1702) =================
export const getAnalyticsDashboard = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'STUDENT' });
    const totalFaculty = await User.countDocuments({ role: 'FACULTY' });
    const totalCoordinators = await User.countDocuments({ role: 'COORDINATOR' });
    const totalAdmins = await User.countDocuments({ role: 'ADMIN' });

    const totalDepartments = await Department.countDocuments({ isActive: true });
    const totalSgpCycles = await SGPCycle.countDocuments({ isActive: true });
    const totalAcademicYears = await AcademicYear.countDocuments({ isActive: true });

    const totalGroups = await ProjectGroup.countDocuments();
    const approvedProjects = await Project.countDocuments({ status: { $in: ['APPROVED', 'COMPLETED'] } });
    const pendingProposals = await Project.countDocuments({ status: 'PENDING_APPROVAL' });

    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'DONE' });
    const avgTaskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalBugs = await Bug.countDocuments();
    const resolvedBugs = await Bug.countDocuments({ status: { $in: ['FIXED', 'CLOSED'] } });
    const defectResolutionRate = totalBugs > 0 ? Math.round((resolvedBugs / totalBugs) * 100) : 100;

    // Grade Distribution
    const marks = await StudentMark.find();
    const gradeDistribution = {
      'A+': marks.filter((m) => m.grade === 'A+').length,
      A: marks.filter((m) => m.grade === 'A').length,
      'B+': marks.filter((m) => m.grade === 'B+').length,
      B: marks.filter((m) => m.grade === 'B').length,
      C: marks.filter((m) => m.grade === 'C').length,
      F: marks.filter((m) => m.grade === 'F').length,
    };

    res.status(200).json({
      success: true,
      kpis: {
        totalUsers,
        totalStudents,
        totalFaculty,
        totalCoordinators,
        totalAdmins,
        totalDepartments,
        totalSgpCycles,
        totalAcademicYears,
        totalGroups,
        approvedProjects,
        pendingProposals,
        totalTasks,
        completedTasks,
        avgTaskCompletionRate,
        totalBugs,
        resolvedBugs,
        defectResolutionRate,
        gradeDistribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ================= AUDIT LOGS (FR-1801) =================
export const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let logs = await AuditLog.find()
      .populate('actorId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (logs.length === 0) {
      // Seed default initial audit log
      logs = [
        await AuditLog.create({
          action: 'USER_LOGIN',
          actorName: 'System Admin',
          actorRole: 'ADMIN',
          targetEntity: 'Session',
          targetId: 'AUTH_001',
          ipAddress: '127.0.0.1',
        }),
      ];
    }

    const total = await AuditLog.countDocuments();

    res.status(200).json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total: total || 1,
        pages: Math.ceil((total || 1) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ================= NOTIFICATIONS (FR-1901) =================
export const getNotifications = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Auto-generate deadline notifications for tasks due tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.setHours(0,0,0,0));
    const tomorrowEnd = new Date(tomorrow.setHours(23,59,59,999));

    const tasksDueTomorrow = await Task.find({
       assigneeId: user._id,
       dueDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
       status: { $ne: 'DONE' }
    });

    for (const task of tasksDueTomorrow) {
       const exists = await Notification.findOne({
          userId: user._id,
          title: 'Deadline Tomorrow',
          message: { $regex: task.taskKey }
       });
       
       if (!exists) {
          await Notification.create({
             userId: user._id,
             title: 'Deadline Tomorrow',
             message: `You have a task due tomorrow:\n📋 [${task.taskKey}] ${task.title}\n⏰ Please make sure it is completed.`,
             type: 'TASK'
          });
       }
    }

    let notifications = await Notification.find({ userId: user._id }).sort({ createdAt: -1 });

    if (notifications.length === 0) {
      // Seed default welcome notification
      notifications = [
        await Notification.create({
          userId: user._id,
          title: 'Welcome to TeamSync',
          message: 'Your institutional account is active. Explore your dashboard to start collaborating!',
          type: 'SUCCESS',
        }),
      ];
    }

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.status(200).json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    res.status(200).json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

export const handleNotificationAction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' or 'REJECT'

    const notification = await Notification.findOne({ _id: id, userId: req.user._id });
    if (!notification || !notification.actionType) {
      return res.status(404).json({ success: false, message: 'Actionable notification not found.' });
    }
    
    if (notification.actionStatus !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Notification already processed.' });
    }

    if (notification.actionType === 'GITHUB_REPO_CHANGE') {
       const payload = notification.actionPayload || {};
       if (action === 'APPROVE') {
          if (payload.action === 'disconnect') {
            await GithubIntegration.findOneAndUpdate(
              { projectId: payload.projectId },
              { repoUrl: '', repoName: '', owner: '', isConnected: false, lastSyncedAt: null }
            );
            await Project.findByIdAndUpdate(payload.projectId, { githubRepositoryUrl: '' });
          } else {
            const cleaned = (payload.repoUrl || '').trim().replace(/\/+$/, '');
            const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i);
            const owner = match ? match[1] : '';
            const repoName = match ? match[2].replace(/\.git$/i, '') : cleaned.split('/').pop().replace('.git', '');
            const canonicalUrl = `https://github.com/${owner}/${repoName}`;

            await GithubIntegration.findOneAndUpdate(
              { projectId: payload.projectId },
              { repoUrl: canonicalUrl, repoName, owner, isConnected: true, lastSyncedAt: new Date() },
              { upsert: true }
            );
            await Project.findByIdAndUpdate(payload.projectId, { githubRepositoryUrl: canonicalUrl });
          }
          notification.actionStatus = 'APPROVED';
          notification.message += ' (Approved)';

          try {
            await notifyProjectMembers(
              payload.projectId,
              req.user,
              'GITHUB',
              'GitHub Request Approved',
              `Faculty guide ${req.user.name} approved the GitHub repository update.`
            );
          } catch (e) { /* non-fatal */ }
       } else {
          notification.actionStatus = 'REJECTED';
          notification.message += ' (Rejected)';

          try {
            await notifyProjectMembers(
              payload.projectId,
              req.user,
              'GITHUB',
              'GitHub Request Rejected',
              `Faculty guide ${req.user.name} rejected the GitHub repository update.`
            );
          } catch (e) { /* non-fatal */ }
       }
    }
    
    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

// ================= AI & PLATFORM SETTINGS (FR-1902) =================
export const getSystemConfigs = async (req, res, next) => {
  try {
    let configs = await SystemConfig.find();

    if (configs.length === 0) {
      configs = await SystemConfig.insertMany([
        { key: 'GEMINI_API_KEY', value: 'AIzaSy_CONFIGURED_PROD_KEY', description: 'Google Gemini Pro LLM API Key for recommendation engine' },
        { key: 'SIMILARITY_THRESHOLD_PERCENT', value: '35', description: 'Plagiarism / historical similarity flag threshold percentage' },
        { key: 'MAX_GROUP_SIZE', value: '4', description: 'Maximum allowed student group members per SGP cycle' },
      ]);
    }

    res.status(200).json({ success: true, configs });
  } catch (error) {
    next(error);
  }
};

export const updateSystemConfig = async (req, res, next) => {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, message: 'Config key and value are required.' });
    }

    const config = await SystemConfig.findOneAndUpdate(
      { key },
      { value, description: description || '' },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, config });
  } catch (error) {
    next(error);
  }
};
