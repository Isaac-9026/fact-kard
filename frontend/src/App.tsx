import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { EmpresasPage } from './pages/empresas/EmpresasPage';
import { AuditoriaPage } from './pages/auditoria/AuditoriaPage';
import { CatalogosPage } from './pages/catalogos/CatalogosPage';
import { PeriodosPage } from './pages/periodos/PeriodosPage';
import { MaestrosInventarioPage } from './pages/inventario/MaestrosInventarioPage';
import { DocumentosPage } from './pages/documentos/DocumentosPage';
import { OperacionesInternasPage } from './pages/operaciones/OperacionesInternasPage';
import { TransferenciasPage } from './pages/transferencias/TransferenciasPage';
import { IncidenciasPage } from './pages/incidencias/IncidenciasPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta de autenticación */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas principales protegidas por MainLayout */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/empresas" replace />} />
            <Route path="empresas" element={<EmpresasPage />} />
            <Route path="auditoria" element={<AuditoriaPage />} />
            <Route path="catalogos" element={<CatalogosPage />} />
            <Route path="periodos" element={<PeriodosPage />} />
            <Route path="inventario" element={<MaestrosInventarioPage />} />
            <Route path="documentos" element={<DocumentosPage />} />
            <Route path="operaciones-internas" element={<OperacionesInternasPage />} />
            <Route path="transferencias" element={<TransferenciasPage />} />
            <Route path="incidencias" element={<IncidenciasPage />} />
          </Route>

          {/* Redirección wildcard */}
          <Route path="*" element={<Navigate to="/empresas" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
