from __future__ import annotations
from app.core.schemas import CamelModel
"""
FastAPI router for Project Groups.
Converted from: groupController.js + groupRoutes.js
Prefix: /api/groups
"""


import random
import re
import string
from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.security import get_current_user, require_roles
from app.models.group_member import GroupMember
from app.models.project_group import ProjectGroup
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.models.notification import Notification
from app.models.sgp_cycle import SGPCycle
from app.models.system_config import SystemConfig
from app.utils.audit_logger import log_audit_event

router = APIRouter(prefix="/api/groups", tags=["groups"])


async def get_max_group_size() -> int:
    """Fetch maximum allowed student group members configured by Admin."""
    cfg = await SystemConfig.find_one(SystemConfig.key == "MAX_GROUP_SIZE")
    if not cfg:
        cfg = await SystemConfig.find_one(SystemConfig.key == "MAX_TEAM_SIZE")
    if cfg and cfg.value:
        try:
            return max(1, int(cfg.value))
        except (ValueError, TypeError):
            pass
    return 4


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class CreateGroupBody(CamelModel):
    """Request body for creating a new project group."""

    name: str
    sgp_cycle_id: Optional[PydanticObjectId] = None
    department_id: Optional[PydanticObjectId] = None


class JoinByCodeBody(CamelModel):
    """Request body for joining a group by its short code."""

    code: str


class InviteMemberBody(CamelModel):
    """Request body for inviting a student to a group."""

    search_identifier: str  # enrollment number OR e-mail


class RespondInviteBody(CamelModel):
    """Request body for accepting or rejecting an invite."""

    action: str  # "ACCEPT" | "REJECT"

class UpdateGroupBody(CamelModel):
    """Request body for updating a project group."""
    name: Optional[str] = None
    status: Optional[str] = None



# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _generate_group_code() -> str:
    """Generate a unique group code like GRP-2026-X8A2."""
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"GRP-{datetime.now(timezone.utc).year}-{suffix}"


# ---------------------------------------------------------------------------
# POST /api/groups  – create group
# ---------------------------------------------------------------------------


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project group",
)
async def create_group(
    request: Request,
    body: CreateGroupBody,
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """
    Create a new project group.
    The calling student is automatically made the group leader.
    """


    group_code = _generate_group_code()

    sgp_cycle_id = body.sgp_cycle_id
    department_id = body.department_id
    if not sgp_cycle_id or not department_id:
        profile = await StudentProfile.find_one(StudentProfile.user_id == current_user.id)
        if profile and profile.department_id:
            if not department_id:
                department_id = profile.department_id
            if not sgp_cycle_id:
                active_cycle = await SGPCycle.find_one(
                    SGPCycle.department_id == profile.department_id,
                    SGPCycle.is_active == True
                )
                if active_cycle:
                    sgp_cycle_id = active_cycle.id

    group = ProjectGroup(
        name=body.name,
        code=group_code,
        leader_id=current_user.id,
        sgp_cycle_id=sgp_cycle_id,
        department_id=department_id,
        status="FORMING",
    )
    await group.insert()

    leader_member = GroupMember(
        group_id=group.id,
        user_id=current_user.id,
        role="LEADER",
        status="ACCEPTED",
    )
    await leader_member.insert()

    await log_audit_event(
        actor=current_user,
        action="GROUP_CREATED",
        target_entity="ProjectGroup",
        target_id=group.id,
        details={"name": group.name, "code": group.code},
        request=request,
    )

    return {
        "success": True,
        "message": "Group created successfully.",
        "group": group.model_dump(mode='json', by_alias=True),
        "membership": leader_member.model_dump(mode='json', by_alias=True),
    }


# ---------------------------------------------------------------------------
# POST /api/groups/join-by-code  – join by code
# ---------------------------------------------------------------------------


@router.post(
    "/join-by-code",
    summary="Join an existing group using its group code",
)
async def join_group_by_code(
    request: Request,
    body: JoinByCodeBody,
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """Join a project group using its short code (e.g. GRP-2026-X639)."""
    if not body.code or not body.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group Code is required.",
        )

    trimmed_code = body.code.strip().upper()



    group = await ProjectGroup.find_one(ProjectGroup.code == trimmed_code)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No project group found with code '{trimmed_code}'.",
        )

    if group.status in ("LOCKED", "DISBANDED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Group '{group.name}' is {group.status.lower()} and not accepting new members.",
        )

    # Check max group size limit set by Admin
    current_members_count = await GroupMember.find(
        GroupMember.group_id == group.id,
        GroupMember.status == "ACCEPTED",
    ).count()
    max_group_size = await get_max_group_size()
    if current_members_count >= max_group_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot join group: Group '{group.name}' has already reached the maximum allowed limit of {max_group_size} members set by the administrator.",
        )

    membership = await GroupMember.find_one(
        GroupMember.group_id == group.id,
        GroupMember.user_id == current_user.id,
    )

    if membership:
        if membership.status == "ACCEPTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already a member of this group.",
            )
        membership.status = "ACCEPTED"
        await membership.save()
    else:
        membership = GroupMember(
            group_id=group.id,
            user_id=current_user.id,
            role="MEMBER",
            status="ACCEPTED",
        )
        await membership.insert()

    # Reject all other pending invitations for this student
    other_invites = await GroupMember.find(
        GroupMember.user_id == current_user.id,
        GroupMember.status == "INVITED",
        GroupMember.id != membership.id,
    ).to_list()
    for invite in other_invites:
        invite.status = "REJECTED"
        await invite.save()

    await log_audit_event(
        actor=current_user,
        action="GROUP_JOINED_BY_CODE",
        target_entity="ProjectGroup",
        target_id=group.id,
        details={"code": group.code},
        request=request,
    )

    return {
        "success": True,
        "message": f"Successfully joined group '{group.name}' ({group.code})!",
        "group": group.model_dump(mode='json', by_alias=True),
    }


# ---------------------------------------------------------------------------
# GET /api/groups/my-group  – get current student's group
# ---------------------------------------------------------------------------


@router.get(
    "/my-group",
    summary="Get current student's group details and members",
)
async def get_my_group(
    current_user: User = Depends(get_current_user),
):
    """Return the calling user's active project group, or pending invites if none."""
    membership = await GroupMember.find_one(
        GroupMember.user_id == current_user.id,
        GroupMember.status == "ACCEPTED",
    )

    if not membership:
        # Return pending invites instead
        pending_invites_docs = await GroupMember.find(
            GroupMember.user_id == current_user.id,
            GroupMember.status == "INVITED",
        ).to_list()

        pending_invites = []
        for pi in pending_invites_docs:
            pi_dict = pi.model_dump(mode='json', by_alias=True)
            if pi.group_id:
                grp = await ProjectGroup.get(pi.group_id)
                pi_dict["groupId"] = grp.model_dump(mode='json', by_alias=True) if grp else pi_dict["groupId"]
            if pi.invited_by:
                inviter = await User.get(pi.invited_by)
                if inviter:
                    pi_dict["invitedBy"] = {
                        "name": inviter.name,
                        "enrollmentNumber": getattr(inviter, "enrollment_number", None)
                    }
            pending_invites.append(pi_dict)

        max_group_size = await get_max_group_size()
        return {
            "success": True,
            "hasGroup": False,
            "group": None,
            "members": [],
            "pendingInvites": pending_invites,
            "maxMembers": max_group_size,
            "minMembers": 2,
        }

    group = await ProjectGroup.get(membership.group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found.",
        )

    # Get all accepted members with profiles
    member_docs = await GroupMember.find(
        GroupMember.group_id == group.id,
        GroupMember.status == "ACCEPTED",
    ).to_list()

    members = []
    for m in member_docs:
        m_dict = m.model_dump(mode='json', by_alias=True)
        user_doc = await User.get(m.user_id)
        profile = None
        if user_doc:
            profile_doc = await StudentProfile.find_one(
                StudentProfile.user_id == user_doc.id
            )
            if profile_doc:
                profile = {
                    "skills": profile_doc.skills,
                    "interests": profile_doc.interests,
                    "bio": profile_doc.bio,
                    "semester": getattr(profile_doc, "semester", None),
                }
            m_dict["user"] = {
                **user_doc.model_dump(mode='json', by_alias=True),
                "profile": profile,
            }
        members.append(m_dict)

    # Pending invites sent by this group
    pending_group_invites_docs = await GroupMember.find(
        GroupMember.group_id == group.id,
        GroupMember.status == "INVITED",
    ).to_list()
    pending_group_invites = []
    for inv in pending_group_invites_docs:
        inv_dict = inv.model_dump(mode='json', by_alias=True)
        candidate = await User.get(inv.user_id)
        if candidate:
            inv_dict["user"] = {
                "name": candidate.name,
                "enrollmentNumber": getattr(candidate, "enrollment_number", None),
                "email": candidate.email,
            }
        pending_group_invites.append(inv_dict)

    max_group_size = await get_max_group_size()
    group_dict = group.model_dump(mode='json', by_alias=True)
    group_dict["maxMembers"] = max_group_size
    group_dict["minMembers"] = 2

    return {
        "success": True,
        "hasGroup": True,
        "group": group_dict,
        "userRoleInGroup": membership.role,
        "members": members,
        "pendingInvites": pending_group_invites,
        "maxMembers": max_group_size,
        "minMembers": 2,
        "isGroupFull": len(members) >= max_group_size,
        "availableSlots": max(0, max_group_size - len(members)),
    }


# ---------------------------------------------------------------------------
# POST /api/groups/{id}/invite  – invite member
# ---------------------------------------------------------------------------


@router.post(
    "/{group_id}/invite",
    status_code=status.HTTP_201_CREATED,
    summary="Invite a student to the group",
)
async def invite_member(
    request: Request,
    group_id: PydanticObjectId,
    body: InviteMemberBody,
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """
    Invite a student (by enrollment number or email) to a project group.
    Only the group leader may send invitations.
    """
    group = await ProjectGroup.get(group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found.",
        )

    if group.status != "FORMING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot send invites to a group with status '{group.status}'. Group must be in FORMING stage.",
        )

    # Only leader can invite
    caller_membership = await GroupMember.find_one(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.status == "ACCEPTED",
    )
    if not caller_membership or caller_membership.role != "LEADER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group leader can invite members.",
        )

    # Enforce maximum group member limit set by Admin
    current_members_count = await GroupMember.find(
        GroupMember.group_id == group_id,
        GroupMember.status == "ACCEPTED",
    ).count()
    max_group_size = await get_max_group_size()

    if current_members_count >= max_group_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot send invite: The group has reached the maximum allowed limit of {max_group_size} members set by the administrator.",
        )

    # Check pending invitations against available slots
    pending_count = await GroupMember.find(
        GroupMember.group_id == group_id,
        GroupMember.status == "INVITED",
    ).count()

    if (current_members_count + pending_count) >= max_group_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot send invite: All group slots are filled ({current_members_count} accepted + {pending_count} pending invite(s)). The maximum allowed limit is {max_group_size} members. Please cancel a pending invitation before inviting another student.",
        )

    trimmed = body.search_identifier.strip()
    escaped_identifier = re.escape(trimmed)

    # Find student by enrollment number or email (supports both camelCase and snake_case in MongoDB)
    candidate = await User.find_one(
        User.role == "STUDENT",
        {
            "$or": [
                {"enrollmentNumber": {"$regex": f"^{escaped_identifier}$", "$options": "i"}},
                {"enrollment_number": {"$regex": f"^{escaped_identifier}$", "$options": "i"}},
                {"email": {"$regex": f"^{escaped_identifier}$", "$options": "i"}},
            ]
        },
    )
    if not candidate:
        student_profile = await StudentProfile.find_one(
            {
                "$or": [
                    {"enrollmentNumber": {"$regex": f"^{escaped_identifier}$", "$options": "i"}},
                    {"enrollment_number": {"$regex": f"^{escaped_identifier}$", "$options": "i"}},
                ]
            }
        )
        if student_profile:
            candidate = await User.get(student_profile.user_id)
            if candidate and candidate.role != "STUDENT":
                candidate = None
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No student found matching '{body.search_identifier}'.",
        )

    if candidate.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite yourself to your own group.",
        )



    # Check existing invite
    existing_invite = await GroupMember.find_one(
        GroupMember.group_id == group_id,
        GroupMember.user_id == candidate.id,
    )
    if existing_invite:
        if existing_invite.status == "INVITED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Student '{candidate.name}' has already been invited to this group.",
            )
        if existing_invite.status == "ACCEPTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Student '{candidate.name}' is already a member of this group.",
            )
        if existing_invite.status == "REJECTED":
            existing_invite.status = "INVITED"
            existing_invite.invited_by = current_user.id
            await existing_invite.save()
            invite = existing_invite
    else:
        invite = GroupMember(
            group_id=group_id,
            user_id=candidate.id,
            role="MEMBER",
            status="INVITED",
            invited_by=current_user.id,
        )
        await invite.insert()

    notification = Notification(
        user_id=candidate.id,
        title="Group Invitation",
        message=f"You have been invited to join group '{group.name}'.",
        type="INVITATION"
    )
    await notification.insert()

    await log_audit_event(
        actor=current_user,
        action="GROUP_MEMBER_INVITED",
        target_entity="ProjectGroup",
        target_id=group_id,
        details={"invitedStudent": getattr(candidate, "enrollment_number", "")},
        request=request,
    )

    return {
        "success": True,
        "message": f"Invitation sent to {candidate.name} ({getattr(candidate, 'enrollment_number', '')}).",
        "invite": invite.model_dump(mode='json', by_alias=True),
    }


# ---------------------------------------------------------------------------
# POST /api/groups/invites/{invite_id}/respond  – respond to invite
# ---------------------------------------------------------------------------


@router.post(
    "/invites/{invite_id}/respond",
    summary="Respond to a group invitation (Accept / Reject)",
)
async def respond_invite(
    request: Request,
    invite_id: PydanticObjectId,
    body: RespondInviteBody,
    current_user: User = Depends(get_current_user),
):
    """Accept or reject a pending group invitation."""
    if body.action not in ("ACCEPT", "REJECT"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action must be 'ACCEPT' or 'REJECT'.",
        )

    invite = await GroupMember.get(invite_id)
    if not invite or invite.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or not assigned to you.",
        )

    if invite.status != "INVITED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has already been processed.",
        )

    if body.action == "ACCEPT":


        # Check if group has reached max members limit set by Admin
        current_members_count = await GroupMember.find(
            GroupMember.group_id == invite.group_id,
            GroupMember.status == "ACCEPTED",
        ).count()
        max_group_size = await get_max_group_size()
        if current_members_count >= max_group_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot join group: This group has already reached the maximum allowed limit of {max_group_size} members set by the administrator.",
            )

        invite.status = "ACCEPTED"
        await invite.save()



        leader_member = await GroupMember.find_one(
            GroupMember.group_id == invite.group_id,
            GroupMember.role == "LEADER"
        )
        if leader_member:
            notif = Notification(
                user_id=leader_member.user_id,
                title="Invitation Accepted",
                message=f"{current_user.name} accepted your invitation and joined the group.",
                type="INVITATION_ACCEPTED"
            )
            await notif.insert()

        await log_audit_event(
            actor=current_user,
            action="GROUP_INVITE_ACCEPTED",
            target_entity="ProjectGroup",
            target_id=invite.group_id,
            request=request,
        )

        return {
            "success": True,
            "message": "Invitation accepted! You are now a member of the group.",
        }

    # REJECT
    invite.status = "REJECTED"
    await invite.save()
    return {"success": True, "message": "Invitation rejected."}


# ---------------------------------------------------------------------------
# POST /api/groups/{id}/leave  – leave group
# ---------------------------------------------------------------------------


@router.post(
    "/{group_id}/leave",
    summary="Leave a project group",
)
async def leave_group(
    request: Request,
    group_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """Remove the calling user from a project group. Reassigns leader if needed."""
    membership = await GroupMember.find_one(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.status == "ACCEPTED",
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a member of this group.",
        )

    accepted_members = await GroupMember.find(
        GroupMember.group_id == group_id,
        GroupMember.status == "ACCEPTED",
    ).to_list()

    if membership.role == "LEADER" and len(accepted_members) > 1:
        next_leader = next(
            (m for m in accepted_members if m.user_id != current_user.id),
            None,
        )
        if next_leader:
            next_leader.role = "LEADER"
            await next_leader.save()
            group = await ProjectGroup.get(group_id)
            if group:
                group.leader_id = next_leader.user_id
                await group.save()

    await membership.delete()

    # Count remaining accepted members
    remaining = await GroupMember.find(
        GroupMember.group_id == group_id,
        GroupMember.status == "ACCEPTED",
    ).to_list()

    if len(remaining) == 0:
        group = await ProjectGroup.get(group_id)
        if group:
            group.status = "DISBANDED"
            await group.save()

    await log_audit_event(
        actor=current_user,
        action="GROUP_MEMBER_LEFT",
        target_entity="ProjectGroup",
        target_id=group_id,
        request=request,
    )

    return {"success": True, "message": "You have left the group."}


# ---------------------------------------------------------------------------
# GET /api/groups  – list all groups (coordinator / admin / faculty)
# ---------------------------------------------------------------------------


@router.get(
    "/",
    summary="List all groups (Coordinator / Admin / Faculty oversight)",
)
async def get_all_groups(
    department_id: Optional[str] = None,
    sgp_cycle_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_roles("ADMIN", "COORDINATOR", "FACULTY")),
):
    """Return all project groups, optionally filtered by department, cycle, or name/code."""
    query: dict = {}

    if department_id:
        query["department_id"] = PydanticObjectId(department_id)
    if sgp_cycle_id:
        query["sgp_cycle_id"] = PydanticObjectId(sgp_cycle_id)
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
        ]

    groups = await ProjectGroup.find(query).sort("-created_at").to_list()

    groups_with_members = []
    for g in groups:
        g_dict = g.model_dump(mode='json', by_alias=True)
        members = await GroupMember.find(
            GroupMember.group_id == g.id,
            GroupMember.status == "ACCEPTED",
        ).to_list()
        member_list = []
        for m in members:
            m_dict = m.model_dump(mode='json', by_alias=True)
            user_doc = await User.get(m.user_id)
            if user_doc:
                m_dict["user"] = {
                    "name": user_doc.name,
                    "enrollmentNumber": getattr(user_doc, "enrollment_number", None),
                    "email": user_doc.email,
                }
            member_list.append(m_dict)
        g_dict["members"] = member_list
        groups_with_members.append(g_dict)

    return {"success": True, "groups": groups_with_members}


# ---------------------------------------------------------------------------
# PUT /api/groups/{id}/ready  – mark group ready for proposal
# ---------------------------------------------------------------------------


@router.put(
    "/{group_id}/ready",
    summary="Mark group as Ready for Proposal",
)
async def mark_group_ready(
    request: Request,
    group_id: PydanticObjectId,
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """Transition a FORMING group to READY_FOR_PROPOSAL state."""
    group = await ProjectGroup.get(group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found.",
        )

    caller_membership = await GroupMember.find_one(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id,
        GroupMember.status == "ACCEPTED",
    )
    if not caller_membership or caller_membership.role != "LEADER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group leader can mark the group as ready.",
        )

    if group.status != "FORMING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group is not in the FORMING state.",
        )

    accepted_members = await GroupMember.find(
        GroupMember.group_id == group_id,
        GroupMember.status == "ACCEPTED",
    ).to_list()
    accepted_count = len(accepted_members)

    min_members = getattr(group, "min_members", 2) or 2
    if accepted_count < min_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At least {min_members} members are required to proceed. Currently have {accepted_count}.",
        )

    group.status = "READY_FOR_PROPOSAL"
    await group.save()

    await log_audit_event(
        actor=current_user,
        action="GROUP_MARKED_READY",
        target_entity="ProjectGroup",
        target_id=group_id,
        request=request,
    )

    return {
        "success": True,
        "message": "Group is now Ready for Proposal.",
        "group": group.model_dump(mode='json', by_alias=True),
    }

@router.put(
    "/{group_id}",
    summary="Edit a project group",
    dependencies=[Depends(require_roles("ADMIN", "COORDINATOR"))],
)
async def update_group(group_id: str, body: UpdateGroupBody, current_user: User = Depends(get_current_user)):
    try:
        oid = PydanticObjectId(group_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Group not found")
        
    group = await ProjectGroup.get(oid)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
        
    if body.name is not None:
        group.name = body.name
    if body.status is not None:
        group.status = body.status
        
    group.updated_at = datetime.now(timezone.utc)
    await group.save()
    
    return {
        "success": True,
        "message": "Group updated successfully",
        "group": group.model_dump(mode='json', by_alias=True)
    }

@router.delete(
    "/{group_id}",
    summary="Delete a project group",
    dependencies=[Depends(require_roles("ADMIN", "COORDINATOR"))],
)
async def delete_group(group_id: str, current_user: User = Depends(get_current_user)):
    try:
        oid = PydanticObjectId(group_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Group not found")
        
    group = await ProjectGroup.get(oid)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Delete all memberships for this group
    await GroupMember.find({"groupId": group_id}).delete()
    
    # Delete the group itself
    await group.delete()

    return {"success": True, "message": "Group deleted successfully"}


@router.delete(
    "/invites/{invite_id}",
    summary="Cancel a pending group invitation",
)
async def cancel_invite(
    invite_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        oid = PydanticObjectId(invite_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invitation ID format.")

    invite = await GroupMember.get(oid)
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    if invite.status != "INVITED":
        raise HTTPException(status_code=400, detail="This invitation is not pending.")

    if current_user.role != "ADMIN":
        caller_membership = await GroupMember.find_one(
            GroupMember.group_id == invite.group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.status == "ACCEPTED",
        )
        if not caller_membership or caller_membership.role != "LEADER":
            raise HTTPException(status_code=403, detail="Only the group leader can cancel sent invitations.")

    await invite.delete()
    return {"success": True, "message": "Invitation cancelled successfully."}


@router.delete(
    "/{group_id}/members/{member_id}",
    summary="Remove a member from the group",
)
async def remove_member(
    group_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        g_oid = PydanticObjectId(group_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid group ID format.")

    group = await ProjectGroup.get(g_oid)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")

    if group.status != "FORMING" and current_user.role != "ADMIN":
        raise HTTPException(status_code=400, detail="Members can only be removed while the group is in FORMING status.")

    if current_user.role != "ADMIN":
        caller_membership = await GroupMember.find_one(
            GroupMember.group_id == g_oid,
            GroupMember.user_id == current_user.id,
            GroupMember.status == "ACCEPTED",
        )
        if not caller_membership or caller_membership.role != "LEADER":
            raise HTTPException(status_code=403, detail="Only the group leader can remove members.")

    if str(current_user.id) == member_id:
        raise HTTPException(status_code=400, detail="Group leader cannot be removed. Transfer leadership or leave group instead.")

    target = None
    try:
        m_oid = PydanticObjectId(member_id)
        target = await GroupMember.find_one(
            GroupMember.group_id == g_oid,
            GroupMember.user_id == m_oid,
            GroupMember.status == "ACCEPTED",
        )
        if not target:
            target = await GroupMember.find_one(
                GroupMember.id == m_oid,
                GroupMember.group_id == g_oid,
                GroupMember.status == "ACCEPTED",
            )
    except Exception:
        pass

    if not target:
        raise HTTPException(status_code=404, detail="Member not found in this group.")

    await target.delete()
    return {"success": True, "message": "Member removed from group successfully."}
