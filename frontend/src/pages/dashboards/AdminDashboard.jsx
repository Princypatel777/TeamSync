import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import API from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  ShieldCheck,
  Users,
  GraduationCap,
  Building,
  Layers,
  Activity,
  CheckCircle2,
  FolderGit2,
  Award,
  ArrowRight,
  Settings,
  Download,
  RefreshCw,
  Bug,
  CheckSquare,
  Sparkles,
  Calendar,
  Clock,
  Shield,
  FileText,
} from 'lucide-react';

export const AdminDashboard = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Live institutional analytics
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['adminAnalyticsDashboard'],
    queryFn: async () => {
      const res = await API.get('/platform/analytics');
      return res.data;
    },
    refetchInterval: 10000,
  });

  // Recent audit logs preview
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['adminRecentAuditLogs'],
    queryFn: async () => {
      const res = await API.get('/platform/audit-logs?limit=5');
      return res.data;
    },
    refetchInterval: 15000,
  });

  if (analyticsLoading) {
    return <LoadingSpinner message="Loading Institutional Control Center..." />;
  }

  const kpis = analyticsData?.kpis || {
    totalUsers: 0,
    totalStudents: 0,
    totalFaculty: 0,
    totalCoordinators: 0,
    totalAdmins: 0,
    totalDepartments: 0,
    totalSgpCycles: 0,
    totalAcademicYears: 0,
    totalGroups: 0,
    approvedProjects: 0,
    pendingProposals: 0,
    totalTasks: 0,
    completedTasks: 0,
    avgTaskCompletionRate: 0,
    totalBugs: 0,
    resolvedBugs: 0,
    defectResolutionRate: 100,
    gradeDistribution: {},
  };

  const gradeDist = kpis.gradeDistribution || {};
  const recentLogs = auditData?.logs || [];

  const handleExportCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      `Metric,Value\n` +
      `Total Users,${kpis.totalUsers}\n` +
      `Total Students,${kpis.totalStudents}\n` +
      `Faculty Mentors,${kpis.totalFaculty}\n` +
      `Coordinators,${kpis.totalCoordinators}\n` +
      `System Admins,${kpis.totalAdmins}\n` +
      `Active Departments,${kpis.totalDepartments}\n` +
      `Active SGP Cycles,${kpis.totalSgpCycles}\n` +
      `Academic Years,${kpis.totalAcademicYears}\n` +
      `Active Groups,${kpis.totalGroups}\n` +
      `Approved Projects,${kpis.approvedProjects}\n` +
      `Pending Proposals,${kpis.pendingProposals}\n` +
      `Total Tasks,${kpis.totalTasks}\n` +
      `Completed Tasks,${kpis.completedTasks}\n` +
      `Task Completion Rate,${kpis.avgTaskCompletionRate}%\n` +
      `Total Defects,${kpis.totalBugs}\n` +
      `Resolved Defects,${kpis.resolvedBugs}\n` +
      `Defect Resolution Rate,${kpis.defectResolutionRate}%`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'TeamSync_Institutional_Analytics_Summary.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Institutional Admin Control Center
            </h1>
            <StatusBadge status="ACTIVE" customLabel="System Online" />
          </div>
          <p className="text-sm text-slate-300 mt-1">
            Welcome back, <span className="font-semibold text-white">{user?.name}</span>. Full institutional governance, user provisioning & live academic cycle management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetch();
              queryClient.invalidateQueries(['adminRecentAuditLogs']);
            }}
            disabled={isRefetching}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
            title="Refresh Live Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-purple-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <div className="flex items-center space-x-1.5 text-xs font-mono bg-slate-800/80 px-3 py-2 rounded-lg text-purple-300 border border-purple-500/30">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>ADMIN</span>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Link
          to="/admin/students"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total System Users</span>
            <Users className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-extrabold text-slate-800 font-mono">{kpis.totalUsers}</div>
          <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-1.5">
            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-medium">
              {kpis.totalStudents} Students
            </span>
            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[11px] font-medium">
              {kpis.totalFaculty} Faculty
            </span>
            <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[11px] font-medium">
              {kpis.totalCoordinators} Coord
            </span>
          </div>
        </Link>

        {/* Academic Departments */}
        <Link
          to="/admin/departments"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Departments</span>
            <Building className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-extrabold text-slate-800 font-mono">{kpis.totalDepartments}</div>
          <div className="text-xs text-slate-500 mt-2">
            Active Academic Departments configured
          </div>
        </Link>

        {/* SGP Cycles & Academic Years */}
        <Link
          to="/admin/sgp-cycles"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">SGP Cycles</span>
            <Layers className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-extrabold text-slate-800 font-mono">{kpis.totalSgpCycles}</div>
          <div className="text-xs text-slate-500 mt-2">
            Across {kpis.totalAcademicYears} Academic Year{kpis.totalAcademicYears !== 1 ? 's' : ''}
          </div>
        </Link>

        {/* System Health / Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">System Status</span>
            <Activity className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Operational
          </div>
          <div className="text-xs text-slate-500 mt-2">
            MongoDB Connected • JWT & RBAC Active
          </div>
        </div>
      </div>

      {/* Secondary Project & Execution Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Groups */}
        <Link
          to="/admin/groups"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Active Groups</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{kpis.totalGroups}</div>
          <div className="text-xs text-slate-500 mt-1">
            {kpis.totalStudents} Students enrolled
          </div>
        </Link>

        {/* Approved Projects */}
        <Link
          to="/admin/projects"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-purple-300 transition group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Approved Projects</span>
            <FolderGit2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{kpis.approvedProjects}</div>
          <div className="text-xs text-slate-500 mt-1">
            {kpis.pendingProposals} pending approval
          </div>
        </Link>

        {/* Task Completion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Task Completion</span>
            <CheckSquare className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-600 font-mono">{kpis.avgTaskCompletionRate}%</span>
            <span className="text-xs text-slate-500">{kpis.completedTasks}/{kpis.totalTasks} done</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.avgTaskCompletionRate))}%` }}
            ></div>
          </div>
        </div>

        {/* Defect Resolution Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Defect Resolution</span>
            <Bug className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-600 font-mono">{kpis.defectResolutionRate}%</span>
            <span className="text-xs text-slate-500">{kpis.resolvedBugs}/{kpis.totalBugs} fixed</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-rose-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.defectResolutionRate))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Visual Analytics & Grade Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Institutional Grade Distribution */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center">
              <Award className="w-4 h-4 mr-2 text-amber-500" />
              Institutional Grade Distribution
            </h3>
            <Link
              to="/admin/analytics"
              className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1"
            >
              Full Analytics <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {['A+', 'A', 'B+', 'B', 'C', 'F'].map((grade) => {
              const count = gradeDist[grade] || 0;
              return (
                <div
                  key={grade}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-center space-y-1 hover:border-slate-300 transition"
                >
                  <span className="text-sm font-bold text-slate-700 block">{grade}</span>
                  <span className="text-2xl font-extrabold text-purple-600 font-mono block">
                    {count}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Students</span>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
            <span>Overall Evaluation Pipeline:</span>
            <span className="font-semibold text-slate-800">
              {Object.values(gradeDist).reduce((acc, curr) => acc + curr, 0)} Students Graded
            </span>
          </div>
        </div>

        {/* User Breakdown Meter */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center">
            <Users className="w-4 h-4 mr-2 text-blue-500" />
            User Distribution Breakdown
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                <span>Students</span>
                <span className="font-bold text-slate-800">{kpis.totalStudents}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${kpis.totalUsers > 0 ? (kpis.totalStudents / kpis.totalUsers) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                <span>Faculty Mentors</span>
                <span className="font-bold text-slate-800">{kpis.totalFaculty}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{
                    width: `${kpis.totalUsers > 0 ? (kpis.totalFaculty / kpis.totalUsers) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                <span>Department Coordinators</span>
                <span className="font-bold text-slate-800">{kpis.totalCoordinators}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: `${kpis.totalUsers > 0 ? (kpis.totalCoordinators / kpis.totalUsers) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                <span>System Administrators</span>
                <span className="font-bold text-slate-800">{kpis.totalAdmins}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-slate-700 h-2 rounded-full"
                  style={{
                    width: `${kpis.totalUsers > 0 ? (kpis.totalAdmins / kpis.totalUsers) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Accounts:</span>
            <span className="font-bold text-slate-800">{kpis.totalUsers} registered</span>
          </div>
        </div>
      </div>

      {/* Admin Modules Quick Launch */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            Institutional Administration Modules
          </h2>
          <span className="text-xs text-slate-400">Quick Navigation Desk</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/admin/students"
            className="p-4 bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 rounded-xl transition group"
          >
            <div className="flex items-center justify-between">
              <GraduationCap className="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Student Provisioning</h3>
            <p className="text-xs text-slate-500 mt-1">
              Enrollments, passwords, and student profile verification ({kpis.totalStudents} active).
            </p>
          </Link>

          <Link
            to="/admin/faculty"
            className="p-4 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 rounded-xl transition group"
          >
            <div className="flex items-center justify-between">
              <Users className="w-6 h-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Faculty & Mentors</h3>
            <p className="text-xs text-slate-500 mt-1">
              Create guides, assign departments, and track designations ({kpis.totalFaculty} active).
            </p>
          </Link>

          <Link
            to="/admin/departments"
            className="p-4 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-200 rounded-xl transition group"
          >
            <div className="flex items-center justify-between">
              <Building className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Academic Structure</h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure Departments, Academic Years, and SGP Cycles ({kpis.totalDepartments} depts).
            </p>
          </Link>

          <Link
            to="/admin/groups"
            className="p-4 bg-slate-50 hover:bg-purple-50/70 border border-slate-200 hover:border-purple-200 rounded-xl transition group"
          >
            <div className="flex items-center justify-between">
              <Layers className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Student Groups</h3>
            <p className="text-xs text-slate-500 mt-1">
              Department teams, member rosters, and guide associations ({kpis.totalGroups} groups).
            </p>
          </Link>

          <Link
            to="/admin/projects"
            className="p-4 bg-slate-50 hover:bg-amber-50/70 border border-slate-200 hover:border-amber-200 rounded-xl transition group"
          >
            <div className="flex items-center justify-between">
              <FolderGit2 className="w-6 h-6 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Projects & Proposals</h3>
            <p className="text-xs text-slate-500 mt-1">
              Review submissions, track approvals, and similarity checks ({kpis.approvedProjects} approved).
            </p>
          </Link>

          <Link
            to="/admin/analytics"
            className="p-4 bg-slate-50 hover:bg-sky-50/70 border border-slate-200 hover:border-sky-200 rounded-xl transition group"
          >
            <div className="flex items-center justify-between">
              <Sparkles className="w-6 h-6 text-sky-600 mb-2 group-hover:scale-110 transition-transform" />
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Detailed Performance KPIs</h3>
            <p className="text-xs text-slate-500 mt-1">
              In-depth analytics, defect resolutions, and institutional grading reports.
            </p>
          </Link>
        </div>
      </div>

      {/* Recent Audit Activity & Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Audit Trail */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                Recent System Activity
              </h3>
            </div>
            <Link
              to="/admin/audit-logs"
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              View All Logs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No recent audit records found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <div key={log._id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <div>
                      <span className="font-bold text-slate-800">{log.action}</span>
                      <span className="text-slate-500 ml-2">by {log.actorName || log.actorRole}</span>
                    </div>
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security & System Settings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center">
              <Shield className="w-4 h-4 mr-2 text-purple-600" />
              Security Governance
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Role-Based Access Control (RBAC) and bcrypt encryption protect all endpoints. All critical modifications are immutably logged to the MongoDB audit stream.
            </p>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100">
            <Link
              to="/admin/settings"
              className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Settings className="w-4 h-4" />
              <span>Platform & AI Settings</span>
            </Link>
            <Link
              to="/admin/audit-logs"
              className="w-full py-2.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Inspect Tamper-Proof Audit Trail</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
