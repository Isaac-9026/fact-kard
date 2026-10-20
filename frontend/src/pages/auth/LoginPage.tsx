import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin_demo');
  const [password, setPassword] = useState('123456');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder login flow: configura sesión inicial para desarrollo en Bloque 1
    login(
      'demo_jwt_token_bloque_1',
      {
        id: 1,
        username: username || 'admin_demo',
        email: `${username || 'admin'}@asescon.pe`,
        es_admin_global: true,
      },
      [
        {
          id: 1,
          ruc: '20100070970',
          razon_social: 'EMPRESA PILOTO ASESCON S.A.C.',
          nombre_comercial: 'ASESCON PILOTO',
          rol: 'ADMIN',
        },
        {
          id: 2,
          ruc: '20601234567',
          razon_social: 'DISTRIBUIDORA COMERCIAL LIMA S.R.L.',
          nombre_comercial: 'DISLIMA',
          rol: 'USUARIO',
        },
      ]
    );

    navigate('/empresas');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>FK</div>
          <h1 style={styles.title}>Login - FACT-KARD</h1>
          <p style={styles.subtitle}>Sistema de Facturación y Kardex Valorizado</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label htmlFor="username-input" style={styles.label}>Usuario</label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="password-input" style={styles.label}>Contraseña</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.submitButton}>
            Iniciar Sesión
          </button>
        </form>

        <div style={styles.footerNote}>
          <span>Bloque 1: Entorno de Desarrollo y Autenticación</span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-primary)',
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    padding: '2.5rem',
    boxShadow: 'var(--shadow-lg)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logo: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1.25rem',
    margin: '0 auto 1rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  input: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '0.65rem 0.85rem',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  submitButton: {
    marginTop: '0.5rem',
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: 600,
    transition: 'background-color 0.15s ease',
  },
  footerNote: {
    marginTop: '1.75rem',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '1rem',
  },
};

export default LoginPage;
