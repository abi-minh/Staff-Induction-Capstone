import {
  HashRouter, Routes, Route, NavLink, Outlet, Navigate, useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button } from '@mui/material';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useAuthStore }    from './store/authStore';
import LoginPage           from './pages/LoginPage';
import DashboardPage       from './pages/DashboardPage';
import ModulesPage         from './pages/ModulesPage';
import ModuleEditPage      from './pages/ModuleEditPage';
import DocumentsPage       from './pages/DocumentsPage';
import StaffPage           from './pages/StaffPage';
import StaffDetailPage     from './pages/StaffDetailPage';
import ReportsPage         from './pages/ReportsPage';
import StaffLayout         from './layout/StaffLayout';
import StaffDashboardPage  from './pages/staff/StaffDashboardPage';
import StaffModuleViewPage from './pages/staff/StaffModuleViewPage';
import StaffLibraryPage    from './pages/staff/StaffLibraryPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function isAdminRole(roles: string[]): boolean {
  return roles.some((r) => ['administrator', 'induction_admin'].includes(r));
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminGuard() {
  const user = useAuthStore((s) => s.user);
  if (!isAdminRole(user?.roles ?? [])) {
    return <Navigate to="/portal" replace />;
  }
  return <AdminLayout />;
}

function AdminLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  return (
    <div>
      <nav style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <NavLink to="/">Dashboard</NavLink>
        {' | '}
        <NavLink to="/modules">Modules</NavLink>
        {' | '}
        <NavLink to="/documents">Documents</NavLink>
        {' | '}
        <NavLink to="/staff">Staff</NavLink>
        {' | '}
        <NavLink to="/reports">Reports</NavLink>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{user?.name}</span>
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityOutlined />}
            onClick={() => navigate('/portal')}
          >
            Staff View
          </Button>
          <button onClick={clearAuth}>Sign out</button>
        </span>
      </nav>
      <main style={{ padding: '24px 16px' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/portal"
            element={
              <RequireAuth>
                <StaffLayout />
              </RequireAuth>
            }
          >
            <Route index                   element={<StaffDashboardPage />} />
            <Route path="training/:id"     element={<StaffModuleViewPage />} />
            <Route path="library"          element={<StaffLibraryPage />} />
          </Route>

          <Route
            element={
              <RequireAuth>
                <AdminGuard />
              </RequireAuth>
            }
          >
            <Route index                   element={<DashboardPage />} />
            <Route path="modules"          element={<ModulesPage />} />
            <Route path="modules/:id"      element={<ModuleEditPage />} />
            <Route path="documents"        element={<DocumentsPage />} />
            <Route path="staff"            element={<StaffPage />} />
            <Route path="staff/:id"        element={<StaffDetailPage />} />
            <Route path="reports"          element={<ReportsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
