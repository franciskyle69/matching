# Google Drive integration

The app connects to Google Drive using the same Google OAuth credentials as **Login with Google** and **Google Calendar**. Users who sign in with Google (or link their Google account) can upload and list files in their Drive from the app.

## Setup

1. **OAuth credentials**  
   Use the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from your Google Cloud project (see `.env` / `.env.example`). No extra app or key is required.

2. **Enable Drive API**  
   In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Enable **Google Drive API** for your project.

3. **Scope**  
   The Drive scope is already added in `capstone_site/settings.py`:
   - `https://www.googleapis.com/auth/drive.file` — access only to files the app creates or the user opens with the app (recommended for privacy).

   For full Drive access (e.g. list all user files), you could add `https://www.googleapis.com/auth/drive` or `drive.readonly` to `SOCIALACCOUNT_PROVIDERS["google"]["SCOPE"]`. Existing users must re-authenticate (e.g. sign out and sign in with Google again) to grant new scopes.

## API endpoints

All require an authenticated user (session). The user must have linked Google (signed in with Google or linked in account settings).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drive/connected/` | Returns `{ "connected": true/false }` — whether the user has a valid Google token. |
| POST | `/api/drive/upload/` | Upload a file to the user’s Drive. See below. |
| GET | `/api/drive/files/` | List files in Drive (with `drive.file` scope: app-created files). Query params: `pageSize`, `pageToken`, `q` (Drive query). |

### Upload (POST `/api/drive/upload/`)

**Option A – JSON body**

```json
{
  "filename": "notes.txt",
  "content_base64": "<base64-encoded file content>",
  "mime_type": "text/plain",
  "folder_id": "optional-drive-folder-id"
}
```

**Option B – multipart form**

- `file`: the file (required)
- `folder_id`: optional Drive folder ID

Response (success):

```json
{
  "ok": true,
  "id": "drive-file-id",
  "name": "notes.txt",
  "webViewLink": "https://drive.google.com/..."
}
```

## Using Drive in the frontend

1. Ensure the user is logged in and, if needed, has connected Google (e.g. “Sign in with Google” or link in settings).
2. Call `GET /api/drive/connected/` to show “Connect Google Drive” or “Upload to Drive” only when `connected === true`.
3. For uploads, either:
   - Send a `FormData` with the file and optional `folder_id`, or
   - Encode file content as base64 and send the JSON body above.

Existing users who signed in with Google before the Drive scope was added must sign out and sign in with Google again so the new Drive permission is granted.

---

## All media in Google Drive (service account)

When **service account** credentials are set, **all uploaded media** (avatars, cover photos, and post images) are stored in Google Drive instead of the server’s `MEDIA_ROOT`. No per-user Google login is required for uploads.

### Setup

1. **Create a service account**  
   In [Google Cloud Console](https://console.cloud.google.com/) → IAM & Admin → Service Accounts → Create. Create a key (JSON) and download it.

2. **Enable Google Drive API**  
   APIs & Services → Enable **Google Drive API** for the same project.

3. **Configure the app**  
   In `.env` set one of:
   - **Path to key file:**  
     `DRIVE_SERVICE_ACCOUNT_JSON=/path/to/your-service-account.json`
   - **Or inline JSON:**  
     `DRIVE_SERVICE_ACCOUNT_JSON={"type":"service_account","client_email":"...","private_key":"..."}` (single line or escaped)

4. **Optional folder (where uploads go in Drive)**  
   Create a folder in (your own) Google Drive, share it with the service account email (Editor), and set:  
   `DRIVE_MEDIA_FOLDER_ID=that-folder-id`  
   If you omit this, the backend creates/uses a folder named **AppMedia** in the service account’s Drive.  
   *Note: This does **not** fix the “path differs per device” issue below; it only chooses which Drive folder stores files.*

5. **Run migrations**  
   `python manage.py migrate` (creates the `DriveMediaFile` mapping table).

After this, `default_storage` uses `GoogleDriveStorage`: avatar, cover, and post image uploads go to Drive; each file is shared as “anyone with the link can view” so image URLs work in the app.

### Multiple development devices

If you use **two (or more) dev machines** (e.g. laptop and desktop), the **path to the JSON key file** can differ (e.g. `C:\...\matching\service-account.json` vs `/Users/.../matching/service-account.json`). **Option B** above (the shared folder and `DRIVE_MEDIA_FOLDER_ID`) does **not** fix this—it only controls *where in Drive* uploads go, not where the app reads the credentials from.

To avoid different config per device:

- **Use inline JSON**  
  Set `DRIVE_SERVICE_ACCOUNT_JSON` to the **full JSON** (one line, escape quotes if needed). The same `.env` content works on every device; no file path. Keep `.env` out of version control and secure.

- **Or use a relative path**  
  Put the key file in the **project root** (e.g. `service-account-drive.json`) and set  
  `DRIVE_SERVICE_ACCOUNT_JSON=service-account-drive.json`  
  (or `./service-account-drive.json`). Use the same relative path on all devices. The repo’s `.gitignore` already excludes common key filenames so you don’t commit secrets.

### After pull on another device

When you **push** on one machine and **pull** on another, only the code and committed config are shared. Do this on the **other device**:

| Step | What to do |
|------|------------|
| **1. Create `.env`** | `.env` is not in git. Copy it from the first device (e.g. USB, secure chat, password manager) or recreate it from `.env.example`. Use the **same** values for DB, OAuth, and Drive so both devices talk to the same backend and Drive. |
| **2. Add the Drive key file** | If you use a **path** for `DRIVE_SERVICE_ACCOUNT_JSON`, copy the same JSON key file into the **project root** on the new device (same name as on the first device, e.g. `service-account-drive.json` or `capstone-489112-919fe6d12123.json`). The file is not in git; copy it manually. Add that filename to `.gitignore` if it isn’t already matched (e.g. `service-account*.json`). Alternatively, use **inline JSON** in `.env` so no file is needed on the new device. |
| **3. Install deps** | `pip install -r requirements.txt` (and create/activate a venv if you use one). |
| **4. Migrate** | `python manage.py migrate` (in case new migrations were pushed). |

You do **not** need to change `DRIVE_MEDIA_FOLDER_ID` or any path in `.env` if you use a **relative** path for the key (e.g. `service-account-drive.json`) and put that file in the project root on both devices.
