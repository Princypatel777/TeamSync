from __future__ import annotations
from app.core.schemas import CamelModel
"""
FastAPI router for Project Proposals.
Converted from: proposalController.js + proposalRoutes.js
Prefix: /api/proposals
"""


import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.security import get_current_user, require_roles
from app.models.group_member import GroupMember
from app.models.project import Project
from app.models.project_group import ProjectGroup
from app.models.proposal_feedback import ProposalFeedback
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.models.notification import Notification
from app.utils.audit_logger import log_audit_event

router = APIRouter(prefix="/api/proposals", tags=["proposals"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_project_key(title: str, fallback: str = "PROJ") -> str:
    """Derive a short key (≤5 chars) from a project title."""
    words = re.sub(r"[^a-zA-Z0-9\s]", "", title).split()
    key = "".join(w[0] for w in words if w).upper()[:5]
    return key or fallback


async def _get_student_membership(
    user_id: PydanticObjectId, group_id: Optional[str | PydanticObjectId] = None
) -> Optional[GroupMember]:
    """Return the accepted GroupMember record for a student, matching group_id if provided."""
    query = [
        GroupMember.user_id == user_id,
        GroupMember.status == "ACCEPTED",
    ]
    if group_id:
        try:
            query.append(GroupMember.group_id == PydanticObjectId(str(group_id)))
        except Exception:
            pass
    return await GroupMember.find_one(*query)


async def _get_student_memberships(user_id: PydanticObjectId) -> List[GroupMember]:
    """Return all accepted GroupMember records for a student."""
    return await GroupMember.find(
        GroupMember.user_id == user_id,
        GroupMember.status == "ACCEPTED",
    ).to_list()


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class SaveDraftBody(CamelModel):
    """Request body for saving/updating a proposal draft."""

    project_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    problem_statement: Optional[str] = None
    objectives: Optional[List[str]] = None
    scope: Optional[str] = None
    expected_outcome: Optional[str] = None
    innovation: Optional[str] = None
    github_repository_url: Optional[str] = None


class SubmitProposalBody(CamelModel):
    """Request body for submitting a proposal."""

    project_id: Optional[str] = None


class AiRecommendationsBody(CamelModel):
    """Request body for AI project recommendations."""

    domain: Optional[str] = None


class ReviewProposalBody(CamelModel):
    """Request body for faculty/coordinator proposal review."""

    action: str  # APPROVE | REQUEST_REVISION | REJECT | APPROVE_EDIT_REQUEST
    feedback: Optional[str] = None


class AssignGuideBody(CamelModel):
    """Request body for assigning a faculty guide."""

    faculty_guide_id: Optional[PydanticObjectId] = None


class RequestEditBody(CamelModel):
    """Request body for requesting an edit on an approved proposal."""

    reason: Optional[str] = None
    fields: Optional[List[str]] = None
    project_id: Optional[PydanticObjectId] = None


# ---------------------------------------------------------------------------
# GET /api/proposals/my-proposal
# ---------------------------------------------------------------------------


@router.get(
    "/my-proposal",
    summary="Get current student's group project proposal draft",
)
async def get_my_proposal(
    group_id: Optional[str] = Query(None, alias="groupId"),
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """
    Return the group's proposal draft(s) and feedback history.
    Auto-creates an initial DRAFT project if none exists yet.
    """
    memberships = await _get_student_memberships(current_user.id)
    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must belong to a project group before drafting a proposal.",
        )

    membership = memberships[0]
    if group_id:
        match = next((m for m in memberships if str(m.group_id) == str(group_id)), None)
        if match:
            membership = match

    group = await ProjectGroup.get(membership.group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found.",
        )

    projects = (
        await Project.find(Project.group_id == group.id)
        .sort("+created_at")
        .to_list()
    )

    if not projects:
        # Auto-create initial draft
        default_key = (
            "".join(w[0] for w in group.name.split() if w).upper()[:4] or "PROJ"
        )
        new_project = Project(
            group_id=group.id,
            department_id=getattr(group, "department_id", None),
            sgp_cycle_id=getattr(group, "sgp_cycle_id", None),
            title=f"{group.name} SGP Project",
            project_key=default_key,
            status="DRAFT",
        )
        await new_project.insert()
        projects = [new_project]

    project = projects[0]

    feedback_history = (
        await ProposalFeedback.find(
            {"project_id": {"$in": [p.id for p in projects]}}
        )
        .sort("-created_at")
        .to_list()
    )

    member_docs = (
        await GroupMember.find(
            GroupMember.group_id == group.id,
            GroupMember.status == "ACCEPTED",
        ).to_list()
    )
    member_list = []
    for m in member_docs:
        m_dict = m.model_dump(mode='json', by_alias=True)
        u = await User.get(m.user_id)
        if u:
            m_dict["user"] = {
                "name": u.name,
                "email": u.email,
                "enrollmentNumber": getattr(u, "enrollment_number", None),
            }
        member_list.append(m_dict)

    groups_list = []
    for m in memberships:
        g = await ProjectGroup.get(m.group_id)
        if g:
            groups_list.append({
                "_id": str(g.id),
                "id": str(g.id),
                "name": g.name,
                "code": g.code,
                "userRole": m.role,
            })

    return {
        "success": True,
        "project": project.model_dump(mode='json', by_alias=True),
        "projects": [p.model_dump(mode='json', by_alias=True) for p in projects],
        "group": group.model_dump(mode='json', by_alias=True),
        "groups": groups_list,
        "members": member_list,
        "userRoleInGroup": membership.role,
        "feedbackHistory": [f.model_dump(mode='json', by_alias=True) for f in feedback_history],
    }


# ---------------------------------------------------------------------------
# PUT /api/proposals/draft
# ---------------------------------------------------------------------------


@router.put(
    "/draft",
    summary="Save / update a proposal draft",
)
async def save_proposal_draft(
    request: Request,
    body: SaveDraftBody,
    project_id_query: Optional[str] = Query(None, alias="projectId"),
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """Save field updates on a DRAFT or REVISION_REQUIRED proposal."""
    membership = await _get_student_membership(current_user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You do not belong to an active group.",
        )

    # Prefer query param projectId, then body field
    effective_project_id = project_id_query or (
        str(body.project_id) if body.project_id else None
    )

    project: Optional[Project] = None
    if effective_project_id:
        try:
            project = await Project.find_one(
                Project.id == PydanticObjectId(effective_project_id),
                Project.group_id == membership.group_id,
            )
        except Exception:
            pass
    if not project:
        project = await Project.find_one(
            Project.group_id == membership.group_id,
            Project.is_archived == False,  # noqa: E712
        )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project draft not found.",
        )

    if project.status == "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approved proposals cannot be modified.",
        )
    if project.status in ("SUBMITTED", "UNDER_REVIEW"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal is currently under review and cannot be edited until feedback is received.",
        )

    if body.title is not None:
        project.title = body.title
        project.project_key = _generate_project_key(body.title)
    if body.description is not None:
        project.description = body.description
    if body.domain is not None:
        project.domain = body.domain
    if body.tech_stack is not None and isinstance(body.tech_stack, list):
        project.tech_stack = body.tech_stack
    if body.problem_statement is not None:
        project.problem_statement = body.problem_statement
    if body.objectives is not None and isinstance(body.objectives, list):
        project.objectives = body.objectives
    if body.scope is not None:
        project.scope = body.scope
    if body.expected_outcome is not None:
        project.expected_outcome = body.expected_outcome
    if body.innovation is not None:
        project.innovation = body.innovation
    if body.github_repository_url is not None:
        project.github_repository_url = body.github_repository_url

    await project.save()

    await log_audit_event(
        actor=current_user,
        action="PROPOSAL_DRAFT_UPDATED",
        target_entity="Project",
        target_id=project.id,
        request=request,
    )

    return {
        "success": True,
        "message": "Proposal draft saved successfully.",
        "project": project.model_dump(mode='json', by_alias=True),
    }


# ---------------------------------------------------------------------------
# POST /api/proposals/create
# ---------------------------------------------------------------------------


@router.post(
    "/create",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new proposal slot for the group (max 3)",
)
async def create_new_proposal(
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """Leader-only: create an additional proposal draft slot (max 3 per group)."""
    membership = await GroupMember.find_one(
        GroupMember.user_id == current_user.id,
        GroupMember.status == "ACCEPTED",
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must belong to a group.",
        )
    if membership.role != "LEADER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group leader can create a new proposal.",
        )

    group = await ProjectGroup.get(membership.group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")

    active_count = await Project.find(
        Project.group_id == group.id,
        Project.is_archived == False,  # noqa: E712
        Project.status != "REJECTED",
    ).count()

    if active_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have reached the maximum limit of 3 active proposals.",
        )

    default_key = (
        "".join(w[0] for w in group.name.split() if w).upper()[:4] or "PROJ"
    )
    project = Project(
        group_id=group.id,
        department_id=getattr(group, "department_id", None),
        sgp_cycle_id=getattr(group, "sgp_cycle_id", None),
        title=f"{group.name} SGP Project (Option {active_count + 1})",
        project_key=default_key,
        status="DRAFT",
    )
    await project.insert()

    return {
        "success": True,
        "message": "New proposal draft created successfully.",
        "project": project.model_dump(mode='json', by_alias=True),
    }


# ---------------------------------------------------------------------------
# POST /api/proposals/ai-recommendations
# ---------------------------------------------------------------------------


@router.post(
    "/ai-recommendations",
    summary="Get AI recommendations tailored to group skills & interests",
)
async def get_ai_recommendations(
    body: AiRecommendationsBody,
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """
    Aggregate skills and interests of all group members, then call the AI
    service for project recommendations.
    """
    # Import lazily to avoid circular dependency at module level
    from app.services.ai_service import generate_project_recommendations  # type: ignore

    membership = await _get_student_membership(current_user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must belong to a group to request AI recommendations.",
        )

    group_members = await GroupMember.find(
        GroupMember.group_id == membership.group_id,
        GroupMember.status == "ACCEPTED",
    ).to_list()

    member_user_ids = [m.user_id for m in group_members]
    profiles = await StudentProfile.find(
        {"user_id": {"$in": member_user_ids}}
    ).to_list()

    combined_skills: list = list(
        {skill for p in profiles for skill in (p.skills or [])}
    )
    combined_interests: list = list(
        {interest for p in profiles for interest in (p.interests or [])}
    )

    result = await generate_project_recommendations(
        combined_skills, combined_interests, body.domain
    )

    return {
        "success": True,
        "isAiLive": result.get("isAiLive", False),
        "recommendations": result.get("recommendations", []),
        "combinedSkills": combined_skills,
        "combinedInterests": combined_interests,
    }


# ---------------------------------------------------------------------------
# POST /api/proposals/similarity-check
# ---------------------------------------------------------------------------


@router.post(
    "/similarity-check",
    summary="Run AI similarity & plagiarism check against DB projects",
)
async def run_similarity_check(
    request: Request,
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """Compute and store a similarity score for the group's current draft project."""
    from app.services.ai_service import compute_project_similarity  # type: ignore

    membership = await _get_student_membership(current_user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must belong to a group.",
        )

    project = await Project.find_one(Project.group_id == membership.group_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft project not found.",
        )

    similarity_report = await compute_project_similarity(project, project.id)
    project.similarity_score = similarity_report.get("similarityScore")
    project.similar_projects = similarity_report.get("similarProjects", [])
    await project.save()

    await log_audit_event(
        actor=current_user,
        action="PROPOSAL_SIMILARITY_CHECKED",
        target_entity="Project",
        target_id=project.id,
        details={"similarityScore": similarity_report.get("similarityScore")},
        request=request,
    )

    return {
        "success": True,
        "similarityReport": similarity_report,
        "project": project.model_dump(mode='json', by_alias=True),
    }


# ---------------------------------------------------------------------------
# POST /api/proposals/submit
# ---------------------------------------------------------------------------


@router.post(
    "/submit",
    summary="Submit proposal for faculty review",
)
async def submit_proposal(
    request: Request,
    body: Optional[SubmitProposalBody] = None,
    project_id_query: Optional[str] = Query(None, alias="projectId"),
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """
    Leader-only: submit a draft/revision proposal for faculty guide review.
    Runs an automated similarity check before submitting.
    """
    from app.services.ai_service import compute_project_similarity  # type: ignore

    membership = await _get_student_membership(current_user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must belong to a group.",
        )
    if membership.role != "LEADER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group leader can submit the final proposal.",
        )

    effective_project_id = project_id_query or (
        str(body.project_id) if (body and body.project_id) else None
    )
    project: Optional[Project] = None
    if effective_project_id:
        try:
            project = await Project.find_one(
                Project.id == PydanticObjectId(effective_project_id),
                Project.group_id == membership.group_id,
            )
        except Exception:
            pass
    if not project:
        project = await Project.find_one(
            Project.group_id == membership.group_id,
            Project.is_archived == False,  # noqa: E712
        )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project draft not found.",
        )

    # Validation
    if not project.title or len(project.title) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project title must be at least 5 characters long.",
        )
    if not project.problem_statement or len(project.problem_statement) < 15:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Problem statement must be detailed (at least 15 characters).",
        )
    if not project.tech_stack or len(project.tech_stack) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please specify at least 1 technology in your tech stack.",
        )
    submission_count = getattr(project, "submission_count", 0) or 0
    if submission_count >= 3 and project.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have reached the maximum of 3 proposal submissions.",
        )

    similarity_report = await compute_project_similarity(project, project.id)
    project.similarity_score = similarity_report.get("similarityScore")
    project.similar_projects = similarity_report.get("similarProjects", [])

    next_status = "RESUBMITTED" if project.status == "REVISION_REQUIRED" else "SUBMITTED"
    project.status = next_status
    project.submission_count = submission_count + 1

    status_history = getattr(project, "status_history", []) or []
    status_history.append(
        {
            "status": next_status,
            "changedBy": str(current_user.id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "feedback": "Proposal submitted by group leader for faculty review.",
        }
    )
    project.status_history = status_history

    await project.save()

    # Update group status if needed
    group = await ProjectGroup.get(membership.group_id)
    if group and group.status == "FORMING":
        group.status = "READY_FOR_PROPOSAL"
        await group.save()

    if getattr(project, "faculty_guide_id", None):
        notif = Notification(
            user_id=project.faculty_guide_id,
            title="Proposal Submitted",
            message=f"A proposal for project '{project.title}' has been submitted for your review.",
            type="PROPOSAL_REVIEW"
        )
        await notif.insert()
    else:
        # Notify coordinators that a proposal is awaiting faculty guide assignment
        coordinators = await User.find(User.role == "COORDINATOR").to_list()
        for c in coordinators:
            notif = Notification(
                user_id=c.id,
                title="New Proposal Submitted",
                message=f"Project proposal '{project.title}' has been submitted and is awaiting faculty guide assignment.",
                type="PROPOSAL_REVIEW"
            )
            await notif.insert()

    await log_audit_event(
        actor=current_user,
        action="PROPOSAL_SUBMITTED",
        target_entity="Project",
        target_id=project.id,
        details={
            "title": project.title,
            "similarityScore": project.similarity_score,
        },
        request=request,
    )

    return {
        "success": True,
        "message": "Proposal successfully submitted for faculty guide review!",
        "project": project.model_dump(mode='json', by_alias=True),
    }


# ---------------------------------------------------------------------------
# GET /api/proposals/assigned
# ---------------------------------------------------------------------------


@router.get(
    "/assigned",
    summary="Get assigned proposals for Faculty / Coordinator",
)
async def get_assigned_proposals(
    proposal_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    current_user: User = Depends(require_roles("FACULTY", "COORDINATOR", "ADMIN")),
):
    """Return proposals visible to the calling faculty/coordinator."""
    query: Dict[str, Any] = {}

    if current_user.role == "FACULTY":
        query["$or"] = [
            {"faculty_guide_id": current_user.id},
            {"faculty_guide_id": None, "status": "SUBMITTED"},
            {"faculty_guide_id": None, "status": "RESUBMITTED"},
            {"faculty_guide_id": None, "status": "CHANGE_REQUESTED"},
        ]

    if proposal_status:
        query["status"] = proposal_status

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"domain": {"$regex": search, "$options": "i"}},
            {"project_key": {"$regex": search, "$options": "i"}},
        ]

    proposals = await Project.find(query).sort("-updated_at").to_list()

    # Enrich each proposal with group info
    enriched = []
    for p in proposals:
        p_dict = p.model_dump(mode='json', by_alias=True)
        if p.group_id:
            group = await ProjectGroup.find_one({"_id": p.group_id})
            if group:
                p_dict["group"] = {
                    "id": str(group.id),
                    "_id": str(group.id),
                    "name": group.name,
                    "code": getattr(group, "code", ""),
                }
        enriched.append(p_dict)

    return {
        "success": True,
        "proposals": enriched,
    }


# ---------------------------------------------------------------------------
# POST /api/proposals/{id}/review
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/review",
    summary="Faculty / Coordinator review proposal",
)
async def review_proposal(
    request: Request,
    project_id: PydanticObjectId,
    body: ReviewProposalBody,
    current_user: User = Depends(require_roles("FACULTY", "COORDINATOR", "ADMIN")),
):
    """Approve, request revision, reject, or approve an edit request for a proposal."""
    valid_actions = {"APPROVE", "REQUEST_REVISION", "REJECT", "APPROVE_EDIT_REQUEST"}
    if body.action not in valid_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review action.",
        )

    if body.action in ("REQUEST_REVISION", "REJECT") and (
        not body.feedback or not body.feedback.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback comments are mandatory when requesting revision or rejecting a proposal.",
        )

    project = await Project.get(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project proposal not found.",
        )

    new_status = "UNDER_REVIEW"
    if body.action == "APPROVE":
        new_status = "APPROVED"

    elif body.action == "REQUEST_REVISION":
        new_status = "REVISION_REQUIRED"

    elif body.action == "REJECT":
        new_status = "REJECTED"
        submission_count = getattr(project, "submission_count", 0) or 0
        project.submission_count = max(0, submission_count - 1)

    elif body.action == "APPROVE_EDIT_REQUEST":
        new_status = "CHANGE_APPROVED"
        change_requests = getattr(project, "change_requests", []) or []
        pending_cr = next(
            (cr for cr in change_requests if cr.get("status") == "PENDING"), None
        )
        if pending_cr:
            pending_cr["status"] = "APPROVED"
            project.unlocked_fields = pending_cr.get("fields", [])
        else:
            project.unlocked_fields = [
                "title",
                "domain",
                "tech_stack",
                "problem_statement",
                "objectives",
                "scope",
                "expected_outcome",
                "innovation",
            ]

    project.status = new_status

    if not getattr(project, "faculty_guide_id", None):
        project.faculty_guide_id = current_user.id

    status_history = getattr(project, "status_history", []) or []
    status_history.append(
        {
            "status": new_status,
            "changedBy": str(current_user.id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "feedback": body.feedback or f"Proposal {new_status.lower()} by faculty guide.",
        }
    )
    project.status_history = status_history
    await project.save()

    feedback_doc = ProposalFeedback(
        project_id=project.id,
        given_by=current_user.id,
        feedback=body.feedback or f"Proposal marked as {new_status}.",
        status=new_status,
    )
    await feedback_doc.insert()

    if project.group_id:
        group_members = await GroupMember.find(GroupMember.group_id == project.group_id, GroupMember.status == "ACCEPTED").to_list()
        notifs = []
        for m in group_members:
            notifs.append(
                Notification(
                    user_id=m.user_id,
                    title=f"Proposal {new_status.replace('_', ' ').title()}",
                    message=f"Your proposal for '{project.title}' has been reviewed by your faculty guide.",
                    type="PROPOSAL_UPDATE"
                )
            )
        if notifs:
            await Notification.insert_many(notifs)

    await log_audit_event(
        actor=current_user,
        action=f"PROPOSAL_{body.action}",
        target_entity="Project",
        target_id=project.id,
        details={"action": body.action, "feedback": body.feedback},
        request=request,
    )

    action_display = body.action.lower().replace("_", " ")
    return {
        "success": True,
        "message": f"Proposal {action_display}d successfully.",
        "project": project.model_dump(mode='json', by_alias=True),
    }


# ---------------------------------------------------------------------------
# POST /api/proposals/{id}/assign-guide
# ---------------------------------------------------------------------------


@router.post(
    "/{entity_id}/assign-guide",
    summary="Assign Faculty Guide to Project / Group",
)
async def assign_faculty_guide(
    request: Request,
    entity_id: PydanticObjectId,
    body: AssignGuideBody,
    current_user: User = Depends(require_roles("COORDINATOR", "ADMIN")),
):
    """Assign or remove a faculty member as guide to a project or group."""
    faculty = None
    if body.faculty_guide_id:
        faculty = await User.find_one(
            User.id == body.faculty_guide_id,
            {"role": {"$in": ["FACULTY", "COORDINATOR"]}},
        )
        if not faculty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty guide account not found.",
            )

    group = None
    project = await Project.get(entity_id)
    if project:
        project.faculty_guide_id = body.faculty_guide_id
        await project.save()
        if project.group_id:
            group = await ProjectGroup.get(project.group_id)
            if group:
                group.guide_id = body.faculty_guide_id
                await group.save()
    else:
        group = await ProjectGroup.get(entity_id)
        if group:
            group.guide_id = body.faculty_guide_id
            await group.save()
            group_projects = await Project.find(
                Project.group_id == group.id
            ).to_list()
            for gp in group_projects:
                gp.faculty_guide_id = body.faculty_guide_id
                await gp.save()
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project or Group not found.",
            )

    if faculty:
        notif_faculty = Notification(
            user_id=faculty.id,
            title="Assigned as Faculty Guide",
            message=f"You have been assigned as the faculty guide for group '{group.name if group else ''}'.",
            type="GUIDE_ASSIGNED"
        )
        await notif_faculty.insert()

    if group and faculty:
        members = await GroupMember.find(GroupMember.group_id == group.id, GroupMember.status == "ACCEPTED").to_list()
        student_notifs = [
            Notification(
                user_id=m.user_id,
                title="Faculty Guide Assigned",
                message=f"Dr./Prof. {faculty.name} has been assigned as your faculty guide.",
                type="GUIDE_ASSIGNED"
            ) for m in members
        ]
        if student_notifs:
            await Notification.insert_many(student_notifs)

    await log_audit_event(
        actor=current_user,
        action="FACULTY_GUIDE_ASSIGNED" if faculty else "FACULTY_GUIDE_REMOVED",
        target_entity="Project",
        target_id=entity_id,
        details={
            "facultyGuideId": str(body.faculty_guide_id) if body.faculty_guide_id else None,
            "facultyName": faculty.name if faculty else "None",
        },
        request=request,
    )

    return {
        "success": True,
        "message": f"Assigned Dr./Prof. {faculty.name} as Faculty Guide." if faculty else "Faculty Guide removed successfully.",
        "project": project.model_dump(mode='json', by_alias=True) if project else None,
    }


# ---------------------------------------------------------------------------
# POST /api/proposals/request-edit
# ---------------------------------------------------------------------------


@router.post(
    "/request-edit",
    summary="Request an edit for an Approved Proposal",
)
async def request_edit(
    request: Request,
    body: RequestEditBody,
    current_user: User = Depends(require_roles("STUDENT", "ADMIN")),
):
    """Student leader: request permission to edit an already-approved proposal."""
    membership = await _get_student_membership(current_user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must belong to a group.",
        )

    project: Optional[Project] = None
    if body.project_id:
        project = await Project.find_one(
            Project.id == body.project_id,
            Project.group_id == membership.group_id,
        )
    else:
        project = await Project.find_one(
            Project.group_id == membership.group_id,
            Project.status == "APPROVED",
        )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project draft not found.",
        )
    if project.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved proposals can request an edit.",
        )

    project.status = "CHANGE_REQUESTED"
    change_requests = getattr(project, "change_requests", []) or []
    change_requests.append(
        {
            "fields": body.fields if isinstance(body.fields, list) else [],
            "reason": body.reason or "Student requested to change specific fields.",
            "status": "PENDING",
        }
    )
    project.change_requests = change_requests

    status_history = getattr(project, "status_history", []) or []
    status_history.append(
        {
            "status": "CHANGE_REQUESTED",
            "changedBy": str(current_user.id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "feedback": body.reason or "Student requested to edit the approved proposal.",
        }
    )
    project.status_history = status_history
    await project.save()

    await log_audit_event(
        actor=current_user,
        action="PROPOSAL_EDIT_REQUESTED",
        target_entity="Project",
        target_id=project.id,
        request=request,
    )

    # Notify faculty guide
    if project.faculty_guide_id:
        await Notification(
            user_id=project.faculty_guide_id,
            title="Proposal Edit Request",
            message=f"Group has requested permission to edit the approved proposal '{project.title}'. Please review.",
            type="PROPOSAL_UPDATE",
        ).insert()

    return {
        "success": True,
        "message": "Edit request sent to faculty guide successfully.",
        "project": project.model_dump(mode='json', by_alias=True),
    }

class WithdrawProposalBody(CamelModel):
    project_id: Optional[str] = None


@router.post(
    "/withdraw",
    summary="Withdraw a submitted proposal back to draft for editing",
    dependencies=[Depends(require_roles("STUDENT", "ADMIN"))],
)
async def withdraw_proposal(
    request: Request,
    body: Optional[WithdrawProposalBody] = None,
    project_id_query: Optional[str] = Query(None, alias="projectId"),
    current_user: User = Depends(get_current_user),
):
    """Withdraw a submitted proposal back to DRAFT so students can edit and refine it."""
    membership = await _get_student_membership(current_user.id)
    if not membership or membership.role != "LEADER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group leader can withdraw a proposal.",
        )
    effective_project_id = project_id_query or (body.project_id if body else None)
    project = None
    if effective_project_id:
        try:
            project = await Project.find_one(
                Project.id == PydanticObjectId(effective_project_id),
                Project.group_id == membership.group_id,
            )
        except Exception:
            pass
    if not project:
        project = await Project.find_one(
            Project.group_id == membership.group_id,
            Project.status == "SUBMITTED",
        )

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submitted proposal not found.")

    if project.status != "SUBMITTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only submitted proposals can be withdrawn (current status: {project.status}).",
        )

    project.status = "DRAFT"
    submission_count = getattr(project, "submission_count", 1) or 1
    project.submission_count = max(0, submission_count - 1)
    await project.save()

    return {
        "success": True,
        "message": "Proposal withdrawn to draft. You can now edit and resubmit.",
        "project": project.model_dump(mode="json", by_alias=True),
    }


@router.delete(
    "/{proposal_id}",
    summary="Delete a project proposal slot",
    dependencies=[Depends(require_roles("ADMIN", "COORDINATOR", "STUDENT"))],
)
async def delete_proposal(proposal_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    project = await Project.get(proposal_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )

    if current_user.role == "STUDENT":
        membership = await _get_student_membership(current_user.id)
        if not membership or membership.group_id != project.group_id or membership.role != "LEADER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the group leader can delete a proposal draft slot.",
            )
        if project.status == "APPROVED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Approved proposals cannot be deleted.",
            )
        total_projects = await Project.find(
            Project.group_id == membership.group_id,
            Project.is_archived == False,
        ).count()
        if total_projects <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You must keep at least one proposal slot. You cannot delete the only proposal.",
            )

    await project.delete()

    return {"success": True, "message": "Project proposal slot deleted successfully."}
