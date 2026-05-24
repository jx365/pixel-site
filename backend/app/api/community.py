from datetime import datetime, timezone
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.config import settings
from app.database import get_db
from app.models import (
    Announcement,
    InviteCode,
    ModerationLog,
    Notification,
    RenderResult,
    User,
    Work,
    WorkComment,
    WorkLike,
)
from app.schemas import (
    AnnouncementCreate,
    AnnouncementOut,
    CommentCreate,
    CommentOut,
    LeaderboardItem,
    ModerateRequest,
    ModerationLogOut,
    NotificationOut,
    WorkCreate,
    WorkOut,
)
from app.utils import rel_url

router = APIRouter(prefix="/community", tags=["community"])


def utc_day_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).replace(tzinfo=None)


def create_notification(
    db: Session,
    user_id: int,
    category: str,
    title: str,
    content: str,
    related_type: str | None = None,
    related_id: int | None = None,
):
    note = Notification(
        user_id=user_id,
        category=category,
        title=title,
        content=content,
        related_type=related_type,
        related_id=related_id,
    )
    db.add(note)


def work_to_out(db: Session, work: Work, viewer_id: int | None = None) -> WorkOut:
    author = db.get(User, work.user_id)
    is_liked = False
    if viewer_id:
        is_liked = (
            db.query(WorkLike)
            .filter(WorkLike.work_id == work.id, WorkLike.user_id == viewer_id)
            .first()
            is not None
        )
    return WorkOut(
        id=work.id,
        user_id=work.user_id,
        author_name=author.display_name if author else "未知用户",
        title=work.title,
        description=work.description,
        image_url=work.image_url,
        like_count=work.like_count,
        comment_count=work.comment_count,
        status=work.status,
        removed_reason=work.removed_reason,
        created_at=work.created_at,
        is_liked=is_liked,
    )


@router.get("/works", response_model=list[WorkOut])
def list_works(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    works = (
        db.query(Work)
        .filter(Work.status == "published")
        .order_by(Work.created_at.desc())
        .limit(200)
        .all()
    )
    return [work_to_out(db, w, user.id) for w in works]


@router.post("/works", response_model=WorkOut)
def publish_work(
    body: WorkCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    result = db.get(RenderResult, body.result_id)
    if not result or result.user_id != user.id:
        raise HTTPException(status_code=404, detail="渲染结果不存在")

    if user.is_guest:
        today = utc_day_start()
        today_count = (
            db.query(func.count(Work.id))
            .filter(Work.user_id == user.id, Work.created_at >= today)
            .scalar()
        )
        if today_count >= settings.guest_daily_work_limit:
            raise HTTPException(
                status_code=400,
                detail=f"游客账号每天最多发布 {settings.guest_daily_work_limit} 个作品",
            )

    if db.query(Work).filter(Work.result_id == result.id).first():
        raise HTTPException(status_code=400, detail="该渲染结果已发布")

    work = Work(
        user_id=user.id,
        result_id=result.id,
        title=body.title.strip(),
        description=body.description,
        image_url=rel_url(result.preview_path or result.thumb_path or ""),
    )
    db.add(work)
    db.commit()
    db.refresh(work)
    return work_to_out(db, work, user.id)


@router.get("/works/{work_id}", response_model=WorkOut)
def get_work(
    work_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    work = db.get(Work, work_id)
    if not work or work.status != "published":
        raise HTTPException(status_code=404, detail="作品不存在")
    return work_to_out(db, work, user.id)


@router.get("/works/{work_id}/comments", response_model=list[CommentOut])
def list_comments(
    work_id: int,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    comments = (
        db.query(WorkComment)
        .filter(WorkComment.work_id == work_id, WorkComment.status == "published")
        .order_by(WorkComment.created_at.asc())
        .all()
    )
    out: list[CommentOut] = []
    for c in comments:
        author = db.get(User, c.user_id)
        out.append(
            CommentOut(
                id=c.id,
                work_id=c.work_id,
                user_id=c.user_id,
                author_name=author.display_name if author else "未知用户",
                content=c.content,
                status=c.status,
                removed_reason=c.removed_reason,
                created_at=c.created_at,
            )
        )
    return out


@router.post("/works/{work_id}/comments", response_model=CommentOut)
def add_comment(
    work_id: int,
    body: CommentCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    work = db.get(Work, work_id)
    if not work or work.status != "published":
        raise HTTPException(status_code=404, detail="作品不存在")
    comment = WorkComment(work_id=work_id, user_id=user.id, content=body.content.strip())
    work.comment_count += 1
    db.add(comment)
    if work.user_id != user.id:
        create_notification(
            db,
            user_id=work.user_id,
            category="comment",
            title="你收到了新评论",
            content=f"{user.display_name} 评论了你的作品《{work.title}》",
            related_type="work",
            related_id=work.id,
        )
    db.commit()
    db.refresh(comment)
    return CommentOut(
        id=comment.id,
        work_id=comment.work_id,
        user_id=comment.user_id,
        author_name=user.display_name,
        content=comment.content,
        status=comment.status,
        removed_reason=comment.removed_reason,
        created_at=comment.created_at,
    )


@router.post("/works/{work_id}/like")
def like_work(
    work_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    work = db.get(Work, work_id)
    if not work or work.status != "published":
        raise HTTPException(status_code=404, detail="作品不存在")
    existing = db.query(WorkLike).filter(WorkLike.work_id == work_id, WorkLike.user_id == user.id).first()
    if existing:
        return {"ok": True, "liked": True, "like_count": work.like_count}
    like = WorkLike(work_id=work_id, user_id=user.id)
    work.like_count += 1
    db.add(like)
    if work.user_id != user.id:
        create_notification(
            db,
            user_id=work.user_id,
            category="like",
            title="你收到了一个赞",
            content=f"{user.display_name} 赞了你的作品《{work.title}》",
            related_type="work",
            related_id=work.id,
        )
    db.commit()
    return {"ok": True, "liked": True, "like_count": work.like_count}


@router.delete("/works/{work_id}/like")
def unlike_work(
    work_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    work = db.get(Work, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="作品不存在")
    existing = db.query(WorkLike).filter(WorkLike.work_id == work_id, WorkLike.user_id == user.id).first()
    if not existing:
        return {"ok": True, "liked": False, "like_count": work.like_count}
    db.delete(existing)
    work.like_count = max(0, work.like_count - 1)
    db.commit()
    return {"ok": True, "liked": False, "like_count": work.like_count}


@router.get("/leaderboard/likes", response_model=list[LeaderboardItem])
def like_leaderboard(db: Annotated[Session, Depends(get_db)]):
    rows = (
        db.query(Work.user_id, func.sum(Work.like_count))
        .filter(Work.status == "published")
        .group_by(Work.user_id)
        .order_by(func.sum(Work.like_count).desc())
        .limit(20)
        .all()
    )
    result: list[LeaderboardItem] = []
    for user_id, likes in rows:
        user = db.get(User, user_id)
        result.append(LeaderboardItem(user_id=user_id, display_name=user.display_name if user else "未知", likes=int(likes or 0)))
    return result


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    notes = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
        .order_by(Notification.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        NotificationOut(
            id=n.id,
            category=n.category,
            title=n.title,
            content=n.content,
            related_type=n.related_type,
            related_id=n.related_id,
            created_at=n.created_at,
            is_read=n.is_read,
        )
        for n in notes
    ]


@router.post("/notifications/read-all")
def read_all_notifications(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    notes = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).all()
    now = datetime.utcnow()
    for n in notes:
        n.is_read = True
        n.read_at = now
    db.commit()
    return {"ok": True, "count": len(notes)}


@router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements(db: Annotated[Session, Depends(get_db)]):
    anns = db.query(Announcement).order_by(Announcement.created_at.desc()).limit(20).all()
    return [AnnouncementOut(id=a.id, admin_user_id=a.admin_user_id, title=a.title, content=a.content, created_at=a.created_at) for a in anns]


@router.post("/admin/announcements", response_model=AnnouncementOut)
def create_announcement(
    body: AnnouncementCreate,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    ann = Announcement(admin_user_id=admin.id, title=body.title.strip(), content=body.content.strip())
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return AnnouncementOut(
        id=ann.id,
        admin_user_id=ann.admin_user_id,
        title=ann.title,
        content=ann.content,
        created_at=ann.created_at,
    )


@router.post("/admin/invite-codes")
def create_invite_code(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    code = f"ADMIN-{uuid.uuid4().hex[:10].upper()}"
    item = InviteCode(code=code, role_to_grant="admin", is_active=True)
    db.add(item)
    db.commit()
    return {"code": code, "created_by": admin.id}


@router.post("/admin/works/{work_id}/remove")
def remove_work(
    work_id: int,
    body: ModerateRequest,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    work = db.get(Work, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="作品不存在")
    work.status = "removed"
    work.removed_reason = body.reason
    create_notification(
        db,
        user_id=work.user_id,
        category="moderation",
        title="你的作品已下架",
        content=body.reason,
        related_type="work",
        related_id=work.id,
    )
    db.add(
        ModerationLog(
            admin_user_id=admin.id,
            target_user_id=work.user_id,
            target_type="work",
            target_id=work.id,
            action="remove",
            reason=body.reason,
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/admin/comments/{comment_id}/remove")
def remove_comment(
    comment_id: int,
    body: ModerateRequest,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    comment = db.get(WorkComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    comment.status = "removed"
    comment.removed_reason = body.reason
    create_notification(
        db,
        user_id=comment.user_id,
        category="moderation",
        title="你的评论已下架",
        content=body.reason,
        related_type="comment",
        related_id=comment.id,
    )
    db.add(
        ModerationLog(
            admin_user_id=admin.id,
            target_user_id=comment.user_id,
            target_type="comment",
            target_id=comment.id,
            action="remove",
            reason=body.reason,
        )
    )
    db.commit()
    return {"ok": True}


@router.get("/admin/moderation-logs", response_model=list[ModerationLogOut])
def list_moderation_logs(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    logs = db.query(ModerationLog).order_by(ModerationLog.created_at.desc()).limit(200).all()
    return [
        ModerationLogOut(
            id=l.id,
            admin_user_id=l.admin_user_id,
            target_user_id=l.target_user_id,
            target_type=l.target_type,
            target_id=l.target_id,
            action=l.action,
            reason=l.reason,
            created_at=l.created_at,
        )
        for l in logs
    ]
