"""
URL configuration for backend_project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, re_path
from django.views.generic import TemplateView
from django.views.static import serve
from django.conf import settings
import os
from api.views import land_search_view

FRONTEND_DIR = settings.BASE_DIR.parent

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/land-search/', land_search_view),
    path('', TemplateView.as_view(template_name='index.html')),
    path('index.html', TemplateView.as_view(template_name='index.html')),
    path('login.html', TemplateView.as_view(template_name='login.html')),
    path('about.html', TemplateView.as_view(template_name='about.html')),
    path('services.html', TemplateView.as_view(template_name='services.html')),
    path('cybersecurity.html', TemplateView.as_view(template_name='cybersecurity.html')),
    
    # Dashboard Routes
    path('dashboard/dist/', serve, {'document_root': os.path.join(FRONTEND_DIR, 'dashboard', 'dist'), 'path': 'index.html'}),
    re_path(r'^dashboard/dist/(?P<path>.*)$', serve, {'document_root': os.path.join(FRONTEND_DIR, 'dashboard', 'dist')}),
    
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': os.path.join(FRONTEND_DIR, 'assets')}),
    re_path(r'^(?P<path>.*\.(png|jpg|mp4|ico|woff2?))$', serve, {'document_root': FRONTEND_DIR}),
]

if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
