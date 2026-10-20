import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { EmpresasPage } from './pages/empresas/EmpresasPage';
import { AuditoriaPage } from './pages/auditoria/AuditoriaPage';

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
          </Route>

          {/* Redirección wildcard */}
          <Route path="*" element={<Navigate to="/empresas" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
