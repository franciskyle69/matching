"""Shared Google OAuth login/signup mismatch checks."""

LOGIN_INTENT = "login"
SIGNUP_INTENT = "signup"
NO_ACCOUNT = "no_account"
ACCOUNT_EXISTS = "account_exists"
INTENT_SESSION_KEY = "google_oauth_intent"

LOGIN_MISSING_MESSAGE = (
    "No account found with this email. Please complete the manual registration first."
)
SIGNUP_EXISTS_MESSAGE = (
    "An account with this Google email already exists. Please log in instead."
)


def normalize_oauth_intent(intent):
    value = str(intent or "").strip().lower()
    if value in (LOGIN_INTENT, SIGNUP_INTENT):
        return value
    return LOGIN_INTENT


def resolve_google_oauth_gate(intent, account_exists):
    """Return an error code to halt OAuth, or None to continue."""
    exists = bool(account_exists)
    # Google OAuth is strictly login-only: non-existent accounts are rejected immediately.
    if not exists:
        return NO_ACCOUNT
    normalized = normalize_oauth_intent(intent)
    if normalized == SIGNUP_INTENT and exists:
        return ACCOUNT_EXISTS
    return None
