import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { PageProvider } from './contexts/PageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { Layout } from './components/Layout';
import { EmptyState } from './components/EmptyState';
import { PageView } from './components/PageView';
import { CalendarPage } from './components/CalendarPage';
import { Login } from './components/Login';
import { SharedView } from './components/SharedView';

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <SidebarProvider>
      <WorkspaceProvider>
        <PageProvider>
          <Outlet />
        </PageProvider>
      </WorkspaceProvider>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              {/* Vista pública compartida: NO requiere auth. Funciona aunque el
                  visitante no esté logueado, y NO se redirige a /login si el token
                  es inválido (la SharedView muestra su propio error inline). */}
              <Route path="/share/:token" element={<SharedView />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<EmptyState />} />
                  <Route path="page/:id" element={<PageView />} />
                  <Route path="calendar" element={<CalendarPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
