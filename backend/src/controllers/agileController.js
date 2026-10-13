import Requirement from '../models/Requirement.js';
import Feature from '../models/Feature.js';
import Sprint from '../models/Sprint.js';
import Task from '../models/Task.js';
import Bug from '../models/Bug.js';
import Project from '../models/Project.js';
import GroupMember from '../models/GroupMember.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { notifyProjectMembers } from '../utils/notificationUtils.js';

import { resolveAndVerifyProjectId } from '../utils/projectAccess.js';

// ================= REQUIREMENTS (FR-701) =================
export const getRequirements = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, requirements: [] });

    const requirements = await Requirement.find({ projectId })
      .populate('createdBy', 'name enrollmentNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, requirements });
  } catch (error) {
    next(error);
  }
};

export const createRequirement = async (req, res, next) => {
  try {
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project group required.' });

    const { title, description, priority, type, status, linkedFeatures } = req.body;
    
    // Determine Code prefix based on type
    const prefix = type === 'FUNCTIONAL' ? 'FR-' : 'NFR-';
    const count = await Requirement.countDocuments({ projectId, type });
    const code = `${prefix}${String(count + 1).padStart(3, '0')}`;

    const reqDoc = await Requirement.create({
      projectId,
      code,
      title,
      description,
      type: type || 'FUNCTIONAL',
      priority: priority || 'MEDIUM',
      status: status || 'PLANNED',
      linkedFeatures: linkedFeatures || [],
      createdBy: user._id,
    });

    res.status(201).json({ success: true, requirement: reqDoc });
  } catch (error) {
    next(error);
  }
};

// ================= EPICS (FR-702) =================
export const updateRequirement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const requirement = await Requirement.findOneAndUpdate(
      { _id: id, projectId },
      { $set: req.body },
      { new: true }
    );

    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found or unauthorized.' });
    }

    res.status(200).json({ success: true, requirement });
  } catch (error) {
    next(error);
  }
};

export const deleteRequirement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const requirement = await Requirement.findOne({ _id: id, projectId });
    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found or unauthorized.' });
    }

    const linkedFeaturesCount = await Feature.countDocuments({ requirementId: id });
    // The prompt says "Do not delete related Features or Tasks automatically. Only remove the relationship/link"
    // However, the relationship is kept in Requirement.linkedFeatures, not Feature.requirementId usually.
    // Wait, the Requirement model has `linkedFeatures: [ObjectId]`. So no need to check Feature documents unless they hold a back-reference.

    await Requirement.deleteOne({ _id: id });
    res.status(200).json({ success: true, message: 'Requirement deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ================= FEATURES =================
export const getFeatures = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, features: [] });

    // Fetch features
    const features = await Feature.find({ projectId }).populate('createdBy', 'name').sort({ createdAt: -1 }).lean();
    
    // Calculate progress for each feature
    const featuresWithStats = features.map((f) => {
      const checklist = f.checklistItems || [];
      const totalItems = checklist.length;
      const completedItems = checklist.filter(t => t.isCompleted).length;
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      
      return {
        ...f,
        totalItems,
        completedItems,
        progress
      };
    });

    res.status(200).json({ success: true, features: featuresWithStats });
  } catch (error) {
    next(error);
  }
};

export const createFeature = async (req, res, next) => {
  try {
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project group required.' });

    const { title, description, priority, startDate, targetEndDate } = req.body;
    const feature = await Feature.create({
      projectId,
      title,
      description: description || '',
      priority: priority || 'MEDIUM',
      startDate: startDate || null,
      targetEndDate: targetEndDate || null,
      createdBy: user._id,
      status: 'TO_DO'
    });

    await notifyProjectMembers(projectId, req.user, 'FEATURE', 'New Feature Added', `${req.user.name} created a new feature: "${feature.title}"`);

    res.status(201).json({ success: true, feature });
  } catch (error) {
    next(error);
  }
};

export const updateFeature = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    let updateData = { ...req.body };
    
    // Auto status
    if (updateData.checklistItems && updateData.checklistItems.length > 0) {
      const allDone = updateData.checklistItems.every(i => i.isCompleted);
      if (allDone) updateData.status = 'DONE';
      else if (updateData.status === 'DONE') updateData.status = 'IN_PROGRESS';
    }

    const feature = await Feature.findOneAndUpdate(
      { _id: id, projectId },
      { $set: updateData },
      { new: true }
    );

    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found or unauthorized.' });
    }

    await notifyProjectMembers(projectId, req.user, 'FEATURE', 'Feature Updated', `${req.user.name} updated the feature: "${feature.title}"`);

    res.status(200).json({ success: true, feature });
  } catch (error) {
    next(error);
  }
};

export const deleteFeature = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const feature = await Feature.findOne({ _id: id, projectId });
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found or unauthorized.' });
    }

    const linkedTasks = await Task.countDocuments({ featureId: id });
    if (linkedTasks > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete feature. It is linked to ${linkedTasks} task(s).` 
      });
    }

    await Feature.deleteOne({ _id: id });
    res.status(200).json({ success: true, message: 'Feature deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ================= SPRINTS (FR-801) =================
export const getSprints = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, sprints: [] });

    const sprints = await Sprint.find({ projectId }).sort({ startDate: -1 });
    res.status(200).json({ success: true, sprints });
  } catch (error) {
    next(error);
  }
};

export const createSprint = async (req, res, next) => {
  try {
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project group required.' });

    const { name, goal, startDate, endDate } = req.body;
    const sprint = await Sprint.create({
      projectId,
      name,
      goal,
      startDate,
      endDate,
    });

    res.status(201).json({ success: true, sprint });
  } catch (error) {
    next(error);
  }
};

export const updateSprint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const sprint = await Sprint.findOneAndUpdate(
      { _id: id, projectId },
      { $set: req.body },
      { new: true }
    );

    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found or unauthorized.' });
    }

    res.status(200).json({ success: true, sprint });
  } catch (error) {
    next(error);
  }
};

export const updateSprintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    if (!['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid sprint status.' });
    }

    if (status === 'ACTIVE') {
      const activeSprintCount = await Sprint.countDocuments({ projectId, status: 'ACTIVE' });
      if (activeSprintCount > 0) {
        return res.status(400).json({ success: false, message: 'Another sprint is already active. Complete it first.' });
      }
    }

    const sprint = await Sprint.findOneAndUpdate(
      { _id: id, projectId },
      { status },
      { new: true }
    );

    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found or unauthorized.' });
    }

    res.status(200).json({ success: true, sprint });
  } catch (error) {
    next(error);
  }
};

export const deleteSprint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const sprint = await Sprint.findOneAndDelete({ _id: id, projectId });
    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found or unauthorized.' });
    }

    // Move tasks from deleted sprint back to backlog
    await Task.updateMany({ sprintId: id }, { $set: { sprintId: null } });

    res.status(200).json({ success: true, message: 'Sprint deleted successfully. Associated tasks moved to backlog.' });
  } catch (error) {
    next(error);
  }
};

// ================= TASKS & KANBAN (FR-901, FR-902 & FR-802) =================
export const getTasks = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, tasks: [] });

    const { sprintId, status } = req.query;
    const query = { projectId };

    if (sprintId) query.sprintId = sprintId;
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .populate('assigneeId', 'name enrollmentNumber email')
      .populate('featureId', 'title status')
      .populate('sprintId', 'name')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, tasks });
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req, res, next) => {
  try {
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project group required.' });

    const project = await Project.findById(projectId);
    const keyPrefix = project?.projectKey || 'PROJ';

    const lastTask = await Task.findOne({ projectId }).sort({ taskNumber: -1 });
    const taskNumber = (lastTask?.taskNumber || 0) + 1;
    const taskKey = `${keyPrefix}-${String(taskNumber).padStart(3, '0')}`;

    const { title, description, featureId, sprintId, checklistItemId, assigneeId, priority, storyPoints, labels, startDate, startTime, dueDate, dueTime, isCalendarEventOnly } = req.body;

    const task = await Task.create({
      projectId,
      taskKey,
      taskNumber,
      title,
      description,
      featureId: featureId || null,
      sprintId: sprintId || null,
      checklistItemId: checklistItemId || null,
      assigneeId: assigneeId || user._id,
      reporterId: user._id,
      priority: priority || 'MEDIUM',
      status: 'TO_DO',
      storyPoints: storyPoints || 1,
      labels: labels || [],
      startDate: startDate || null,
      startTime: startTime || '',
      dueDate: dueDate || null,
      dueTime: dueTime || '',
      isCalendarEventOnly: isCalendarEventOnly || false,
    });

    await notifyProjectMembers(
      projectId,
      user,
      'TASK',
      'New Task Created',
      `${user.name} created a new task: "${title}"`
    );

    res.status(201).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

const syncChecklistItemStatus = async (task) => {
  if (!task.featureId || !task.checklistItemId) return;
  const feature = await Feature.findById(task.featureId);
  if (!feature) return;

  const itemIndex = feature.checklistItems.findIndex(i => String(i._id) === String(task.checklistItemId));
  if (itemIndex > -1) {
    const isDone = task.status === 'DONE';
    if (feature.checklistItems[itemIndex].isCompleted !== isDone) {
      feature.checklistItems[itemIndex].isCompleted = isDone;
      
      // Auto-update feature status if all items are done
      const allDone = feature.checklistItems.every(i => i.isCompleted);
      if (allDone) feature.status = 'DONE';
      else if (feature.status === 'DONE') feature.status = 'IN_PROGRESS';
      
      await feature.save();
    }
  }
};

export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const task = await Task.findByIdAndUpdate(id, updateData, { new: true });
    
    if (task) {
      const projectId = await resolveAndVerifyProjectId(req);
      await notifyProjectMembers(
        projectId,
        req.user,
        'TASK',
        'Task Updated',
        `${req.user.name} updated the task: "${task.title}"`
      );
      await syncChecklistItemStatus(task);
    }

    res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

export const updateTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['TO_DO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const oldTask = await Task.findById(id);
    if (!oldTask) return res.status(404).json({ success: false, message: 'Task not found' });
    const oldStatus = oldTask.status;

    const task = await Task.findByIdAndUpdate(id, { status }, { new: true });
    
    if (task && oldStatus !== status) {
      const projectId = await resolveAndVerifyProjectId(req);
      await notifyProjectMembers(
        projectId, 
        req.user, 
        'TASK', 
        'Task Status Changed', 
        `${req.user.name} moved task "${task.title}" from ${oldStatus.replace('_', ' ')} to ${status.replace('_', ' ')}`
      );
      await syncChecklistItemStatus(task);
    }

    res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const task = await Task.findOneAndDelete({ _id: id, projectId });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found or unauthorized.' });
    }

    await notifyProjectMembers(
      projectId,
      user,
      'TASK',
      'Task Deleted',
      `${user.name} deleted task: "${task.title}"`
    );

    res.status(200).json({ success: true, message: 'Task deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ================= BUGS (FR-903) =================
export const getBugs = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, bugs: [] });

    const bugs = await Bug.find({ projectId })
      .populate('assigneeId', 'name enrollmentNumber')
      .populate('reporterId', 'name enrollmentNumber')
      .populate('featureId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, bugs });
  } catch (error) {
    next(error);
  }
};

export const createBug = async (req, res, next) => {
  try {
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project group required.' });

    const project = await Project.findById(projectId);
    const keyPrefix = project?.projectKey || 'PROJ';

    const count = await Bug.countDocuments({ projectId });
    const bugKey = `${keyPrefix}-BUG-${String(count + 1).padStart(3, '0')}`;

    const { title, description, featureId, assigneeId, priority, dueDate, attachmentUrl } = req.body;

    const bug = await Bug.create({
      projectId,
      bugKey,
      title,
      description,
      priority: priority || 'MEDIUM',
      status: req.body.status || 'OPEN',
      featureId: featureId || null,
      assigneeId: assigneeId ? assigneeId : null,
      reporterId: user._id,
      dueDate: dueDate || null,
      attachmentUrl: attachmentUrl || '',
    });

    await notifyProjectMembers(projectId, req.user, 'BUG', 'New Bug Logged', `${req.user.name} logged a bug: "${bug.title}"`);

    res.status(201).json({ success: true, bug });
  } catch (error) {
    next(error);
  }
};

export const updateBugStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['OPEN', 'IN_PROGRESS', 'FIXED', 'CLOSED', 'REOPENED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid bug status.' });
    }

    const oldBug = await Bug.findById(id);
    if (!oldBug) return res.status(404).json({ success: false, message: 'Bug not found' });
    const oldStatus = oldBug.status;

    const bug = await Bug.findByIdAndUpdate(id, { status }, { new: true });
    
    if (bug && oldStatus !== status) {
      const projectId = await resolveAndVerifyProjectId(req);
      await notifyProjectMembers(
        projectId, 
        req.user, 
        'BUG', 
        'Bug Status Changed', 
        `${req.user.name} moved bug "${bug.title}" from ${oldStatus.replace('_', ' ')} to ${status.replace('_', ' ')}`
      );
    }
    
    res.status(200).json({ success: true, bug });
  } catch (error) {
    next(error);
  }
};

export const updateBug = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const payload = { ...req.body };
    if (payload.assigneeId === '') payload.assigneeId = null;

    const bug = await Bug.findOneAndUpdate(
      { _id: id, projectId },
      { $set: payload },
      { new: true }
    );

    if (!bug) {
      return res.status(404).json({ success: false, message: 'Bug not found or unauthorized.' });
    }

    await notifyProjectMembers(projectId, req.user, 'BUG', 'Bug Updated', `${req.user.name} updated the bug: "${bug.title}"`);

    res.status(200).json({ success: true, bug });
  } catch (error) {
    next(error);
  }
};

export const deleteBug = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const bug = await Bug.findOneAndDelete({ _id: id, projectId });
    if (!bug) {
      return res.status(404).json({ success: false, message: 'Bug not found or unauthorized.' });
    }

    await notifyProjectMembers(projectId, req.user, 'BUG', 'Bug Deleted', `${req.user.name} deleted the bug: "${bug.title}"`);

    res.status(200).json({ success: true, message: 'Bug deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ================= TRACEABILITY MATRIX (FR-706) =================
export const getTraceabilityChain = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, chain: [] });

    const requirements = await Requirement.find({ projectId }).populate('linkedFeatures', 'title status').lean();
    const features = await Feature.find({ projectId }).lean();
    const tasks = await Task.find({ projectId }).lean();
    const bugs = await Bug.find({ projectId }).lean();

    const chain = requirements.map((reqDoc) => {
      // Features linked to this requirement
      const linkedFeatureIds = reqDoc.linkedFeatures ? reqDoc.linkedFeatures.map(f => String(f._id || f)) : [];
      const linkedFeatures = features.filter(f => linkedFeatureIds.includes(String(f._id)));

      // Tasks linked to any of these features
      const linkedTasks = tasks.filter(t => linkedFeatureIds.includes(String(t.featureId)));

      // Bugs linked to these tasks or features
      const linkedTaskIds = linkedTasks.map(t => String(t._id));
      const linkedBugs = bugs.filter(b => 
        linkedFeatureIds.includes(String(b.featureId)) || 
        (b.taskId && linkedTaskIds.includes(String(b.taskId))) ||
        (b.requirementId && String(b.requirementId) === String(reqDoc._id))
      );

      return {
        requirement: reqDoc,
        features: linkedFeatures,
        tasks: linkedTasks,
        bugs: linkedBugs,
      };
    });

    res.status(200).json({ success: true, chain });
  } catch (error) {
    next(error);
  }
};
