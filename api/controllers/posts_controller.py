from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from accounts.models import get_user_display_name
from matching.models import UserPost, PostComment, MentoringSession, MenteeMentorRequest

from ..views import (
    audit_log,
    _get_payload,
    _get_str,
    logger,
)


def _get_author_avatar(user):
    mp = getattr(user, "mentor_profile", None)
    if mp and getattr(mp, "avatar_url", ""):
        return mp.avatar_url
    me = getattr(user, "mentee_profile", None)
    if me and getattr(me, "avatar_url", ""):
        return me.avatar_url
    return ""


def _serialize_post(post, request_user=None):
    image_url = ""
    if post.image:
        image_url = post.image.url
    author_display_name = get_user_display_name(post.author) or post.author.username
    return {
        "id": post.id,
        "author_id": post.author_id,
        "author_username": post.author.username,
        "author_display_name": author_display_name,
        "author_avatar": _get_author_avatar(post.author),
        "text": post.text,
        "image_url": image_url,
        "category": post.category,
        "likes_count": post.likes.count(),
        "liked_by_me": request_user.id in post.likes.values_list("id", flat=True) if request_user else False,
        "comments_count": post.comments.count(),
        "created_at": post.created_at.isoformat(),
    }


def _serialize_comment(comment):
    author_display_name = get_user_display_name(comment.author) or comment.author.username
    return {
        "id": comment.id,
        "author_id": comment.author_id,
        "author_username": comment.author.username,
        "author_display_name": author_display_name,
        "author_avatar": _get_author_avatar(comment.author),
        "content": comment.content,
        "created_at": comment.created_at.isoformat(),
    }


POSTS_PAGE_SIZE = 10
POSTS_MAX_PAGE_SIZE = 50


@login_required
@require_GET
def posts_list(request):
    """List posts for a user. ?user_id= for specific user, else current user. Supports limit & offset (Facebook-style pagination)."""
    try:
        limit = min(int(request.GET.get("limit", POSTS_PAGE_SIZE)), POSTS_MAX_PAGE_SIZE)
        offset = max(0, int(request.GET.get("offset", 0)))
    except (TypeError, ValueError):
        limit, offset = POSTS_PAGE_SIZE, 0

    user_id = request.GET.get("user_id")
    if user_id:
        qs = UserPost.objects.filter(author_id=int(user_id)).select_related("author").order_by("-created_at")
    else:
        qs = UserPost.objects.filter(author=request.user).select_related("author").order_by("-created_at")

    total = qs.count()
    posts = list(qs[offset : offset + limit + 1])
    has_more = len(posts) > limit
    if has_more:
        posts = posts[:limit]
    return JsonResponse({
        "posts": [_serialize_post(p, request.user) for p in posts],
        "has_more": has_more,
        "total": total,
    })


@login_required
@require_GET
def posts_feed(request):
    """Feed: posts from the current user and their mentoring connections."""
    user = request.user
    connected_ids = set()
    connected_ids.add(user.id)

    mentor_profile = getattr(user, "mentor_profile", None)
    mentee_profile = getattr(user, "mentee_profile", None)

    if mentor_profile:
        mentee_user_ids = (
            MenteeMentorRequest.objects.filter(mentor=mentor_profile, accepted=True)
            .select_related("mentee__user")
            .values_list("mentee__user_id", flat=True)
        )
        connected_ids.update(mentee_user_ids)

    if mentee_profile:
        mentor_user_ids = (
            MenteeMentorRequest.objects.filter(mentee=mentee_profile, accepted=True)
            .select_related("mentor__user")
            .values_list("mentor__user_id", flat=True)
        )
        connected_ids.update(mentor_user_ids)

    qs = (
        UserPost.objects.filter(author_id__in=connected_ids)
        .select_related("author")
        .order_by("-created_at")
    )
    try:
        limit = min(int(request.GET.get("limit", POSTS_PAGE_SIZE)), POSTS_MAX_PAGE_SIZE)
        offset = max(0, int(request.GET.get("offset", 0)))
    except (TypeError, ValueError):
        limit, offset = POSTS_PAGE_SIZE, 0

    total = qs.count()
    posts = list(qs[offset : offset + limit + 1])
    has_more = len(posts) > limit
    if has_more:
        posts = posts[:limit]
    return JsonResponse({
        "posts": [_serialize_post(p, user) for p in posts],
        "has_more": has_more,
        "total": total,
    })


@login_required
@require_http_methods(["POST"])
def post_create(request):
    text = request.POST.get("text", "").strip()
    category = request.POST.get("category", "update")
    if category not in ("achievement", "project", "update"):
        category = "update"
    image = request.FILES.get("image")

    if not text and not image:
        return JsonResponse({"error": "Post must have text or an image."}, status=400)

    post = UserPost.objects.create(
        author=request.user,
        text=text,
        category=category,
        image=image,
    )
    audit_log(request.user, "create", "post", post.id)
    logger.info("post_created", extra={"post_id": post.id, "user_id": request.user.id})
    return JsonResponse({"post": _serialize_post(post, request.user)})


@login_required
@require_GET
def post_detail(request, post_id):
    """Return a single post by id (e.g. for opening from gallery)."""
    post = UserPost.objects.filter(id=post_id).select_related("author").first()
    if not post:
        return JsonResponse({"error": "Post not found."}, status=404)
    return JsonResponse({"post": _serialize_post(post, request.user)})


@login_required
@require_http_methods(["POST"])
def post_like(request, post_id):
    post = UserPost.objects.filter(id=post_id).first()
    if not post:
        return JsonResponse({"error": "Post not found."}, status=404)

    if request.user in post.likes.all():
        post.likes.remove(request.user)
        liked = False
        audit_log(request.user, "unlike", "post", post.id)
    else:
        post.likes.add(request.user)
        liked = True
        audit_log(request.user, "like", "post", post.id)

    return JsonResponse({
        "liked": liked,
        "likes_count": post.likes.count(),
    })


@login_required
@require_http_methods(["POST"])
def post_delete(request, post_id):
    post = UserPost.objects.filter(id=post_id, author=request.user).first()
    if not post:
        return JsonResponse({"error": "Post not found or not yours."}, status=404)
    deleted_post_id = post.id
    post.delete()
    audit_log(request.user, "delete", "post", deleted_post_id)
    return JsonResponse({"status": "ok"})


@login_required
@require_GET
def gallery(request):
    """Return all image posts for a user (gallery view)."""
    user_id = request.GET.get("user_id", request.user.id)
    posts = (
        UserPost.objects.filter(author_id=int(user_id))
        .exclude(image="")
        .exclude(image__isnull=True)
        .select_related("author")
        .order_by("-created_at")[:100]
    )
    return JsonResponse({
        "images": [
            {
                "id": p.id,
                "image_url": p.image.url if p.image else "",
                "text": p.text,
                "category": p.category,
                "created_at": p.created_at.isoformat(),
            }
            for p in posts
        ],
    })


@login_required
@require_GET
def profile_stats(request):
    """Return post/connection stats for the profile page."""
    user_id = int(request.GET.get("user_id", request.user.id))
    posts_count = UserPost.objects.filter(author_id=user_id).count()

    mentor_profile = getattr(request.user, "mentor_profile", None) if user_id == request.user.id else None
    mentee_profile = getattr(request.user, "mentee_profile", None) if user_id == request.user.id else None

    connections = 0
    sessions_completed = 0

    if mentor_profile:
        connections = MenteeMentorRequest.objects.filter(mentor=mentor_profile, accepted=True).count()
        sessions_completed = MentoringSession.objects.filter(mentor=mentor_profile, status="completed").count()
    elif mentee_profile:
        connections = MenteeMentorRequest.objects.filter(mentee=mentee_profile, accepted=True).count()
        sessions_completed = MentoringSession.objects.filter(mentee=mentee_profile, status="completed").count()

    images_count = (
        UserPost.objects.filter(author_id=user_id)
        .exclude(image="")
        .exclude(image__isnull=True)
        .count()
    )

    return JsonResponse({
        "posts_count": posts_count,
        "connections": connections,
        "sessions_completed": sessions_completed,
        "images_count": images_count,
    })


@login_required
@require_GET
def post_comments_list(request, post_id):
    post = UserPost.objects.filter(id=post_id).first()
    if not post:
        return JsonResponse({"error": "Post not found."}, status=404)
    comments = PostComment.objects.filter(post=post).select_related("author")[:100]
    return JsonResponse({"comments": [_serialize_comment(c) for c in comments]})


@login_required
@require_http_methods(["POST"])
def post_comment_create(request, post_id):
    post = UserPost.objects.filter(id=post_id).first()
    if not post:
        return JsonResponse({"error": "Post not found."}, status=404)
    payload = _get_payload(request)
    content = (_get_str(payload, "content") or "").strip()
    if not content:
        return JsonResponse({"error": "Comment cannot be empty."}, status=400)
    comment = PostComment.objects.create(post=post, author=request.user, content=content)
    audit_log(request.user, "create", "post_comment", comment.id)
    return JsonResponse({"comment": _serialize_comment(comment)})
