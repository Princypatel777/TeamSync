import mongoose from 'mongoose';
import ProjectGroup from '../models/ProjectGroup.js';
import GroupMember from '../models/GroupMember.js';
import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import SystemConfig from '../models/SystemConfig.js';
import Notification from '../models/Notification.js';
import { createGroupSchema, inviteMemberSchema, respondInviteSchema } from '../validators/groupValidator.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const getMaxGroupSize = async () => {
  try {
    const cfg = (await SystemConfig.findOne({ key: 'MAX_GROUP_SIZE' })) || (await SystemConfig.findOne({ key: 'MAX_TEAM_SIZE' }));
    if (cfg && cfg.value) {
      const val = parseInt(cfg.value, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch (err) {
    // fallback
  }
  return 4;
};

/**
 * @desc Create a new project group
 * @route POST /api/groups
 */
export const createGroup = async (req, res, next) => {
  try {
    const user = req.user;
    const validated = createGroupSchema.parse(req.body);



    // Auto-generate group code e.g. GRP-2026-X8A2
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const groupCode = `GRP-${new Date().getFullYear()}-${randomCode}`;

    const group = await ProjectGroup.create({
      name: validated.name,
      code: groupCode,
      leaderId: user._id,
      sgpCycleId: validated.sgpCycleId || null,
      departmentId: validated.departmentId || null,
      status: 'FORMING',
    });

    // Add leader as accepted member
    const leaderMember = await GroupMember.create({
      groupId: group._id,
      userId: user._id,
      role: 'LEADER',
      status: 'ACCEPTED',
    });

    await logAuditEvent({
      actor: user,
      action: 'GROUP_CREATED',
      targetEntity: 'ProjectGroup',
      targetId: group._id,
      details: { name: group.name, code: group.code },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully.',
      group,
      membership: leaderMember,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Join an existing group using Group Code (e.g. GRP-2026-X639)
 * @route POST /api/groups/join-by-code
 */
export const joinGroupByCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    const user = req.user;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Group Code is required.',
      });
    }

    const trimmedCode = code.trim().toUpperCase();



    const group = await ProjectGroup.findOne({ code: trimmedCode });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: `No project group found with code '${trimmedCode}'.`,
      });
    }

    if (group.status === 'LOCKED' || group.status === 'DISBANDED') {
      return res.status(400).json({
        success: false,
        message: `Group '${group.name}' is ${group.status.toLowerCase()} and not accepting new members.`,
      });
    }

    // Check max group size limit set by Admin
    const currentMembersCount = await GroupMember.countDocuments({
      groupId: group._id,
      status: 'ACCEPTED',
    });
    const maxGroupSize = await getMaxGroupSize();
    if (currentMembersCount >= maxGroupSize) {
      return res.status(400).json({
        success: false,
        message: `Cannot join group: Group '${group.name}' has already reached the maximum allowed limit of ${maxGroupSize} members set by the administrator.`,
      });
    }

    // Check if already a member or invited
    let membership = await GroupMember.findOne({
      groupId: group._id,
      userId: user._id,
    });

    if (membership) {
      if (membership.status === 'ACCEPTED') {
        return res.status(400).json({
          success: false,
          message: 'You are already a member of this group.',
        });
      }
      membership.status = 'ACCEPTED';
      await membership.save();
    } else {
      membership = await GroupMember.create({
        groupId: group._id,
        userId: user._id,
        role: 'MEMBER',
        status: 'ACCEPTED',
      });
    }



    await logAuditEvent({
      actor: user,
      action: 'GROUP_JOINED_BY_CODE',
      targetEntity: 'ProjectGroup',
      targetId: group._id,
      details: { code: group.code },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Successfully joined group '${group.name}' (${group.code})!`,
      group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get current student's group details and members
 * @route GET /api/groups/my-group
 */
export const getMyGroup = async (req, res, next) => {
  try {
    const user = req.user;

    const memberships = await GroupMember.find({
      userId: user._id,
      status: 'ACCEPTED',
    }).populate('groupId');

    const validMemberships = memberships.filter((m) => m.groupId);

    // Check if student has pending invites
    const pendingInvites = await GroupMember.find({
      userId: user._id,
      status: 'INVITED',
    })
      .populate({
        path: 'groupId',
        populate: { path: 'leaderId', select: 'name email enrollmentNumber' },
      })
      .populate('invitedBy', 'name enrollmentNumber');

    if (validMemberships.length === 0) {
      return res.status(200).json({
        success: true,
        hasGroup: false,
        group: null,
        groups: [],
        members: [],
        pendingInvites,
      });
    }

    const requestedGroupId = req.query.groupId;
    let selectedMembership = validMemberships[0];
    if (requestedGroupId) {
      const match = validMemberships.find((m) => String(m.groupId._id) === String(requestedGroupId));
      if (match) selectedMembership = match;
    }

    const group = selectedMembership.groupId;
    const maxGroupSize = await getMaxGroupSize();

    // Enrich all student's groups for multi-group switcher
    const groupsList = await Promise.all(
      validMemberships.map(async (m) => {
        const gDoc = m.groupId;
        const gObj = gDoc.toJSON ? gDoc.toJSON() : { ...gDoc };
        const count = await GroupMember.countDocuments({ groupId: gDoc._id, status: 'ACCEPTED' });
        return {
          ...gObj,
          userRole: m.role,
          memberCount: count,
          maxMembers: maxGroupSize,
        };
      })
    );

    // Get all accepted members for the selected group
    const memberDocs = await GroupMember.find({
      groupId: group._id,
      status: 'ACCEPTED',
    }).populate({
      path: 'userId',
      select: 'name email enrollmentNumber role',
    });

    const members = await Promise.all(
      memberDocs.map(async (m) => {
        const mObj = m.toJSON();
        const profile = await StudentProfile.findOne({ userId: m.userId._id }).select('skills interests bio semester');
        return {
          ...mObj,
          user: {
            ...mObj.userId,
            profile,
          },
        };
      })
    );

    // Get pending invites sent by this group
    const pendingGroupInvites = await GroupMember.find({
      groupId: group._id,
      status: 'INVITED',
    }).populate('userId', 'name enrollmentNumber email');

    const groupObj = group.toJSON ? group.toJSON() : { ...group };
    groupObj.maxMembers = maxGroupSize;
    groupObj.minMembers = 2;

    res.status(200).json({
      success: true,
      hasGroup: true,
      group: groupObj,
      groups: groupsList,
      selectedGroupId: group._id,
      userRoleInGroup: selectedMembership.role,
      members,
      pendingInvites,
      sentInvites: pendingGroupInvites,
      maxMembers: maxGroupSize,
      minMembers: 2,
      isGroupFull: members.length >= maxGroupSize,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Invite a student to group
 * @route POST /api/groups/:id/invite
 */
export const inviteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { searchIdentifier } = inviteMemberSchema.parse(req.body);
    const user = req.user;

    const group = await ProjectGroup.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (group.status !== 'FORMING') {
      return res.status(400).json({
        success: false,
        message: `Cannot send invites to a group with status '${group.status}'. Group must be in FORMING stage.`,
      });
    }

    // Authorization: only leader can invite
    const callerMembership = await GroupMember.findOne({
      groupId: id,
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!callerMembership || callerMembership.role !== 'LEADER') {
      return res.status(403).json({
        success: false,
        message: 'Only the group leader can invite members.',
      });
    }

    // Enforce max group size limit set by Admin
    const currentMembersCount = await GroupMember.countDocuments({
      groupId: id,
      status: 'ACCEPTED',
    });
    const maxGroupSize = await getMaxGroupSize();

    if (currentMembersCount >= maxGroupSize) {
      return res.status(400).json({
        success: false,
        message: `Cannot send invite: The group has reached the maximum allowed limit of ${maxGroupSize} members set by the administrator.`,
      });
    }

    // Check pending invitations against available slots
    const pendingInvitesCount = await GroupMember.countDocuments({
      groupId: id,
      status: 'INVITED',
    });

    if (currentMembersCount + pendingInvitesCount >= maxGroupSize) {
      return res.status(400).json({
        success: false,
        message: `Cannot send invite: All group slots are filled (${currentMembersCount} accepted + ${pendingInvitesCount} pending invite(s)). The administrator allows a maximum of ${maxGroupSize} members. Please cancel a pending invitation before inviting another student.`,
      });
    }

    // Find student by enrollment or email (case-insensitive regex)
    const trimmed = searchIdentifier.trim();
    let candidate = await User.findOne({
      role: 'STUDENT',
      $or: [
        { enrollmentNumber: new RegExp(`^${trimmed}$`, 'i') },
        { email: new RegExp(`^${trimmed}$`, 'i') },
      ],
    });

    if (!candidate) {
      const studentProf = await StudentProfile.findOne({
        enrollmentNumber: new RegExp(`^${trimmed}$`, 'i'),
      }).populate('userId');
      if (studentProf && studentProf.userId && studentProf.userId.role === 'STUDENT') {
        candidate = studentProf.userId;
      }
    }

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: `No student found matching '${searchIdentifier}'.`,
      });
    }

    if (String(candidate._id) === String(user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot invite yourself to your own group.',
      });
    }



    // Check existing invite
    const existingInvite = await GroupMember.findOne({
      groupId: id,
      userId: candidate._id,
    });

    let invite;
    if (existingInvite) {
      if (existingInvite.status === 'INVITED') {
        return res.status(400).json({
          success: false,
          message: `Student '${candidate.name}' has already been invited to this group.`,
        });
      }
      if (existingInvite.status === 'ACCEPTED') {
        return res.status(400).json({
          success: false,
          message: `Student '${candidate.name}' is already a member of this group.`,
        });
      }
      if (existingInvite.status === 'REJECTED') {
        existingInvite.status = 'INVITED';
        existingInvite.invitedBy = user._id;
        await existingInvite.save();
        invite = existingInvite;
      }
    } else {
      invite = await GroupMember.create({
        groupId: id,
        userId: candidate._id,
        role: 'MEMBER',
        status: 'INVITED',
        invitedBy: user._id,
      });
    }

    await logAuditEvent({
      actor: user,
      action: 'GROUP_MEMBER_INVITED',
      targetEntity: 'ProjectGroup',
      targetId: id,
      details: { invitedStudent: candidate.enrollmentNumber || candidate.email },
      req,
    });

    // Notify the invited student
    await Notification.create({
      userId: candidate._id,
      title: 'Project Group Invitation',
      message: `${user.name} invited you to join project group "${group.name}" (${group.code}).`,
      type: 'GROUP',
      linkUrl: '/student/group',
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${candidate.name} (${candidate.enrollmentNumber || candidate.email}).`,
      invite,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Respond to group invitation (Accept / Reject)
 * @route POST /api/groups/invites/:inviteId/respond
 */
export const respondInvite = async (req, res, next) => {
  try {
    const { inviteId } = req.params;
    const { action } = respondInviteSchema.parse(req.body);
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invitation ID format.',
      });
    }

    const invite = await GroupMember.findById(inviteId);
    if (!invite || String(invite.userId) !== String(user._id)) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or not assigned to you.',
      });
    }

    if (invite.status !== 'INVITED') {
      return res.status(400).json({
        success: false,
        message: 'This invitation has already been processed.',
      });
    }

    if (action === 'ACCEPT') {


      // Check if group has reached max members limit set by Admin
      const currentMembersCount = await GroupMember.countDocuments({
        groupId: invite.groupId,
        status: 'ACCEPTED',
      });
      const maxGroupSize = await getMaxGroupSize();
      if (currentMembersCount >= maxGroupSize) {
        return res.status(400).json({
          success: false,
          message: `Cannot join group: This group has already reached the maximum allowed limit of ${maxGroupSize} members set by the administrator.`,
        });
      }

      invite.status = 'ACCEPTED';
      await invite.save();



      await logAuditEvent({
        actor: user,
        action: 'GROUP_INVITE_ACCEPTED',
        targetEntity: 'ProjectGroup',
        targetId: invite.groupId,
        req,
      });

      // Notify the group leader
      const group = await ProjectGroup.findById(invite.groupId);
      if (group && group.leaderId) {
        await Notification.create({
          userId: group.leaderId,
          title: 'Group Invitation Accepted',
          message: `${user.name} (${user.enrollmentNumber || user.email}) accepted your invitation and joined "${group.name}".`,
          type: 'GROUP',
          linkUrl: '/student/group',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Invitation accepted! You are now a member of the group.',
      });
    } else {
      invite.status = 'REJECTED';
      await invite.save();

      // Notify the group leader
      const group = await ProjectGroup.findById(invite.groupId);
      if (group && group.leaderId) {
        await Notification.create({
          userId: group.leaderId,
          title: 'Group Invitation Declined',
          message: `${user.name} (${user.enrollmentNumber || user.email}) declined your invitation to join "${group.name}".`,
          type: 'GROUP',
          linkUrl: '/student/group',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Invitation rejected.',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Leave group
 * @route POST /api/groups/:id/leave
 */
export const leaveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const membership = await GroupMember.findOne({
      groupId: id,
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!membership) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this group.',
      });
    }

    const acceptedMembers = await GroupMember.find({
      groupId: id,
      status: 'ACCEPTED',
    });

    if (membership.role === 'LEADER' && acceptedMembers.length > 1) {
      // Reassign leader role to next accepted member
      const nextLeader = acceptedMembers.find((m) => String(m.userId) !== String(user._id));
      if (nextLeader) {
        nextLeader.role = 'LEADER';
        await nextLeader.save();
        await ProjectGroup.findByIdAndUpdate(id, { leaderId: nextLeader.userId });

        // Notify new leader
        const group = await ProjectGroup.findById(id);
        await Notification.create({
          userId: nextLeader.userId,
          title: 'Group Leadership Transferred',
          message: `${user.name} left the group. You are now the group leader of "${group?.name || 'your group'}".`,
          type: 'GROUP',
          linkUrl: '/student/group',
        });
      }
    }

    await GroupMember.findByIdAndDelete(membership._id);

    // If no members left, mark group disbanded and archive draft projects
    const remainingCount = await GroupMember.countDocuments({ groupId: id, status: 'ACCEPTED' });
    if (remainingCount === 0) {
      await ProjectGroup.findByIdAndUpdate(id, { status: 'DISBANDED' });
      const { default: Project } = await import('../models/Project.js');
      await Project.updateMany({ groupId: id, status: 'DRAFT' }, { status: 'CANCELLED', isArchived: true });
    }

    await logAuditEvent({
      actor: user,
      action: 'GROUP_MEMBER_LEFT',
      targetEntity: 'ProjectGroup',
      targetId: id,
      req,
    });

    res.status(200).json({
      success: true,
      message: 'You have left the group.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc List all groups (Coordinator / Admin oversight)
 * @route GET /api/groups
 */
export const getAllGroups = async (req, res, next) => {
  try {
    const { departmentId, sgpCycleId, search } = req.query;
    const query = {};

    if (departmentId) query.departmentId = departmentId;
    if (sgpCycleId) query.sgpCycleId = sgpCycleId;

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ name: regex }, { code: regex }];
    }

    const groups = await ProjectGroup.find(query)
      .populate('leaderId', 'name enrollmentNumber email')
      .populate('guideId', 'name email designation')
      .populate('coGuideId', 'name email designation')
      .populate('departmentId', 'name code')
      .populate('sgpCycleId', 'name')
      .sort({ createdAt: -1 });

    const groupsWithMembers = await Promise.all(
      groups.map(async (g) => {
        const members = await GroupMember.find({ groupId: g._id, status: 'ACCEPTED' })
          .populate('userId', 'name enrollmentNumber email');
        return {
          ...g.toJSON(),
          members,
        };
      })
    );

    res.status(200).json({
      success: true,
      groups: groupsWithMembers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Mark group as Ready for Proposal
 * @route PUT /api/groups/:id/ready
 */
export const markGroupReady = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const group = await ProjectGroup.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const callerMembership = await GroupMember.findOne({
      groupId: id,
      userId: user._id,
      status: 'ACCEPTED',
    });

    if (!callerMembership || callerMembership.role !== 'LEADER') {
      return res.status(403).json({
        success: false,
        message: 'Only the group leader can mark the group as ready.',
      });
    }

    if (group.status !== 'FORMING') {
      return res.status(400).json({
        success: false,
        message: 'Group is not in the FORMING state.',
      });
    }

    const acceptedMembersCount = await GroupMember.countDocuments({
      groupId: id,
      status: 'ACCEPTED',
    });

    const minMembers = group.minMembers || 2;
    if (acceptedMembersCount < minMembers) {
      return res.status(400).json({
        success: false,
        message: `At least ${minMembers} members are required to proceed. Currently have ${acceptedMembersCount}.`,
      });
    }

    group.status = 'READY_FOR_PROPOSAL';
    await group.save();

    await logAuditEvent({
      actor: user,
      action: 'GROUP_MARKED_READY',
      targetEntity: 'ProjectGroup',
      targetId: id,
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Group is now Ready for Proposal.',
      group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete a project group (Admin/Coordinator)
 * @route DELETE /api/groups/:id
 */
export const deleteGroup = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const group = await ProjectGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({ success: false, detail: 'Group not found' });
    }

    // Delete all memberships for this group
    await GroupMember.deleteMany({ groupId });
    
    // Delete the group itself
    await ProjectGroup.findByIdAndDelete(groupId);

    res.status(200).json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Cancel a pending invitation (by group leader)
 * @route DELETE /api/groups/invites/:inviteId
 */
export const cancelInvite = async (req, res, next) => {
  try {
    const { inviteId } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(inviteId)) {
      return res.status(400).json({ success: false, message: 'Invalid invitation ID format.' });
    }

    const invite = await GroupMember.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invitation not found.' });
    }

    if (invite.status !== 'INVITED') {
      return res.status(400).json({ success: false, message: 'This invitation is not pending.' });
    }

    // Verify caller is leader of the group that sent the invite, or is admin
    if (user.role !== 'ADMIN') {
      const callerMembership = await GroupMember.findOne({
        groupId: invite.groupId,
        userId: user._id,
        status: 'ACCEPTED',
      });

      if (!callerMembership || callerMembership.role !== 'LEADER') {
        return res.status(403).json({ success: false, message: 'Only the group leader can cancel sent invitations.' });
      }
    }

    await GroupMember.findByIdAndDelete(inviteId);

    await logAuditEvent({
      actor: user,
      action: 'GROUP_INVITE_CANCELLED',
      targetEntity: 'ProjectGroup',
      targetId: invite.groupId,
      details: { cancelledInviteId: inviteId },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Remove a member from the group (by group leader)
 * @route DELETE /api/groups/:id/members/:memberId
 */
export const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const user = req.user;

    const group = await ProjectGroup.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (group.status !== 'FORMING' && user.role !== 'ADMIN') {
      return res.status(400).json({ success: false, message: 'Members can only be removed while the group is in FORMING status.' });
    }

    if (user.role !== 'ADMIN') {
      const callerMembership = await GroupMember.findOne({
        groupId: id,
        userId: user._id,
        status: 'ACCEPTED',
      });

      if (!callerMembership || callerMembership.role !== 'LEADER') {
        return res.status(403).json({ success: false, message: 'Only the group leader can remove members.' });
      }
    }

    if (String(user._id) === String(memberId)) {
      return res.status(400).json({ success: false, message: 'Group leader cannot be removed. Transfer leadership or leave group instead.' });
    }

    // Target member could be specified by userId or membership _id
    let targetMember = await GroupMember.findOne({
      groupId: id,
      userId: memberId,
      status: 'ACCEPTED',
    });
    if (!targetMember && mongoose.Types.ObjectId.isValid(memberId)) {
      targetMember = await GroupMember.findOne({
        _id: memberId,
        groupId: id,
        status: 'ACCEPTED',
      });
    }

    if (!targetMember) {
      return res.status(404).json({ success: false, message: 'Member not found in this group.' });
    }

    await GroupMember.findByIdAndDelete(targetMember._id);

    // Notify the removed member
    await Notification.create({
      userId: targetMember.userId,
      title: 'Removed from Project Group',
      message: `You were removed from the project group "${group.name}".`,
      type: 'GROUP',
      linkUrl: '/student/group',
    });

    await logAuditEvent({
      actor: user,
      action: 'GROUP_MEMBER_REMOVED',
      targetEntity: 'ProjectGroup',
      targetId: id,
      details: { removedUserId: targetMember.userId },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Member removed from group successfully.',
    });
  } catch (error) {
    next(error);
  }
};
