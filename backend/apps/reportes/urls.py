from django.urls import path
from apps.reportes.views import (
    Formato131ExcelView, Formato131View, KardexExcelExportView,
    KardexReportView, PilotoComparadorView,
)

urlpatterns = [
    path('kardex/', KardexReportView.as_view(), name='kardex-report'),
    path('kardex/excel/', KardexExcelExportView.as_view(), name='kardex-excel-export'),
    path('formato-13-1/', Formato131View.as_view(), name='formato-131'),
    path('formato-13-1/excel/', Formato131ExcelView.as_view(), name='formato-131-excel'),
    path('piloto-comparador/', PilotoComparadorView.as_view(), name='piloto-comparador'),
]
