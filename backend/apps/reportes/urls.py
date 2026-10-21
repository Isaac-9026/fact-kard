from django.urls import path
from apps.reportes.views import KardexReportView, KardexExcelExportView

urlpatterns = [
    path('kardex/', KardexReportView.as_view(), name='kardex-report'),
    path('kardex/excel/', KardexExcelExportView.as_view(), name='kardex-excel-export'),
]
