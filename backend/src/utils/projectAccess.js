import GroupMember from '../models/GroupMember.js';
import Project from '../models/Project.js';
import ProjectGroup from '../models/ProjectGroup.js';

export const resolveAndVerifyProjectId = async (req) => {
  const requestedProjectId = req.query.projectId || req.body.projectId;
  const user = req.user;

  // For Admin and Coordinator, they must explicitly provide a projectId. If they do, they have access.
  if (['ADMIN', 'COORDINATOR'].includes(user.role)) {
    return requestedProjectId || null;
  }

  // For Students, they get access to projects of any group they belong to.
  if (user.role === 'STUDENT') {
    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    });
    if (!memberships || memberships.length === 0) return null;

    const groupIds = memberships.map((m) => m.groupId);

    if (requestedProjectId) {
      const specificProject = await Project.findOne({ _id: requestedProjectId, groupId: { $in: groupIds } });
      if (specificProject) return specificProject._id;
    }

    const requestedGroupId = req.query.groupId || req.body.groupId || req.params?.groupId;
    if (requestedGroupId && groupIds.some((gId) => String(gId) === String(requestedGroupId))) {
      let groupProject = await Project.findOne({ groupId: requestedGroupId, status: { $in: ['APPROVED', 'DEVELOPMENT_ACTIVE'] } });
      if (!groupProject) groupProject = await Project.findOne({ groupId: requestedGroupId, status: { $ne: 'REJECTED' } }).sort({ updatedAt: -1 });
      if (!groupProject) groupProject = await Project.findOne({ groupId: requestedGroupId }).sort({ updatedAt: -1 });
      if (groupProject) return groupProject._id;
    }

    // Prioritize approved/active project for this student group over rejected proposals
    let project = await Project.findOne({ groupId: { $in: groupIds }, status: { $in: ['APPROVED', 'DEVELOPMENT_ACTIVE'] } });
    if (!project) {
      project = await Project.findOne({ groupId: { $in: groupIds }, status: { $ne: 'REJECTED' } }).sort({ updatedAt: -1 });
    }
    if (!project) {
      project = await Project.findOne({ groupId: { $in: groupIds } }).sort({ updatedAt: -1 });
    }

    if (!project) {
      const group = await ProjectGroup.findById(groupIds[0]);
      if (group) {
        const defaultKey = (group.name || 'PROJ')
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .substring(0, 4) || 'PROJ';

        project = await Project.create({
          groupId: group._id,
          departmentId: group.departmentId || null,
          sgpCycleId: group.sgpCycleId || null,
          title: `${group.name} SGP Project`,
          projectKey: defaultKey,
          status: 'DRAFT',
        });
      }
    }
    if (!project) return null;
    return project._id;
  }

  // For Faculty (Guide / CC Faculty)
  if (['FACULTY'].includes(user.role)) {
    if (requestedProjectId) {
      const project = await Project.findById(requestedProjectId);
      if (project) {
        const group = await ProjectGroup.findOne({
          _id: project.groupId,
          $or: [
            { guideId: user._id },
            { coGuideId: user._id }
          ]
        });
        const isLegacyGuide = String(project.facultyGuideId) === String(user._id);
        if (group || isLegacyGuide) return project._id;
      }
    }

    const requestedGroupId = req.query.groupId || req.body.groupId || req.params?.groupId;
    if (requestedGroupId) {
      const group = await ProjectGroup.findOne({
        _id: requestedGroupId,
        $or: [
          { guideId: user._id },
          { coGuideId: user._id }
        ]
      });
      const legacyProject = await Project.findOne({ groupId: requestedGroupId, facultyGuideId: user._id });

      if (group || legacyProject) {
        let p = await Project.findOne({ groupId: requestedGroupId, status: { $in: ['APPROVED', 'DEVELOPMENT_ACTIVE'] } });
        if (!p) p = await Project.findOne({ groupId: requestedGroupId, status: { $ne: 'REJECTED' } }).sort({ updatedAt: -1 });
        if (!p) p = await Project.findOne({ groupId: requestedGroupId }).sort({ updatedAt: -1 });
        if (p) return p._id;
      }
    }

    // Default to first guided group's project if available
    const guidedGroup = await ProjectGroup.findOne({
      $or: [
        { guideId: user._id },
        { coGuideId: user._id }
      ]
    });
    if (guidedGroup) {
      let p = await Project.findOne({ groupId: guidedGroup._id, status: { $in: ['APPROVED', 'DEVELOPMENT_ACTIVE'] } });
      if (!p) p = await Project.findOne({ groupId: guidedGroup._id, status: { $ne: 'REJECTED' } }).sort({ updatedAt: -1 });
      if (p) return p._id;
    }

    return null;
  }

  return null;
};
