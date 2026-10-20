import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginApi } from '../../api/auth';
import type { AxiosError } from 'axios';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin_demo');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Por favor ingrese su usuario y contraseña.');
      return;
    }

    try {
      setIsLoading(true);
      const data = await loginApi({
        username: username.trim(),
        password,
      });

      // Actualizar el estado global de autenticación
      login(data.token, data.usuario, data.empresas);

      // Redirigir al selector o listado de empresas
      navigate('/empresas');
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      if (axiosError.response?.data?.detail) {
        setErrorMsg(axiosError.response.data.detail);
      } else if (axiosError.message === 'Network Error') {
        setErrorMsg('Error de conexión: No se pudo contactar al servidor backend.');
      } else {
        setErrorMsg('Error al iniciar sesión. Verifique sus credenciales.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>FK</div>
          <h1 style={styles.title}>FACT-KARD</h1>
          <p style={styles.subtitle}>Sistema de Facturación y Kardex Valorizado SUNAT</p>
        </div>

        {errorMsg && (
          <div style={styles.errorAlert} role="alert">
            <span style={styles.errorIcon}>⚠️</span>
            <span style={styles.errorText}>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label htmlFor="username-input" style={styles.label}>
              Usuario o Identificador
            </label>
            <input
              id="username-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: operador_demo"
              required
              disabled={isLoading}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="password-input" style={styles.label}>
              Contraseña
            </label>
            <input
              id="password-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.submitButton,
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? (
              <span style={styles.loadingWrapper}>
                <span style={styles.spinner} />
                Iniciando sesión...
              </span>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>

        <div style={styles.footerNote}>
          <p style={styles.footerSecurity}>
            🔒 Conexión segura con validación multiempresa estricta
          </p>
          <span style={styles.footerVersion}>FACT-KARD v1.0 • Formato 13.1 SUNAT</span>
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
    maxWidth: '430px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    padding: '2.5rem 2rem',
    boxShadow: 'var(--shadow-lg)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logo: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1.35rem',
    margin: '0 auto 1.25rem',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
    letterSpacing: '-0.5px',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '0.35rem',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    color: 'var(--accent-danger)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    marginBottom: '1.5rem',
    fontSize: '0.85rem',
    lineHeight: 1.4,
  },
  errorIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  errorText: {
    fontWeight: 500,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  label: {
    fontSize: '0.825rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  input: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0.75rem 0.95rem',
    color: 'var(--text-primary)',
    fontSize: '0.925rem',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  submitButton: {
    marginTop: '0.65rem',
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    padding: '0.85rem',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
    transition: 'background-color 0.15s ease, transform 0.1s ease',
  },
  loadingWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  footerNote: {
    marginTop: '2rem',
    textAlign: 'center',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  footerSecurity: {
    fontSize: '0.775rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  footerVersion: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
};

export default LoginPage;
