import { HashRouter, Routes, Route, NavLink, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage   from './pages/DashboardPage';
import TrainingPage    from './pages/TrainingPage';
import ModuleViewPage  from './pages/ModuleViewPage';
import LibraryPage     from './pages/LibraryPage';
import { usePortalStore } from './store/portalStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// ── Layout ────────────────────────────────────────────────────────────────────
// Build your nav, sidebar, header etc. here.
function Layout() {
  const user = usePortalStore((s) => s.user);
  return (
    <div>
      <nav>
        <NavLink to="/">Dashboard</NavLink>
        {' | '}
        <NavLink to="/training">My Training</NavLink>
        {' | '}
        <NavLink to="/library">Library</NavLink>
        {' | '}
        <span>{user.name}</span>
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
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index                 element={<DashboardPage />} />
            <Route path="training"       element={<TrainingPage />} />
            <Route path="training/:id"   element={<ModuleViewPage />} />
            <Route path="library"        element={<LibraryPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
