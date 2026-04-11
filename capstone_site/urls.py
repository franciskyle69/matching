"""
URL configuration for capstone_site project.

Main UI: The React dashboard at /app/ is the primary interface for mentors, mentees, and staff.
- / → landing page (or redirect to /app/ if authenticated)
- /app/ → React SPA (dashboard)
- /api/ → REST API consumed by the dashboard

Legacy/server-rendered flows (still used for email links, allauth, password reset):
- templates/registration/ — login, register, password reset (django.contrib.auth + allauth)
- templates/account/ — allauth email verification, settings
- templates/matching/ — legacy matching UI; /matching/* URLs now redirect to /app/#<tab>
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from .views import react_app, landing_page, public_landing_page, _matching_redirect

urlpatterns = [
    path('', landing_page, name='home'),
    path('landing/', public_landing_page, name='public_landing'),
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    path('accounts/', include('django.contrib.auth.urls')),
    path('accounts/', include('allauth.urls')),
    path('profiles/', include('profiles.urls')),
    path('matching/', _matching_redirect, {'default_tab': 'sessions'}, name='matching_redirect_root'),
    re_path(r'^matching/.*$', _matching_redirect, {'default_tab': 'sessions'}, name='matching_redirect'),
    path('api/', include('api.urls')),
    path('app/', react_app, name='react_app'),
    re_path(r'^app/.*$', react_app),
] + (static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) if settings.DEBUG else [])
