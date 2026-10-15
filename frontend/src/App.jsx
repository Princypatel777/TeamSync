import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import PlaceholderPage from './components/common/PlaceholderPage';

// Dashboards
import AdminDashboard from './pages/dashboards/AdminDashboard';
import CoordinatorDashboard from './pages/dashboards/CoordinatorDashboard';
import CoordinatorReviewsPage from './pages/coordinator/CoordinatorReviewsPage';
import CoordinatorMarksPage from './pages/coordinator/CoordinatorMarksPage';
import FacultyDashboardPage from './pages/faculty/FacultyDashboardPage';
import FacultyReviewDesk from './pages/dashboards/FacultyReviewDesk';
import FacultyMarksPage from './pages/faculty/FacultyMarksPage';
import StudentDashboard from './pages/dashboards/StudentDashboard';

// Milestone 2 Pages
import AdminStudentsPage from './pages/admin/AdminStudentsPage';
import AdminFacultyPage from './pages/admin/AdminFacultyPage';
import AdminDepartmentsPage from './pages/admin/AdminDepartmentsPage';
import StudentProfilePage from './pages/student/StudentProfilePage';
import StudentGroupPage from './pages/student/StudentGroupPage';

// Milestone 3 Pages
import StudentProposalPage from './pages/student/StudentProposalPage';
import FacultyProposalsPage from './pages/faculty/FacultyProposalsPage';
import FacultyAnalyticsPage from './pages/faculty/FacultyAnalyticsPage';
import { FacultyProfilePage } from './pages/faculty/FacultyProfilePage';
import { CommonCalendarPage } from './pages/common/CommonCalendarPage';
import FacultyGroupWorkspace from './pages/faculty/FacultyGroupWorkspace';
import FacultyAssignedGroupsPage from './pages/faculty/FacultyAssignedGroupsPage';
import AdminFacultyAssignPage from './pages/admin/AdminFacultyAssignPage';

// Milestone 4 Pages
import StudentKanbanPage from './pages/student/StudentKanbanPage';
import StudentFeaturesPage from './pages/student/StudentFeaturesPage';
import StudentBugsPage from './pages/student/StudentBugsPage';
import StudentRequirementsPage from './pages/student/StudentRequirementsPage';

// Milestone 5 Pages
import StudentMilestonesPage from './pages/student/StudentMilestonesPage';
import StudentWikiPage from './pages/student/StudentWikiPage';
import StudentChatPage from './pages/student/StudentChatPage';
import StudentFilesPage from './pages/student/StudentFilesPage';

// Milestone 6 Pages
import StudentGithubPage from './pages/student/StudentGithubPage';
import StudentReleasesPage from './pages/student/StudentReleasesPage';
import StudentCalendarPage from './pages/student/StudentCalendarPage';

// Milestone 7 Pages
import FacultyGuidancePage from './pages/faculty/FacultyGuidancePage';
import StudentPeerEvalPage from './pages/student/StudentPeerEvalPage';

// Milestone 8 Pages
import StudentQaPage from './pages/student/StudentQaPage';

// Milestone 9 Pages
import StudentMarksPage from './pages/student/StudentMarksPage';
import AdminEvaluationPage from './pages/admin/AdminEvaluationPage';

// Milestone 10 Pages
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';
import AdminAiSettingsPage from './pages/admin/AdminAiSettingsPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';

// Coordinator Pages
import CoordinatorStudentsPage from './pages/coordinator/CoordinatorStudentsPage';
import CoordinatorGroupsPage from './pages/coordinator/CoordinatorGroupsPage';
import CoordinatorProjectsPage from './pages/coordinator/CoordinatorProjectsPage';
import CoordinatorFacultyAssignPage from './pages/coordinator/CoordinatorFacultyAssignPage';
import CoordinatorAnalyticsPage from './pages/coordinator/CoordinatorAnalyticsPage';
import NotificationsPage from './pages/common/NotificationsPage';

// Icons for remaining placeholder pages
import {
  Users,
  FolderGit2,
  FileText,
  ClipboardList,
  Layers,
  CheckSquare,
  Sparkles,
  Kanban,
  Bug,
  Flag,
  FileCode,
  MessageSquare,
  Github,
  Calendar,
  Award,
  Bell,
  Settings,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RoleBasedIndexRedirect = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'ADMIN':
      return <Navigate to="/admin/dashboard" replace />;
    case 'COORDINATOR':
      return <Navigate to="/coordinator/dashboard" replace />;
    case 'FACULTY':
      return <Navigate to="/faculty/dashboard" replace />;
    case 'STUDENT':
    default:
      return <Navigate to="/student/dashboard" replace />;
  }
};

export const App = () => {
  const { fetchMe, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      fetchMe();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/signup" element={<RegisterPage />} />

          {/* Protected Routes wrapped in DashboardLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleBasedIndexRedirect />} />
            
            {/* ================= ADMIN ROUTES ================= */}
            <Route path="admin/dashboard" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="admin/students" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminStudentsPage /></ProtectedRoute>} />
            <Route path="admin/faculty" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminFacultyPage /></ProtectedRoute>} />
            <Route path="admin/coordinators" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminFacultyPage /></ProtectedRoute>} />
            <Route path="admin/departments" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDepartmentsPage /></ProtectedRoute>} />
            <Route path="admin/academic-years" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDepartmentsPage /></ProtectedRoute>} />
            <Route path="admin/sgp-cycles" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDepartmentsPage /></ProtectedRoute>} />
            <Route path="admin/groups" element={<ProtectedRoute allowedRoles={['ADMIN']}><CoordinatorGroupsPage /></ProtectedRoute>} />
            <Route path="admin/projects" element={<ProtectedRoute allowedRoles={['ADMIN']}><CoordinatorProjectsPage /></ProtectedRoute>} />
            <Route path="admin/faculty-assign" element={<ProtectedRoute allowedRoles={['ADMIN']}><CoordinatorFacultyAssignPage /></ProtectedRoute>} />
            <Route path="admin/reviews" element={<ProtectedRoute allowedRoles={['ADMIN']}><CoordinatorReviewsPage /></ProtectedRoute>} />
            <Route path="admin/marks" element={<ProtectedRoute allowedRoles={['ADMIN']}><CoordinatorMarksPage /></ProtectedRoute>} />
            <Route path="admin/evaluation-criteria" element={<Navigate to="/admin/marks" replace />} />
            <Route path="admin/analytics" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminAnalyticsPage /></ProtectedRoute>} />
            <Route path="admin/notifications" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminNotificationsPage /></ProtectedRoute>} />
            <Route path="admin/audit-logs" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminAuditLogsPage /></ProtectedRoute>} />
            <Route path="admin/settings" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminAiSettingsPage /></ProtectedRoute>} />
            <Route path="admin/ai-settings" element={<Navigate to="/admin/settings" replace />} />

            {/* ================= COORDINATOR ROUTES ================= */}
            <Route path="coordinator/dashboard" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CoordinatorDashboard /></ProtectedRoute>} />
            <Route path="coordinator/students" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CoordinatorStudentsPage /></ProtectedRoute>} />
            <Route path="coordinator/groups" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CoordinatorGroupsPage /></ProtectedRoute>} />
            <Route path="coordinator/projects" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CoordinatorProjectsPage /></ProtectedRoute>} />
            <Route path="coordinator/faculty-assign" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CoordinatorFacultyAssignPage /></ProtectedRoute>} />
            <Route path="coordinator/reviews" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CoordinatorReviewsPage /></ProtectedRoute>} />
            <Route path="coordinator/marks" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CoordinatorMarksPage /></ProtectedRoute>} />
            <Route path="coordinator/evaluation-criteria" element={<Navigate to="/coordinator/marks" replace />} />
            <Route path="coordinator/analytics" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CoordinatorAnalyticsPage /></ProtectedRoute>} />
            <Route path="coordinator/calendar" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><CommonCalendarPage coordinatorMode={true} /></ProtectedRoute>} />
            <Route path="coordinator/notifications" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><AdminNotificationsPage /></ProtectedRoute>} />
            <Route path="coordinator/profile" element={<ProtectedRoute allowedRoles={['COORDINATOR', 'ADMIN']}><FacultyProfilePage /></ProtectedRoute>} />

            {/* ================= FACULTY ROUTES ================= */}
            <Route path="faculty/dashboard" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyDashboardPage /></ProtectedRoute>} />
            <Route path="faculty/group/:groupId" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyGroupWorkspace /></ProtectedRoute>} />
            <Route path="faculty/projects" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyAssignedGroupsPage /></ProtectedRoute>} />
            <Route path="faculty/proposals" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyProposalsPage /></ProtectedRoute>} />
            <Route path="faculty/guidance" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyGuidancePage /></ProtectedRoute>} />
            <Route path="faculty/reviews" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyReviewDesk /></ProtectedRoute>} />
            <Route path="faculty/marks" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyMarksPage /></ProtectedRoute>} />
            <Route path="faculty/analytics" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyAnalyticsPage /></ProtectedRoute>} />
            <Route path="faculty/notifications" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><AdminNotificationsPage /></ProtectedRoute>} />
            <Route path="faculty/calendar" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><CommonCalendarPage facultyMode={true} /></ProtectedRoute>} />
            <Route path="faculty/profile" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyProfilePage /></ProtectedRoute>} />
            
            {/* ================= STUDENT ROUTES ================= */}
            <Route path="student/dashboard" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentDashboard /></ProtectedRoute>} />
            <Route path="student/profile" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentProfilePage /></ProtectedRoute>} />
            <Route path="student/group" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentGroupPage /></ProtectedRoute>} />
            <Route path="student/project" element={<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'COORDINATOR', 'ADMIN']}><StudentProposalPage /></ProtectedRoute>} />
            <Route path="student/proposal" element={<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'COORDINATOR', 'ADMIN']}><StudentProposalPage /></ProtectedRoute>} />
            <Route path="student/requirements" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentRequirementsPage /></ProtectedRoute>} />
            <Route path="student/features" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentFeaturesPage /></ProtectedRoute>} />
            <Route path="student/kanban" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentKanbanPage /></ProtectedRoute>} />
            <Route path="student/sprints" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentKanbanPage /></ProtectedRoute>} />
            <Route path="student/kanban" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentKanbanPage /></ProtectedRoute>} />
            <Route path="student/tasks" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentKanbanPage /></ProtectedRoute>} />
            <Route path="student/bugs" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentBugsPage /></ProtectedRoute>} />
            <Route path="student/milestones" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentMilestonesPage /></ProtectedRoute>} />
            <Route path="student/files" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentFilesPage /></ProtectedRoute>} />
            <Route path="student/wiki" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentWikiPage /></ProtectedRoute>} />
            <Route path="student/chat" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentChatPage /></ProtectedRoute>} />
            <Route path="student/github" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentGithubPage /></ProtectedRoute>} />
            <Route path="student/releases" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="student/calendar" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentCalendarPage /></ProtectedRoute>} />
            <Route path="student/reviews" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentMarksPage /></ProtectedRoute>} />
            <Route path="student/peer-evaluation" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentPeerEvalPage /></ProtectedRoute>} />
            <Route path="student/qa" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><StudentQaPage /></ProtectedRoute>} />
            <Route path="student/notifications" element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}><NotificationsPage /></ProtectedRoute>} />
          </Route>

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
