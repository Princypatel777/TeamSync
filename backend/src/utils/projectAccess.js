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

    const requestedGroupId = req.query.groupId || req.body.groupId;
    if (requestedGroupId && groupIds.some((gId) => String(gId) === String(requestedGroupId))) {
      const groupProject = await Project.findOne({ groupId: requestedGroupId });
      if (groupProject) return groupProject._id;
    }

    let project = await Project.findOne({ groupId: { $in: groupIds } }).sort({ updatedAt: -1 });
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

  // For Faculty (Guide / CC Faculty), they must request a specific projectId and we verify their assignment.
  if (['FACULTY'].includes(user.role)) {
    if (!requestedProjectId) return null;

    const project = await Project.findById(requestedProjectId);
    if (!project) return null;

    // Check if faculty is guide or co-guide of the group
    const group = await ProjectGroup.findOne({
      _id: project.groupId,
      $or: [
        { guideId: user._id },
        { coGuideId: user._id }
      ]
    });
    
    // Also check backward compatibility: faculty is legacy facultyGuideId on the project
    const isLegacyGuide = String(project.facultyGuideId) === String(user._id);

    if (!group && !isLegacyGuide) return null;
    return project._id;
  }

  return null;
};
