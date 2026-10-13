from app.core.schemas import CamelModel
"""
FastAPI router for Collaboration features.
Converted from collaborationController.js + collaborationRoutes.js.

Covers:
  - Milestones (FR-1001 & FR-1002)
  - Wiki Pages (FR-1101)
  - Team Chat (FR-1102)
  - Files & Docs (FR-1103 & FR-1104)

Prefix: /api/collaboration
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.core.security import get_current_user, require_roles
from app.models.milestone import Milestone
from app.models.wiki_page import WikiPage
from app.models.chat_message import ChatMessage
from app.models.project_file import ProjectFile
from app.models.project import Project
from app.models.group_member import GroupMember
from app.utils.audit_logger import log_audit_event

router = APIRouter(prefix="/api/collaboration", tags=["Collaboration"])


# ---------------------------------------------------------------------------
# Helper: resolve the active project ID for the authenticated user.
# Students are linked via GroupMember → Project; Faculty/Admin pass projectId
# as a query-param or body field.
# ---------------------------------------------------------------------------

async def resolve_project_id(request: Request, current_user: dict) -> Optional[PydanticObjectId]:
    """
    Mirrors resolveAndVerifyProjectId from Node.js utils/projectAccess.js.
    For STUDENT: look up their active GroupMember record to find the project.
    For others: read projectId from query params or request body.
    """
    role = current_user.get("role", "")
    user_id = current_user.id

    if role == "STUDENT":
        membership = await GroupMember.find_one(GroupMember.user_id == PydanticObjectId(user_id))
        if not membership:
            return None
        project = await Project.find_one(Project.group_id == membership.group_id)
        if not project:
            return None
        return project.id

    # Non-student: read from query or body
    project_id_str = request.query_params.get("projectId")
    if not project_id_str:
        try:
            body = await request.json()
            project_id_str = body.get("projectId")
        except Exception:
            pass
    if project_id_str:
        try:
            return PydanticObjectId(project_id_str)
        except Exception:
            return None
    return None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================
# REQUEST BODY SCHEMAS
# ============================================================

class MilestoneCreate(CamelModel):
    title: str
    description: Optional[str] = None
    startDate: Optional[datetime] = None
    targetDate: Optional[datetime] = None
    progressPercentage: Optional[int] = 0
    status: Optional[str] = "NOT_STARTED"


class MilestoneUpdate(CamelModel):
    title: Optional[str] = None
    description: Optional[str] = None
    startDate: Optional[datetime] = None
    targetDate: Optional[datetime] = None
    progressPercentage: Optional[int] = None
    status: Optional[str] = None
    requirements: Optional[List[Dict[str, Any]]] = None
    expectedProgress: Optional[int] = None
    type: Optional[str] = None


class WikiPageSave(CamelModel):
    _id: Optional[str] = None
    title: str
    content: str
    category: Optional[str] = "Technical Documentation"
    attachmentUrl: Optional[str] = ""


class ChatMessageCreate(CamelModel):
    projectId: Optional[str] = None
    content: Optional[str] = ""
    channelType: Optional[str] = "GROUP"
    receiverId: Optional[str] = None
    attachmentUrl: Optional[str] = ""
    replyToId: Optional[str] = None


class ChatMessageUpdate(CamelModel):
    content: str


class FileUpload(CamelModel):
    name: str
    fileUrl: Optional[str] = None
    category: Optional[str] = "REPORT"
    size: Optional[int] = 102400
    mimeType: Optional[str] = "application/pdf"


# ============================================================
# MILESTONES (FR-1001 & FR-1002)
# ============================================================

@router.get("/milestones", summary="Get milestones for the active project")
async def get_milestones(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return milestones sorted by targetDate. Seeds default templates if none exist."""
    project_id = await resolve_project_id(request, current_user)
    if not project_id:
        return {"success": True, "milestones": []}

    milestones = await Milestone.find(
        Milestone.project_id == project_id
    ).sort(+Milestone.target_date).to_list()

    if not milestones:
        # Seed default milestone templates
        _now = now_utc()
        default_templates = [
            Milestone(
                project_id=project_id,
                title="Milestone 1: Proposal Submission & Approval",
                target_date=_now + timedelta(days=7),
                start_date=_now,
                progress_percentage=100,
                status="COMPLETED",
                type="OFFICIAL",
                expected_progress=100,
                requirements=[
                    {"text": "Finalize Project Topic", "isCompleted": True},
                    {"text": "Form Project Group", "isCompleted": True},
                    {"text": "Prepare Project Proposal", "isCompleted": True},
                    {"text": "Submit Proposal", "isCompleted": True},
                ],
            ),
            Milestone(
                project_id=project_id,
                title="Milestone 2: SRS Requirements & Architecture Design",
                target_date=_now + timedelta(days=21),
                start_date=_now + timedelta(days=8),
                progress_percentage=50,
                status="IN_PROGRESS",
                type="OFFICIAL",
                expected_progress=25,
                requirements=[
                    {"text": "Complete SRS Document", "isCompleted": True},
                    {"text": "Create Use Case Diagram", "isCompleted": True},
                    {"text": "Create Database Design", "isCompleted": False},
                    {"text": "Complete System Architecture", "isCompleted": False},
                ],
            ),
            Milestone(
                project_id=project_id,
                title="Milestone 3: Development & Mid-Term Review",
                target_date=_now + timedelta(days=45),
                start_date=_now + timedelta(days=22),
                progress_percentage=0,
                status="NOT_STARTED",
                type="OFFICIAL",
                expected_progress=50,
                requirements=[
                    {"text": "Complete Core Features", "isCompleted": False},
                    {"text": "Complete User Interface", "isCompleted": False},
                    {"text": "Complete Backend Integration", "isCompleted": False},
                    {"text": "Prepare Mid-Term Presentation", "isCompleted": False},
                ],
            ),
            Milestone(
                project_id=project_id,
                title="Milestone 4: Final Testing & Academic Report",
                target_date=_now + timedelta(days=60),
                start_date=_now + timedelta(days=46),
                progress_percentage=0,
                status="NOT_STARTED",
                type="OFFICIAL",
                expected_progress=100,
                requirements=[
                    {"text": "Testing & QA", "isCompleted": False},
                    {"text": "Deployment", "isCompleted": False},
                    {"text": "Final Report Generation", "isCompleted": False},
                    {"text": "Final Presentation", "isCompleted": False},
                ],
            ),
        ]
        for m in default_templates:
            await m.insert()
        milestones = default_templates

    return {"success": True, "milestones": [m.dict() for m in milestones]}


@router.post(
    "/milestones",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new milestone",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN"]))],
)
async def create_milestone(
    body: MilestoneCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a milestone for the current user's active project."""
    project_id = await resolve_project_id(request, current_user)
    if not project_id:
        raise HTTPException(status_code=400, detail="Active project required.")

    milestone = Milestone(
        project_id=project_id,
        title=body.title,
        description=body.description,
        start_date=body.startDate,
        target_date=body.targetDate,
        progress_percentage=body.progressPercentage or 0,
        status=body.status or "NOT_STARTED",
    )
    await milestone.insert()
    return {"success": True, "milestone": milestone.dict()}


@router.put(
    "/milestones/{id}",
    summary="Update a milestone",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN", "FACULTY", "COORDINATOR"]))],
)
async def update_milestone(
    id: str,
    body: MilestoneUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Update a milestone belonging to the current project."""
    project_id = await resolve_project_id(request, current_user)

    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid milestone ID.")

    milestone = await Milestone.find_one(
        Milestone.id == oid,
        Milestone.project_id == project_id,
    )
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found or unauthorized.")

    update_data = body.dict(exclude_none=True)
    for field, value in update_data.items():
        # Convert camelCase keys to snake_case field names
        snake = _to_snake(field)
        if hasattr(milestone, snake):
            setattr(milestone, snake, value)
        elif hasattr(milestone, field):
            setattr(milestone, field, value)

    await milestone.save()
    return {"success": True, "milestone": milestone.dict()}


@router.delete(
    "/milestones/{id}",
    summary="Delete a milestone",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN"]))],
)
async def delete_milestone(
    id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a milestone belonging to the current project."""
    project_id = await resolve_project_id(request, current_user)
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid milestone ID.")

    milestone = await Milestone.find_one(
        Milestone.id == oid,
        Milestone.project_id == project_id,
    )
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found or unauthorized.")

    await milestone.delete()
    return {"success": True, "message": "Milestone deleted successfully."}


# ============================================================
# WIKI PAGES (FR-1101)
# ============================================================

@router.get("/wiki", summary="Get wiki pages for the active project")
async def get_wiki_pages(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return all wiki pages sorted by updatedAt descending."""
    project_id = await resolve_project_id(request, current_user)
    if not project_id:
        return {"success": True, "wikiPages": []}

    pages = await WikiPage.find(
        WikiPage.project_id == project_id
    ).sort(-WikiPage.updated_at).to_list()

    return {"success": True, "wikiPages": [p.dict() for p in pages]}


@router.post(
    "/wiki",
    summary="Create or update a wiki page",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN"]))],
)
async def save_wiki_page(
    body: WikiPageSave,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Upsert a wiki page: match by _id (if provided) then by slug."""
    project_id = await resolve_project_id(request, current_user)
    if not project_id:
        raise HTTPException(status_code=400, detail="Active project required.")

    user_id = PydanticObjectId(current_user.id)
    slug = body.title.lower()
    import re
    slug = re.sub(r"[^a-z0-9]", "-", slug)

    page: Optional[WikiPage] = None

    # Try match by _id first
    body_id = body.dict().get("_id")
    if body_id:
        try:
            page = await WikiPage.find_one(
                WikiPage.id == PydanticObjectId(body_id),
                WikiPage.project_id == project_id,
            )
        except Exception:
            pass

    # Fallback: match by slug
    if not page:
        page = await WikiPage.find_one(
            WikiPage.project_id == project_id,
            WikiPage.slug == slug,
        )

    if page:
        page.title = body.title
        page.content = body.content
        page.category = body.category or "Technical Documentation"
        page.attachment_url = body.attachmentUrl or ""
        await page.save()
    else:
        page = WikiPage(
            project_id=project_id,
            title=body.title,
            slug=slug,
            category=body.category or "Technical Documentation",
            attachment_url=body.attachmentUrl or "",
            content=body.content,
            author_id=user_id,
        )
        await page.insert()

    return {"success": True, "wikiPage": page.dict()}


@router.delete(
    "/wiki/{id}",
    summary="Delete a wiki page",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN"]))],
)
async def delete_wiki_page(
    id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a wiki page belonging to the current project."""
    project_id = await resolve_project_id(request, current_user)
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid wiki page ID.")

    page = await WikiPage.find_one(
        WikiPage.id == oid,
        WikiPage.project_id == project_id,
    )
    if not page:
        raise HTTPException(status_code=404, detail="Wiki page not found or unauthorized.")

    await page.delete()
    return {"success": True, "message": "Wiki page deleted successfully."}


# ============================================================
# TEAM CHAT (FR-1102)
# ============================================================

@router.get("/chat", summary="Get chat messages")
async def get_chat_messages(
    request: Request,
    projectId: Optional[str] = Query(None),
    channelType: Optional[str] = Query("GROUP"),
    receiverId: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Fetch chat messages for the project/channel.
    Students auto-resolve their project; faculty/admin pass projectId explicitly.
    """
    role = current_user.get("role", "")
    user_id = PydanticObjectId(current_user.id)

    project_id: Optional[PydanticObjectId] = None

    if role == "STUDENT":
        project_id = await resolve_project_id(request, current_user)
        if projectId and str(project_id) != projectId:
            raise HTTPException(status_code=403, detail="Access denied to this project chat.")
    else:
        if not projectId:
            raise HTTPException(status_code=400, detail="Project ID required.")
        project_id = PydanticObjectId(projectId)

        if role == "FACULTY":
            project = await Project.get(project_id)
            if not project or str(project.faculty_guide_id) != str(user_id):
                raise HTTPException(
                    status_code=403, detail="Access denied. Not assigned to this project."
                )

    if not project_id:
        return {"success": True, "messages": []}

    query_filter: List[Any] = [
        ChatMessage.project_id == project_id,
        ChatMessage.channel_type == (channelType or "GROUP"),
    ]

    if channelType == "PERSONAL":
        if not receiverId:
            raise HTTPException(
                status_code=400, detail="Receiver ID required for personal chat."
            )
        receiver_oid = PydanticObjectId(receiverId)
        # We replicate the $or with two find calls and merge, as Beanie doesn't natively support $or easily
        msgs_sent = await ChatMessage.find(
            ChatMessage.project_id == project_id,
            ChatMessage.channel_type == "PERSONAL",
            ChatMessage.sender_id == user_id,
            ChatMessage.receiver_id == receiver_oid,
        ).sort(+ChatMessage.created_at).to_list()

        msgs_recv = await ChatMessage.find(
            ChatMessage.project_id == project_id,
            ChatMessage.channel_type == "PERSONAL",
            ChatMessage.sender_id == receiver_oid,
            ChatMessage.receiver_id == user_id,
        ).sort(+ChatMessage.created_at).to_list()

        messages = sorted(msgs_sent + msgs_recv, key=lambda m: m.created_at or datetime.min)

        active_proj = await Project.get(project_id)
        proj_dict = None
        if active_proj:
            group_dict = None
            if active_proj.group_id:
                g = await ProjectGroup.get(active_proj.group_id)
                if g:
                    group_dict = {"_id": str(g.id), "name": g.name, "code": g.code}
            proj_dict = {
                "_id": str(active_proj.id),
                "title": active_proj.title,
                "projectKey": active_proj.project_key,
                "domain": active_proj.domain,
                "status": active_proj.status,
                "group": group_dict,
            }

        return {"success": True, "messages": [m.dict() for m in messages], "project": proj_dict}

    # GROUP / FACULTY channels
    messages = await ChatMessage.find(*query_filter).sort(+ChatMessage.created_at).to_list()

    # Mark as read
    for msg in messages:
        if msg.sender_id != user_id and user_id not in (msg.read_by or []):
            msg.read_by = list(msg.read_by or []) + [user_id]
            await msg.save()

    active_proj = await Project.get(project_id)
    proj_dict = None
    if active_proj:
        group_dict = None
        if active_proj.group_id:
            g = await ProjectGroup.get(active_proj.group_id)
            if g:
                group_dict = {"_id": str(g.id), "name": g.name, "code": g.code}
        proj_dict = {
            "_id": str(active_proj.id),
            "title": active_proj.title,
            "projectKey": active_proj.project_key,
            "domain": active_proj.domain,
            "status": active_proj.status,
            "group": group_dict,
        }

    return {"success": True, "messages": [m.dict() for m in messages], "project": proj_dict}


@router.get("/chat/unread", summary="Get unread chat message counts")
async def get_chat_unread_counts(
    request: Request,
    projectId: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return per-channel unread message counts for the current user."""
    role = current_user.get("role", "")
    user_id = PydanticObjectId(current_user.id)

    project_id: Optional[PydanticObjectId] = None
    if role == "STUDENT":
        project_id = await resolve_project_id(request, current_user)
    else:
        if projectId:
            project_id = PydanticObjectId(projectId)

    if not project_id:
        return {"success": True, "counts": {}}

    unread = await ChatMessage.find(
        ChatMessage.project_id == project_id,
        ChatMessage.sender_id != user_id,
        ChatMessage.is_deleted == False,
    ).to_list()

    # Filter those not read by current user
    unread = [m for m in unread if user_id not in (m.read_by or [])]

    counts: Dict[str, Any] = {"GROUP": 0, "FACULTY": 0, "PERSONAL": {}}
    for msg in unread:
        if msg.channel_type == "GROUP":
            counts["GROUP"] += 1
        elif msg.channel_type == "FACULTY":
            counts["FACULTY"] += 1
        elif msg.channel_type == "PERSONAL":
            sender = str(msg.sender_id)
            counts["PERSONAL"][sender] = counts["PERSONAL"].get(sender, 0) + 1

    return {"success": True, "counts": counts, "total": len(unread)}


@router.post(
    "/chat",
    status_code=status.HTTP_201_CREATED,
    summary="Send a chat message",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN", "FACULTY", "COORDINATOR"]))],
)
async def send_chat_message(
    body: ChatMessageCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create and return a new chat message."""
    role = current_user.get("role", "")
    user_id = PydanticObjectId(current_user.id)

    project_id: Optional[PydanticObjectId] = None
    if role == "STUDENT":
        project_id = await resolve_project_id(request, current_user)
        if body.projectId and str(project_id) != body.projectId:
            raise HTTPException(status_code=403, detail="Access denied.")
    else:
        if not body.projectId:
            raise HTTPException(status_code=400, detail="Project ID required.")
        project_id = PydanticObjectId(body.projectId)

    if not project_id:
        raise HTTPException(status_code=400, detail="Active project required.")

    if not (body.content or "").strip() and not body.attachmentUrl:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    channel = body.channelType or "GROUP"
    receiver_id = PydanticObjectId(body.receiverId) if channel == "PERSONAL" and body.receiverId else None
    reply_to_id = PydanticObjectId(body.replyToId) if body.replyToId else None

    message = ChatMessage(
        project_id=project_id,
        channel_type=channel,
        sender_id=user_id,
        receiver_id=receiver_id,
        content=body.content or "",
        attachment_url=body.attachmentUrl or "",
        reply_to_id=reply_to_id,
        read_by=[user_id],
    )
    await message.insert()
    return {"success": True, "message": message.dict()}


@router.put(
    "/chat/{id}",
    summary="Edit a chat message",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN", "FACULTY", "COORDINATOR"]))],
)
async def update_chat_message(
    id: str,
    body: ChatMessageUpdate,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Only the sender can update their own message."""
    user_id = PydanticObjectId(current_user.id)
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message ID.")

    msg = await ChatMessage.find_one(
        ChatMessage.id == oid,
        ChatMessage.sender_id == user_id,
        ChatMessage.is_deleted == False,
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or unauthorized.")

    msg.content = body.content
    msg.is_edited = True
    await msg.save()
    return {"success": True, "message": msg.dict()}


@router.delete(
    "/chat/{id}",
    summary="Soft-delete a chat message",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN", "FACULTY", "COORDINATOR"]))],
)
async def delete_chat_message(
    id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Soft-delete: mark message as deleted instead of removing it."""
    user_id = PydanticObjectId(current_user.id)
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message ID.")

    msg = await ChatMessage.find_one(
        ChatMessage.id == oid,
        ChatMessage.sender_id == user_id,
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or unauthorized.")

    msg.is_deleted = True
    msg.content = "This message was deleted"
    await msg.save()
    return {"success": True, "message": msg.dict()}


# ============================================================
# FILES & DOCS (FR-1103 & FR-1104)
# ============================================================

@router.get("/files", summary="Get project files")
async def get_files(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return all files for the active project, sorted newest first."""
    project_id = await resolve_project_id(request, current_user)
    if not project_id:
        return {"success": True, "files": []}

    files = await ProjectFile.find(
        ProjectFile.project_id == project_id
    ).sort(-ProjectFile.created_at).to_list()

    return {"success": True, "files": [f.dict() for f in files]}


@router.post(
    "/files",
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file record",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN"]))],
)
async def upload_file_record(
    body: FileUpload,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a project file metadata record (actual upload handled by client)."""
    project_id = await resolve_project_id(request, current_user)
    if not project_id:
        raise HTTPException(status_code=400, detail="Active project required.")

    user_id = PydanticObjectId(current_user.id)
    import urllib.parse

    file_doc = ProjectFile(
        project_id=project_id,
        name=body.name,
        file_url=body.fileUrl
        or f"https://teamsync.institution.edu/storage/{urllib.parse.quote(body.name)}",
        category=body.category or "REPORT",
        size=body.size or 102400,
        mime_type=body.mimeType or "application/pdf",
        uploader_id=user_id,
    )
    await file_doc.insert()
    return {"success": True, "file": file_doc.dict()}


@router.get("/files/{id}/download", summary="Get file download URL")
async def download_file(
    id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return a download URL for a project file; validates student access."""
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID.")

    file_doc = await ProjectFile.get(oid)
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")

    role = current_user.get("role", "")
    user_id = PydanticObjectId(current_user.id)

    if role == "STUDENT":
        student_project_id = await resolve_project_id(request, current_user)
        if str(student_project_id) != str(file_doc.project_id):
            raise HTTPException(
                status_code=403, detail="Unauthorized access to project document."
            )

    return {
        "success": True,
        "downloadUrl": file_doc.file_url,
        "fileName": file_doc.name,
    }


@router.delete(
    "/files/{id}",
    summary="Delete a project file",
    dependencies=[Depends(require_roles(["STUDENT", "ADMIN"]))],
)
async def delete_file(
    id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a file record belonging to the current project."""
    project_id = await resolve_project_id(request, current_user)
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID.")

    file_doc = await ProjectFile.find_one(
        ProjectFile.id == oid,
        ProjectFile.project_id == project_id,
    )
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found or unauthorized.")

    await file_doc.delete()
    return {"success": True, "message": "File deleted successfully."}


# ============================================================
# UTILITY
# ============================================================

def _to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    import re
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()
