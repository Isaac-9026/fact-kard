import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { RutaProtegida } from './components/auth/RutaProtegida';
import { LoginPage } from './pages/auth/LoginPage';
import { EmpresasPage } from './pages/empresas/EmpresasPage';

// Bloque 6: code splitting. Login y Empresas (pantallas de entrada) van en el bundle
// principal; el resto de módulos se descarga al visitarlos por primera vez.
const AuditoriaPage = lazy(() => import('./pages/auditoria/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage })));
const CatalogosPage = lazy(() => import('./pages/catalogos/CatalogosPage').then((m) => ({ default: m.CatalogosPage })));
const PeriodosPage = lazy(() => import('./pages/periodos/PeriodosPage').then((m) => ({ default: m.PeriodosPage })));
const MaestrosInventarioPage = lazy(() => import('./pages/inventario/MaestrosInventarioPage').then((m) => ({ default: m.MaestrosInventarioPage })));
const DocumentosPage = lazy(() => import('./pages/documentos/DocumentosPage').then((m) => ({ default: m.DocumentosPage })));
const OperacionesInternasPage = lazy(() => import('./pages/operaciones/OperacionesInternasPage').then((m) => ({ default: m.OperacionesInternasPage })));
const TransferenciasPage = lazy(() => import('./pages/transferencias/TransferenciasPage').then((m) => ({ default: m.TransferenciasPage })));
const IncidenciasPage = lazy(() => import('./pages/incidencias/IncidenciasPage').then((m) => ({ default: m.IncidenciasPage })));
const KardexPage = lazy(() => import('./pages/kardex/KardexPage').then((m) => ({ default: m.KardexPage })));
const CierresPage = lazy(() => import('./pages/cierres/CierresPage').then((m) => ({ default: m.CierresPage })));
const CapturaHomologacionPage = lazy(() => import('./pages/captura/CapturaHomologacionPage').then((m) => ({ default: m.CapturaHomologacionPage })));
const Formato131Page = lazy(() => import('./pages/formato131/Formato131Page').then((m) => ({ default: m.Formato131Page })));

const CargandoModulo: React.FC = () => (
  <div className="py-20 text-center text-sm text-slate-500" role="status">Cargando módulo...</div>
);

const diferido = (Componente: React.ComponentType) => (
  <Suspense fallback={<CargandoModulo />}>
    <Componente />
  </Suspense>
);

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta de autenticación */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas principales protegidas por MainLayout */}
          <Route element={<RutaProtegida />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/empresas" replace />} />
              <Route path="empresas" element={<EmpresasPage />} />
              <Route path="auditoria" element={diferido(AuditoriaPage)} />
              <Route path="catalogos" element={diferido(CatalogosPage)} />
              <Route path="periodos" element={diferido(PeriodosPage)} />
              <Route path="inventario" element={diferido(MaestrosInventarioPage)} />
              <Route path="documentos" element={diferido(DocumentosPage)} />
              <Route path="captura-homologacion" element={diferido(CapturaHomologacionPage)} />
              <Route path="operaciones-internas" element={diferido(OperacionesInternasPage)} />
              <Route path="transferencias" element={diferido(TransferenciasPage)} />
              <Route path="incidencias" element={diferido(IncidenciasPage)} />
              <Route path="kardex" element={diferido(KardexPage)} />
              <Route path="cierres" element={diferido(CierresPage)} />
              <Route path="formato-13-1" element={diferido(Formato131Page)} />
            </Route>
          </Route>

          {/* Redirección wildcard */}
          <Route path="*" element={<Navigate to="/empresas" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
