# Frontend information

Overview of the app’s frontend: structure, stack, and how it’s served.

---

## Structure

```
frontend/
├── dashboard/          # Main React app (mentor/mentee dashboard)
│   ├── index.html      # Single HTML entry; scripts loaded in order
│   ├── assets/         # JSX, CSS, and built output
│   │   ├── app.jsx             # Entry: mounts <AppRoot />
│   │   ├── AppRoot.jsx         # Root component (wraps AppProviders)
│   │   ├── AppProviders.jsx    # Context, auth, API, global state
│   │   ├── MainContent.jsx     # Renders current tab + modals
│   │   ├── Layout.jsx          # Sidebar, nav, search, tab icons
│   │   ├── context.jsx         # AppContext definition
│   │   ├── ErrorBoundary.jsx
│   │   ├── lib/
│   │   │   ├── constants.jsx
│   │   │   └── utils.jsx       # fetchJSON, getCookie, LoadingSpinner, etc.
│   │   ├── router/
│   │   │   ├── routes.jsx      # RouteRenderer (activeTab → Page)
│   │   │   └── pages/          # One file per main screen
│   │   │       ├── AllPages.jsx      # Registers pages in DashboardApp.Pages
│   │   │       ├── AuthPages.jsx     # signin, signup
│   │   │       ├── HomePage.jsx
│   │   │       ├── ProfilePage.jsx   # Profile, posts, gallery, composer
│   │   │       ├── MatchingPage.jsx
│   │   │       ├── SessionsPage.jsx
│   │   │       ├── NotificationsPage.jsx
│   │   │       ├── AnnouncementsPage.jsx
│   │   │       ├── ApprovalsPage.jsx
│   │   │       ├── SubjectsPage.jsx
│   │   │       ├── ActivityLogsPage.jsx
│   │   │       ├── BackupPage.jsx
│   │   │       ├── SettingsPage.jsx
│   │   │       ├── MentorProfilePage.jsx
│   │   │       └── CompleteProfilePage.jsx
│   │   ├── app.css             # Global styles, components, loading spinner
│   │   └── override.css
│   ├── test/           # Vitest tests
│   ├── package.json    # React 18, Vite, Vitest, MUI
│   └── vitest.config.js
│
└── landing/            # Public landing page (unauthenticated)
    ├── index.html
    ├── script.js
    ├── input.css / output.css  # Tailwind
    └── package.json            # Tailwind only
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| **UI** | React 18 (UMD from CDN in `index.html`) |
| **Routing** | Hash-based: `#home`, `#profile`, `#matching`, `#sessions`, etc. |
| **State** | React Context (`AppContext`) in `AppProviders.jsx` |
| **API** | `fetch` with `credentials: 'include'`; CSRF via `X-CSRFToken` cookie |
| **Styling** | Plain CSS in `app.css` (no Tailwind in dashboard) |
| **Icons** | Inline SVG in Layout and pages |
| **Modals / alerts** | SweetAlert2 (CDN), custom modals in JSX |
| **Charts** | Chart.js (CDN), used where needed |
| **Build / dev** | Vite (dashboard), Tailwind CLI (landing); Django can serve unbundled JSX via Babel (see below) |

---

## How the dashboard is loaded

- **URL**: `/app/` (and `/app/*`) → Django view `react_app()` serves `frontend/dashboard/index.html`.
- **Static files**: Django `STATICFILES_DIRS` includes `frontend/dashboard` and `frontend/landing`, so `/static/` serves files from those folders (e.g. `/static/assets/app.jsx`, `/static/assets/app.css`).
- **Scripts in `index.html`**: Loaded in order: React, MUI, Babel, then your app (constants → utils → context → router pages → routes → MainContent → Layout → AppProviders → AppRoot → app.jsx). Babel compiles JSX in the browser when using `type="text/babel"`.
- **Optional build**: You can run `npm run build` in `frontend/dashboard` and point Django at the build output if you want a bundled production build instead of many script tags.

---

## Main tabs (sidebar)

Tabs are driven by `activeTab` in context and `window.DashboardApp.MAIN_TABS` (and `DashboardApp.Pages`). Layout maps tab ids to icons and renders the active page via `RouteRenderer`.

| Tab id | Purpose |
|--------|--------|
| `home` | Home / overview |
| `profile` | User profile, posts feed, gallery, post composer |
| `complete-profile` | Required mentee/mentor info form |
| `matching` | Mentor recommendations (mentee) or requests (mentor) |
| `sessions` | Schedule and manage mentoring sessions |
| `announcements` | Announcements and comments |
| `approvals` | Staff: approve/reject mentors and mentees |
| `subjects` | Staff: manage subjects |
| `activity-logs` | Staff: activity logs |
| `backup` | Staff: backup/restore |
| `settings` | Account settings, avatar, bio, tags |

Auth-only screens (e.g. `signin`, `signup`) are handled inside the same SPA and shown when `activeTab` is set to them.

---

## API usage

- **Base URL**: Same origin (e.g. `http://127.0.0.1:8000`). All API calls are relative, e.g. `/api/me/`, `/api/posts/feed/`, `/api/sessions/`.
- **Auth**: Session cookies; `fetch(..., { credentials: 'include' })`. CSRF token from cookie and sent in headers (e.g. `X-CSRFToken`) for state-changing requests.
- **Helpers**: `fetchJSON()` and `getCookie()` in `lib/utils.jsx`; used across pages and in `AppProviders.jsx` for auth check, feed, sessions, etc.

---

## Theming and spinner

- **Theme**: `data-theme="light"` (or `"dark"`) on `<html>`; set in `index.html` and toggled from Layout. CSS uses `var(--...)` and `[data-theme="dark"]` for dark mode.
- **Loading spinner**: Custom component in `lib/utils.jsx` (gradient ring + glow). Styles live in `app.css` under `.loading-spinner-spinkit` and related classes.

---

## Landing page

- **URL**: `/` → `landing_page()` serves `frontend/landing/index.html`. If the user is authenticated, Django redirects to `/app/`.
- **Stack**: Static HTML + Tailwind CSS; minimal JS in `script.js`. No React.

---

## Quick reference

| Task | Where |
|------|--------|
| Add a new dashboard tab | Register in `MAIN_TABS` and `DashboardApp.Pages`, add icon in `Layout.jsx` `TAB_ICONS`. |
| Add a new API call | Use `fetchJSON()` from context or utils; often in `AppProviders.jsx` or the page that needs the data. |
| Change global styles / spinner | `frontend/dashboard/assets/app.css`. |
| Change auth or global state | `AppProviders.jsx` and `context.jsx`. |
| Change how the app is served | `capstone_site/views.py` (`react_app`, `landing_page`) and `capstone_site/settings.py` (`STATICFILES_DIRS`, `STATIC_URL`). |
