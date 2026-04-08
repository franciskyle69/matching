# Users Management Page - Documentation

## Overview

The Users Management page is a comprehensive staff-only feature for managing all users in the PeerLink system. Coordinators and administrators can view user information, search and filter users, manage approvals, and control user access.

## Features

### 1. User List Display
- View all users in a clean, responsive table format
- Display user name, email, role, status, and join date
- Staff badge indicator for administrative accounts
- Status indicators (Active/Inactive)

### 2. Search and Filter
- **Search**: Find users by name, email, or username
- **Role Filter**: Filter by Mentor, Mentee, Both, or No Profile
- **Status Filter**: Show Active or Inactive users
- **Staff Filter**: Show staff-only or non-staff users
- Real-time filter results with dynamic pagination

### 3. Pagination
- Configurable page sizes (10, 20, 50, 100 users per page)
- Clear pagination controls with page navigation
- Shows current page, total pages, and total user count

### 4. User Actions

#### View/Edit User Details
- Click "View" button to open user details modal
- See complete user information:
  - Full name, email, username
  - Account status and staff status
  - Account creation date
  - Role (Mentor, Mentee, or Both)
  - Associated profiles with details (program, year, capacity, etc.)
- Edit mode to update:
  - First name and last name
  - Email address
  - Staff status

#### Activate/Deactivate
- Activate inactive user accounts
- Deactivate active user accounts
- Soft delete approach (preserves data integrity)

#### Profile Approval
- Approve pending Mentor profiles
- Approve pending Mentee profiles  
- Visible only for users with pending profiles
- One-click approval buttons

#### Delete User
- Soft delete users (deactivate their account)
- Cannot delete your own account (safety protection)
- Confirmation dialog before deletion

## Backend API Endpoints

All endpoints are staff-only and return proper error responses for unauthorized access.

### Users List
```
GET /api/users/
Parameters:
  - page: Page number (default: 1)
  - page_size: Items per page (default: 20, max: 100)
  - search: Search query (username/email/name)
  - role: Filter by role (mentor/mentee/both/none)
  - is_active: Filter by status (true/false)
  - is_staff: Filter by staff status (true/false)

Response:
{
  "ok": true,
  "users": [
    {
      "id": 123,
      "username": "john_doe",
      "email": "john@example.com",
      "full_name": "John Doe",
      "first_name": "John",
      "last_name": "Doe",
      "is_staff": false,
      "is_active": true,
      "date_joined": "2024-01-15T10:30:00Z",
      "role": "mentor",
      "mentor_approved": true,
      "mentee_approved": null
    }
  ],
  "total": 250,
  "page": 1,
  "page_size": 20,
  "total_pages": 13
}
```

### User Detail
```
GET /api/users/<user_id>/
Response: Extended user object with profile details
{
  "ok": true,
  "user": {
    "id": 123,
    ...user fields...,
    "mentor_profile": {
      "program": "Computer Science",
      "year_level": 3,
      "gpa": "3.85",
      "bio": "...",
      "capacity": 2,
      "approved": true,
      "subjects": ["Programming", "Database Design"],
      "topics": ["Python", "SQL"]
    },
    "mentee_profile": null
  }
}
```

### Update User
```
POST /api/users/<user_id>/update/
Body:
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "john@newdomain.com",
  "is_staff": false
}
Response: Updated user object
```

### Activate/Deactivate User
```
POST /api/users/<user_id>/activate-deactivate/
Body:
{
  "is_active": true  // or false
}
Response: Updated user object
```

### Delete User
```
POST /api/users/<user_id>/delete/
Response:
{
  "ok": true,
  "message": "User deleted successfully"
}
```

### Approve/Reject Mentor Profile
```
POST /api/users/<user_id>/mentor-approve/
Body:
{
  "approved": true  // or false
}
Response: Updated user object
```

### Approve/Reject Mentee Profile
```
POST /api/users/<user_id>/mentee-approve/
Body:
{
  "approved": true  // or false
}
Response: Updated user object
```

## Frontend Components

### UsersPage.jsx
Main page component for the Users Management interface.

**Key Functions:**
- `loadUsers()`: Fetches users with current filters
- `handleActivate(userId)`: Activates a user account
- `handleDeactivate(userId)`: Deactivates a user account
- `handleDelete(userId)`: Deletes a user (with confirmation)
- `handleApprove(userId, roleType)`: Approves mentor or mentee profile
- `handleReject(userId, roleType)`: Rejects mentor or mentee profile

**State Management:**
- Users list with pagination
- Search and filter inputs
- Loading states for async operations
- Modal for viewing/editing user details

### UserDetailsModal Component
Modal dialog for viewing and editing individual user information.

**Features:**
- Read-only detail view
- Edit mode for updating basic info
- Profile information display
- Mentor/Mentee profile details

## Styling and UX

### Responsive Design
- Mobile-optimized layout (breakpoints at 768px and 480px)
- Stacked filters on smaller screens
- Vertical action buttons on mobile
- Full-width modals on small devices

### Visual Indicators
- **Green badge**: Active status or approved profiles
- **Red badge**: Inactive status or pending profiles
- **Indigo badge**: Staff member indicator
- **Hover effects**: Table rows and buttons highlight on hover
- **Disabled state**: Buttons show reduced opacity when loading

### Color Scheme
Uses the PeerLink design system:
- Indigo (#22177A) for primary actions
- Green for approval/active status
- Red for deactivation/pending status
- Slate grays for text and borders

## Database Considerations

### User Model Fields Used
- `id`: Unique identifier
- `username`: Unique username
- `email`: User email address
- `first_name`, `last_name`: User name
- `is_staff`: Admin/staff flag
- `is_active`: Account active status
- `date_joined`: Account creation date

### Related Models
- `MentorProfile`: Links to User via OneToOneField
- `MenteeProfile`: Links to User via OneToOneField

### Queries Optimized With
- `select_related('mentor_profile', 'mentee_profile')`: Reduces N+1 queries
- Index usage on `is_active` and `is_staff` fields

## Security Features

### Staff-Only Protection
- `@login_required` decorator on all endpoints
- `_require_staff(request)` check in each function
- Returns 403/401 for unauthorized access
- Staff status verified from `request.user.is_staff`

### Audit Logging
- All actions logged via `audit_log()` function
- Tracks: user, action type, description, status
- Useful for compliance and debugging

### Soft Deletes
- User deletion deactivates instead of hard-deleting
- Preserves data integrity and relationships
- Data can be restored if needed

### Self-Protection
- Cannot delete your own account
- Prevents accidental account lockout

## File Changes Summary

### Backend Files Created
- `api/controllers/users_controller.py` - New controller with all user management endpoints

### Backend Files Modified
- `api/urls.py` - Added 7 new URL patterns for user management endpoints

### Frontend Files Created
- `frontend/dashboard/assets/router/pages/UsersPage.jsx` - Main users management page component

### Frontend Files Modified
- `frontend/dashboard/index.html` - Added script tag for UsersPage.jsx
- `frontend/dashboard/assets/lib/constants.jsx` - Added "users" route to ROUTES array
- `frontend/dashboard/assets/app.css` - Added comprehensive styling for Users page

## Usage Example

### As a Coordinator:
1. Click "Users" in the sidebar navigation
2. Use search to find a specific user
3. Apply filters to narrow down results
4. Click "View" on any user to see full details
5. Use action buttons to approve profiles, activate/deactivate, or delete

### Searching for users:
- Search for: `john@example.com` → finds user by email
- Search for: `john doe` → finds user by name
- Filter by: "Mentors Only" → shows only mentor users
- Filter by: "Inactive" → shows deactivated accounts

### Bulk operations:
1. Filter results (e.g., all pending mentor approvals)
2. Click approve buttons sequentially for each user
3. Review results in activity logs for audit trail

## Future Enhancement Ideas

1. **Bulk Actions**: Select multiple users and apply actions in batch
2. **Email Templates**: Send notification emails when approving users
3. **Export/Import**: Export user data to CSV, import bulk users
4. **Advanced Analytics**: User growth charts, role distribution
5. **Role Management**: Assign/revoke staff status more granularly
6. **User Groups**: Organize users by department/program
7. **Audit Trail**: Detailed history of changes per user
8. **Custom Columns**: Configurable table view with additional fields

## Troubleshooting

### Users list shows "No users found"
- Check search/filter criteria
- Ensure you're logged in as staff member
- Verify database has users (check Django admin)

### Actions not working
- Verify you're logged in as staff (check user badge)
- Check browser console for errors
- Review server logs for API errors
- Ensure CSRF token is valid

### Performance issues with large user lists
- Increase page size to load more users at once
- Use search filters to narrow results
- Check database indexes on is_active and is_staff fields

### Modal won't close
- Click the X button in top-right corner
- Click outside the modal to close
- Refresh page if stuck

## Related Documentation
- [Activity Logs](../docs/activity-logs.md)
- [Approvals System](../docs/approvals-system.md)
- [Subject Management](../docs/subjects.md)
