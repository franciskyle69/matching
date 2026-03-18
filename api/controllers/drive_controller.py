"""
Google Drive integration: upload/list files using the user's Google OAuth token.
Uses the same token as Google Calendar (sessions_controller); requires Drive scope in settings.
"""
import requests
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .sessions_controller import _get_google_access_token
from ..views import _get_payload, logger

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"


def _drive_request(user, method, url, **kwargs):
    """Perform an authenticated request to Google Drive API. Returns (response, error_dict or None)."""
    token = _get_google_access_token(user)
    if not token:
        return None, {"error": "Google account not linked. Sign in with Google to use Drive."}
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {token}"
    kwargs["headers"] = headers
    try:
        resp = requests.request(method, url, timeout=30, **kwargs)
        if resp.status_code in (401, 403):
            return None, {"error": "Google Drive access expired. Please sign in with Google again."}
        return resp, None
    except requests.RequestException as e:
        logger.exception("drive_request_error")
        return None, {"error": str(e)}


@login_required
@require_http_methods(["POST"])
def drive_upload(request):
    """
    Upload a file to the current user's Google Drive (root or optional folder).
    Body (JSON): { "filename": "name.txt", "content_base64": "<base64>", "mime_type": "text/plain" }
    Or multipart form: file + optional "folder_id".
    """
    user = request.user

    # Support JSON body with base64 content (e.g. from frontend)
    if request.content_type and "application/json" in request.content_type:
        payload = _get_payload(request)
        if not payload:
            return JsonResponse({"error": "Invalid JSON body."}, status=400)
        filename = (payload.get("filename") or "").strip()
        content_b64 = payload.get("content_base64")
        mime_type = payload.get("mime_type") or "application/octet-stream"
        folder_id = payload.get("folder_id")
        if not filename:
            return JsonResponse({"error": "filename is required."}, status=400)
        if content_b64 is None:
            return JsonResponse({"error": "content_base64 is required."}, status=400)
        import base64
        try:
            content = base64.b64decode(content_b64)
        except Exception as e:
            return JsonResponse({"error": f"Invalid base64 content: {e}"}, status=400)
    else:
        # Multipart form
        f = request.FILES.get("file")
        if not f:
            return JsonResponse({"error": "No file provided. Use 'file' in form or JSON with filename + content_base64."}, status=400)
        filename = f.name
        content = f.read()
        mime_type = getattr(f, "content_type", None) or "application/octet-stream"
        folder_id = request.POST.get("folder_id") or None

    if not content:
        return JsonResponse({"error": "File content is empty."}, status=400)

    # Build metadata
    metadata = {"name": filename, "mimeType": mime_type}
    if folder_id:
        metadata["parents"] = [folder_id]

    # Multipart upload: part 1 = metadata JSON, part 2 = file content
    import json as _json
    boundary = "drive_upload_boundary"
    body = (
        f"--{boundary}\r\n"
        "Content-Type: application/json; charset=UTF-8\r\n\r\n"
        + _json.dumps(metadata) + "\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + content + (f"\r\n--{boundary}--\r\n").encode("utf-8")
    headers = {"Content-Type": f"multipart/related; boundary={boundary}"}

    resp, err = _drive_request(
        user, "POST",
        f"{DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink",
        data=body,
        headers=headers,
    )
    if err:
        return JsonResponse(err, status=400)

    if resp.status_code not in (200, 201):
        try:
            msg = resp.json().get("error", {}).get("message", resp.text[:200])
        except Exception:
            msg = resp.text[:200]
        return JsonResponse({"error": f"Drive upload failed: {msg}"}, status=400)

    data = resp.json()
    return JsonResponse({
        "ok": True,
        "id": data.get("id"),
        "name": data.get("name"),
        "webViewLink": data.get("webViewLink"),
    })


@login_required
@require_http_methods(["GET"])
def drive_list(request):
    """
    List files in the user's Drive that were created by this app (drive.file scope).
    Query params: pageSize (default 20), pageToken (optional), q (optional Drive query).
    """
    user = request.user
    page_size = min(int(request.GET.get("pageSize", 20)), 100)
    page_token = request.GET.get("pageToken") or ""
    q = request.GET.get("q")  # e.g. "mimeType='application/pdf'"

    params = {
        "pageSize": page_size,
        "fields": "nextPageToken,files(id,name,mimeType,webViewLink,createdTime,size)",
    }
    if page_token:
        params["pageToken"] = page_token
    if q:
        params["q"] = q
    else:
        # With drive.file scope, list only app-created files
        params["q"] = "trashed = false"

    resp, err = _drive_request(user, "GET", f"{DRIVE_API_BASE}/files", params=params)
    if err:
        return JsonResponse(err, status=400)

    if resp.status_code != 200:
        try:
            msg = resp.json().get("error", {}).get("message", resp.text[:200])
        except Exception:
            msg = resp.text[:200]
        return JsonResponse({"error": f"Drive list failed: {msg}"}, status=400)

    data = resp.json()
    return JsonResponse({
        "files": data.get("files", []),
        "nextPageToken": data.get("nextPageToken"),
    })


@login_required
@require_http_methods(["GET"])
def drive_connected(request):
    """Check if the current user has Google Drive connected (has a valid token)."""
    token = _get_google_access_token(request.user)
    return JsonResponse({"connected": bool(token)})
