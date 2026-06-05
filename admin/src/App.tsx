import { BrowserRouter, Routes, Route, NavLink, Outlet, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore }    from './store/authStore';
import LoginPage           from './pages/LoginPage';
import DashboardPage       from './pages/DashboardPage';
import ModulesPage         from './pages/ModulesPage';
import ModuleEditPage      from './pages/ModuleEditPage';
import DocumentsPage       from './pages/DocumentsPage';
import StaffPage           from './pages/StaffPage';
import StaffDetailPage     from './pages/StaffDetailPage';
import ReportsPage         from './pages/ReportsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// ── Auth guard ────────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ── Layout ────────────────────────────────────────────────────────────────────
// Build your sidebar, header, nav etc. here.
function Layout() {
  const { user, clearAuth } = useAuthStore();
  return (
    <div>
      <nav>
        <NavLink to="/">Dashboard</NavLink>
        {' | '}
        <NavLink to="/modules">Modules</NavLink>
        {' | '}
        <NavLink to="/documents">Documents</NavLink>
        {' | '}
        <NavLink to="/staff">Staff</NavLink>
        {' | '}
        <NavLink to="/reports">Reports</NavLink>
        {' | '}
        <span>{user?.name}</span>
        {' '}
        <button onClick={clearAuth}>Sign out</button>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
