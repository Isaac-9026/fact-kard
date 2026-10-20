from django.urls import path
from apps.usuarios.views import LoginView, MeView, AsignacionesView

app_name = 'usuarios'

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('me/', MeView.as_view(), name='me'),
    path('asignaciones/', AsignacionesView.as_view(), name='asignaciones'),
]
