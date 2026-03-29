# Login Rate Limiting & Account Lockout Guide

## Overview

Login rate limiting prevents brute-force attacks by tracking failed login attempts and temporarily locking accounts after exceeding a threshold. This is implemented using **django-axes**, a battle-tested Django security package.

## Configuration

### Settings

Located in [capstone_site/settings.py](capstone_site/settings.py):

```python
AXES_FAILURE_LIMIT = 5  # Lock account after 5 failed attempts
AXES_COOLOFF_DURATION = timedelta(minutes=15)  # 15-minute lockout
AXES_LOCKOUT_BY_COMBINATION_USER_AND_IP = True  # Lock by user + IP
AXES_RESET_ON_SUCCESS = True  # Reset counter on successful login
AXES_VERBOSE = True  # Log detailed information
```

**Lockout Logic:**

- **Trigger:** 5 failed login attempts from the same user + IP combination
- **Duration:** 15-minute temporary lockout
- **Reset:** Successful login resets the failure counter
- **Granularity:** Locks by `username + IP address` (protects against distributed attacks)

## Usage

### For End Users (During Lockout)

When an account is locked, the user will see:

- **Web UI:** "Account locked due to too many failed login attempts. Try again later."
- **API Response:** 429 HTTP status code with lockout details

**What to do:**

1. Wait 15 minutes for the lockout to expire
2. Or contact an administrator to manually unlock the account

### For Administrators

#### View Locked Accounts

```bash
python manage.py manage_lockouts --list
```

**Output:**

```
📋 Found 2 locked account(s):

  • User: john_doe | IP: 192.168.1.100 | Failures: 5
    Locked at: 2026-03-28 14:32:10
  • User: jane_smith | IP: 192.168.1.105 | Failures: 7
    Locked at: 2026-03-28 14:25:45
```

#### Unlock a Specific User

By user ID:

```bash
python manage.py manage_lockouts --unlock 42
```

By email:

```bash
python manage.py manage_lockouts --unlock-by-email user@example.com
```

#### View Login Attempt History

```bash
python manage.py manage_lockouts --history 42
```

**Output:**

```
📜 Recent login attempts for 'john_doe':

  ✓ Success at 2026-03-28 14:50:30 | IP: 192.168.1.100
  ✗ Failed at 2026-03-28 14:32:08 | IP: 192.168.1.100
  ✗ Failed at 2026-03-28 14:32:05 | IP: 192.168.1.100
  ✗ Failed at 2026-03-28 14:32:02 | IP: 192.168.1.100
  ...
```

#### Clear All Lockouts

```bash
python manage.py manage_lockouts --clear-all
```

> ⚠️ **Warning:** This removes all lockouts. Use cautiously.

## Integration Points

### 1. Authentication Backends

The `AxesBackend` is configured as the first authentication backend:

```python
AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesBackend',  # Must be first
    'accounts.auth_backends.EmailOrUsernameModelBackend',
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]
```

### 2. Middleware

The `AxesMiddleware` is configured after `AuthenticationMiddleware`:

```python
MIDDLEWARE = [
    ...
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'axes.middleware.AxesMiddleware',  # After auth middleware
    'allauth.account.middleware.AccountMiddleware',
    ...
]
```

### 3. REST API Integration

Use the `lockout_utils` module for API views:

```python
from accounts.lockout_utils import create_lockout_response, get_lockout_info

# In your login view:
if axes.is_locked(request, request.POST.get('username')):
    return create_lockout_response(request.POST.get('username'))
```

#### Helper Functions

**`get_lockout_info(username)`**

- Returns dict with lockout status and details
- Used for UI feedback

**`create_lockout_response(username)`**

- Returns HTTP 429 response with lockout info
- Use directly in API endpoints

## Database Models

django-axes creates two models:

### AxisAttempt

- Tracks **current** login attempts
- Auto-updated with failure counts
- Auto-deleted after cooloff expires

### AxisLog

- Audit trail of all login attempts (success & failure)
- Never deleted (historical record)
- Useful for security investigations

Query examples:

```python
# Current locked accounts
from axes.models import AxisAttempt
locked = AxisAttempt.objects.filter(locked=True)

# Recent attempts (last 24h)
from axes.models import AxisLog
from django.utils import timezone
from datetime import timedelta

recent = AxisLog.objects.filter(
    attempt_time__gte=timezone.now() - timedelta(hours=24)
)

# Failed attempts from IP
failed = AxisLog.objects.filter(
    ip_address='192.168.1.100',
    failure_flag=True
)
```

## Customization

To adjust lockout behavior, edit [capstone_site/settings.py](capstone_site/settings.py):

### Increase Failure Threshold

```python
AXES_FAILURE_LIMIT = 10  # Allow 10 attempts instead of 5
```

### Extend Lockout Duration

```python
from datetime import timedelta
AXES_COOLOFF_DURATION = timedelta(hours=1)  # 1 hour instead of 15 min
```

### Lock by Email Instead of IP

```python
# Less recommended (allows multiple wrong passwords per session)
AXES_LOCKOUT_BY_COMBINATION_USER_AND_IP = False
# Will lock by username only
```

### Disable Failure Counter Reset on Success

```python
AXES_RESET_ON_SUCCESS = False  # Lockout persists even after successful login
```

## Security Best Practices

✅ **Recommended Setup:**

- Keep `AXES_LOCKOUT_BY_COMBINATION_USER_AND_IP = True` (current setting)
- Keep `AXES_RESET_ON_SUCCESS = True` (current setting)
- Regular review of `AxisLog` for patterns (check [admin](capstone_site/settings.py) dashboard)
- Combine with HTTPS (already configured in production)

⚠️ **Additional Hardening:**

- Enable CAPTCHA after 2-3 failures (not yet implemented)
- Use 2FA for sensitive accounts
- Rate limit by IP at reverse proxy level (Nginx/HAProxy)
- Monitor failed attempts and alert admins

## Email & Dashboard Integration

Failed login attempts are **automatically logged** but do not generate immediate email alerts. To add email notifications:

1. Create a signal handler in [accounts/signals.py](accounts/signals.py):

```python
from django.dispatch import receiver
from axes.signals import axes_lockout_attempted

@receiver(axes_lockout_attempted)
def on_account_locked(sender, request, **kwargs):
    username = request.POST.get('username')
    user = User.objects.filter(username=username).first()
    if user:
        send_lockout_email(user, request)
```

2. Or check `AxisLog` periodically (e.g., Celery task) for suspicious patterns.

## Troubleshooting

### User Claims They Can't Login

1. Check if account is locked:

   ```bash
   python manage.py manage_lockouts --list
   ```

2. View their attempt history:

   ```bash
   python manage.py manage_lockouts --history <user_id>
   ```

3. If locked, either:
   - Wait 15 minutes, or
   - Unlock manually:
     ```bash
     python manage.py manage_lockouts --unlock <user_id>
     ```

### Too Many False Positives?

If legitimate users are being locked out (e.g., typos), consider:

1. **Increase the threshold:**

   ```python
   AXES_FAILURE_LIMIT = 7  # From 5 to 7
   ```

2. **Increase cooloff duration** (gives more breathing room):
   ```python
   AXES_COOLOFF_DURATION = timedelta(minutes=20)  # From 15 to 20
   ```

### View Failed Login Attempts in Django Admin

Add to [capstone_site/admin.py](capstone_site/admin.py):

```python
from django.contrib import admin
from axes.models import AxisAttempt, AxisLog

@admin.register(AxisLog)
class AxisLogAdmin(admin.ModelAdmin):
    list_display = ('username', 'ip_address', 'attempt_time', 'failure_flag', 'user_agent')
    list_filter = ('failure_flag', 'attempt_time')
    search_fields = ('username', 'ip_address')
    readonly_fields = ('username', 'ip_address', 'user_agent', 'failure_flag', 'attempt_time')

    def has_add_permission(self, request):
        return False  # Prevent manual additions
```

## References

- [django-axes Documentation](https://django-axes.readthedocs.io/)
- [OWASP: Brute Force Protection](https://owasp.org/www-community/attacks/Brute_force_attack)
- [Project Security Policy](../docs/SECURITY.md) (if exists)

---

**Last Updated:** March 28, 2026
**Status:** ✅ Active and configured
