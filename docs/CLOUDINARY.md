# Cloudinary media storage

When **Cloudinary** is configured, all uploaded media (avatars, cover photos, post images) are stored on Cloudinary instead of the server or Google Drive. Setup is simpler than a service account (no JSON key file).

## Setup

1. **Create a Cloudinary account**  
   Sign up at [cloudinary.com](https://cloudinary.com) (free tier is enough for typical use).

2. **Get credentials**  
   In the [Cloudinary Console](https://console.cloudinary.com/) → Dashboard, copy:
   - **Cloud name**
   - **API Key**
   - **API Secret**

3. **Configure the app**  
   In `.env` add:
   ```env
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. **Run migrations**  
   ```bash
   python manage.py migrate
   ```
   (Creates the `CloudinaryMediaFile` table.)

5. **Restart the app**

After this, avatar, cover, and post image uploads go to Cloudinary and their URLs are served from Cloudinary’s CDN.

## Priority

If both **Cloudinary** and **Google Drive** env vars are set, the app uses **Cloudinary** for media. To use Drive instead, leave Cloudinary vars unset and set only the Drive credentials.
