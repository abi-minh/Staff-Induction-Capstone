import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./store/authStore";
import AdminLayout from "./layout/AdminLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ModulesPage from "./pages/ModulesPage";
import ModuleEditPage from "./pages/ModuleEditPage";
import SectionEditPage from "./pages/SectionEditPage";
import DocumentsPage from "./pages/DocumentsPage";
import StaffPage from "./pages/StaffPage";
import StaffDetailPage from "./pages/StaffDetailPage";
import StaffRolesPage from "./pages/StaffRolesPage";
import LocationsPage from "./pages/LocationsPage";
import BackupPage from "./pages/BackupPage";
import LocationEditPage from "./pages/LocationEditPage";
import ReportsPage from "./pages/ReportsPage";
import OverduePage from "./pages/OverduePage";
import QuizReviewsPage from "./pages/QuizReviewsPage";
import QuizReviewDetailPage from "./pages/QuizReviewDetailPage";
import StaffLayout from "./layout/StaffLayout";
import StaffDashboardPage from "./pages/staff/StaffDashboardPage";
import StaffModuleViewPage from "./pages/staff/StaffModuleViewPage";
import StaffLibraryPage from "./pages/staff/StaffLibraryPage";
import MeetTheTeamPage from "./pages/staff/MeetTheTeamPage";
import StaffLocationsPage from "./pages/staff/StaffLocationsPage";
import AccountSettingsPage from "./pages/staff/AccountSettingsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function isAdminRole(roles: string[]): boolean {
  return roles.some((r) => ["administrator", "induction_admin"].includes(r));
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
            <Route index element={<StaffDashboardPage />} />
            <Route path="training/:id" element={<StaffModuleViewPage />} />
            <Route path="library" element={<StaffLibraryPage />} />
            <Route path="team" element={<MeetTheTeamPage />} />
            <Route path="locations" element={<StaffLocationsPage />} />
            <Route path="account" element={<AccountSettingsPage />} />
          </Route>

          <Route
            element={
              <RequireAuth>
                <AdminGuard />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="modules" element={<ModulesPage />} />
            <Route path="modules/:id" element={<ModuleEditPage />} />
            <Route
              path="modules/:id/sections/:sectionId"
              element={<SectionEditPage />}
            />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:id" element={<StaffDetailPage />} />
            <Route path="staff-roles" element={<StaffRolesPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="backup" element={<BackupPage />} />
            <Route path="locations/:id" element={<LocationEditPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="overdue" element={<OverduePage />} />
            <Route path="quiz-reviews" element={<QuizReviewsPage />} />
            <Route
              path="quiz-reviews/:userId/:moduleId"
              element={<QuizReviewDetailPage />}
            />
          </Route>

          {/*
            Without this, any hash that matches nothing — a stale bookmark, a
            link to a module that has since been unassigned, a typo — renders
            null and the user sees a blank page with no way back. Send them to
            the index instead, which routes on to /portal or /login according
            to role and auth state.
          */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
