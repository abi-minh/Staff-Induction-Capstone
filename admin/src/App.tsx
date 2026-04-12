import { HashRouter, Routes, Route, NavLink, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { currentUser } from './api/client';
import DashboardPage from './pages/DashboardPage';
import ModulesPage from './pages/ModulesPage';
import ModuleEditPage from './pages/ModuleEditPage';
import DocumentsPage from './pages/DocumentsPage';
import StaffPage from './pages/StaffPage';
import StaffDetailPage from './pages/StaffDetailPage';
import ReportsPage from './pages/ReportsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Layout() {
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
        <span>{currentUser?.name}</span>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  if (!currentUser) {
    return <p>No logged-in WordPress user found.</p>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="modules" element={<ModulesPage />} />
            <Route path="modules/:id" element={<ModuleEditPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:id" element={<StaffDetailPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}