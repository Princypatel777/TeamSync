import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Lock,
  Loader2,
  AlertCircle,
  Shield,
  UserCheck,
  Building2,
  GraduationCap,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';

const ROLE_DEFAULT_DASHBOARDS = {
  ADMIN: '/admin/dashboard',
  COORDINATOR: '/coordinator/dashboard',
  FACULTY: '/faculty/dashboard',
  STUDENT: '/student/dashboard',
};

const ROLES = [
  {
    id: 'ADMIN',
    label: 'Admin',
    sublabel: 'System Admin',
    icon: Shield,
    desc: 'Manage departments, cycles, users roster, and platform configuration.',
    idLabel: 'Admin Email',
    idPlaceholder: 'e.g. admin@teamsync.edu',
    demoId: 'admin@teamsync.edu',
    demoPass: 'admin123',
    theme: {
      activeBorder: 'border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20',
      iconActive: 'text-amber-600 bg-amber-100',
      btn: 'hover:bg-amber-100 text-amber-800 border-amber-300 bg-amber-50',
      submitBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    },
  },
  {
    id: 'FACULTY',
    label: 'Faculty',
    sublabel: 'Guide / Evaluator',
    icon: UserCheck,
    desc: 'Review project proposals, record weekly guidance, and grade evaluations.',
    idLabel: 'Faculty Email',
    idPlaceholder: 'e.g. faculty@teamsync.edu',
    demoId: 'faculty@teamsync.edu',
    demoPass: 'faculty123',
    theme: {
      activeBorder: 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20',
      iconActive: 'text-emerald-600 bg-emerald-100',
      btn: 'hover:bg-emerald-100 text-emerald-800 border-emerald-300 bg-emerald-50',
      submitBtn: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
    },
  },
  {
    id: 'COORDINATOR',
    label: 'Coordinator',
    sublabel: 'Dept Coordinator',
    icon: Building2,
    desc: 'Department groups oversight, faculty guide allocation, and review cycles.',
    idLabel: 'Coordinator Email',
    idPlaceholder: 'e.g. coordinator@teamsync.edu',
    demoId: 'coordinator@teamsync.edu',
    demoPass: 'coord123',
    theme: {
      activeBorder: 'border-purple-500 bg-purple-50/70 text-purple-950 ring-2 ring-purple-500/20',
      iconActive: 'text-purple-600 bg-purple-100',
      btn: 'hover:bg-purple-100 text-purple-800 border-purple-300 bg-purple-50',
      submitBtn: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
    },
  },
  {
    id: 'STUDENT',
    label: 'Student',
    sublabel: 'Project Member',
    icon: GraduationCap,
    desc: 'Submit proposals, requirements, Kanban boards, and GitHub repos.',
    idLabel: 'Enrollment Number / Email',
    idPlaceholder: 'e.g. 24IT001 or student email',
    demoId: '24IT001',
    demoPass: 'student123',
    theme: {
      activeBorder: 'border-blue-500 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20',
      iconActive: 'text-blue-600 bg-blue-100',
      btn: 'hover:bg-blue-100 text-blue-800 border-blue-300 bg-blue-50',
      submitBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  },
];

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState('STUDENT');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const currentRole = ROLES.find((r) => r.id === selectedRole) || ROLES[3];
  const CurrentRoleIcon = currentRole.icon;

  const handleSelectRole = (role) => {
    setSelectedRole(role.id);
    setLocalError('');
    clearError();
  };

  const handleAutofill = (role) => {
    setSelectedRole(role.id);
    setLoginId(role.demoId);
    setPassword(role.demoPass);
    setLocalError('');
    clearError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!loginId.trim()) {
      setLocalError(`Please enter your ${currentRole.idLabel.toLowerCase()}`);
      return;
    }

    if (!password) {
      setLocalError('Please enter your password');
      return;
    }

    const result = await login(loginId, password);
    if (result.success) {
      const redirectPath = ROLE_DEFAULT_DASHBOARDS[result.user.role] || '/student/dashboard';
      navigate(redirectPath, { replace: true });
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/40 p-4 relative overflow-hidden">
      {/* Background Subtle Gradient Blobs & Ambient Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/80 overflow-hidden relative z-10">
        {/* Header Branding */}
        <div className="bg-gradient-to-b from-slate-50 to-white px-8 py-6 text-center border-b border-slate-100">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-md shadow-blue-500/25 ring-4 ring-blue-50">
              TS
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">TeamSync</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            College SGP Project Management Platform
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Sign In to Your Account
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your credentials to access your account.
            </p>
          </div>

          {/* Error Banner */}
          {displayError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {/* ================= ROLE SELECTOR SECTION ================= */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Your Role
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                Active: <span className="font-bold text-slate-800">{currentRole.label}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROLES.map((r) => {
                const isSelected = selectedRole === r.id;
                const RoleIcon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? r.theme.activeBorder
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center mb-1.5 transition-colors ${
                        isSelected ? r.theme.iconActive : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <RoleIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold leading-tight">{r.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-full">
                      {r.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Role Helper Banner with Autofill */}
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start sm:items-center space-x-2 text-xs text-slate-600 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                <span className="text-[11px] leading-relaxed">
                  <strong className="text-slate-800">{currentRole.label} Portal:</strong> {currentRole.desc}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAutofill(currentRole)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border shadow-xs shrink-0 flex items-center space-x-1.5 transition cursor-pointer ${currentRole.theme.btn}`}
                title={`Autofill demo credentials for ${currentRole.label}`}
              >
                <span>⚡ Auto-fill {currentRole.label}</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier Field */}
            <div>
              <div className="mb-1">
                <label
                  htmlFor="loginId"
                  className="block text-xs font-medium text-slate-700 uppercase tracking-wider"
                >
                  {currentRole.idLabel}
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <CurrentRoleIcon className="w-4 h-4" />
                </div>
                <input
                  id="loginId"
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder={currentRole.idPlaceholder}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full mt-2 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed text-sm cursor-pointer ${currentRole.theme.submitBtn}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating {currentRole.label}...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Sign In as {currentRole.label}
                </>
              )}
            </button>
          </form>

          {/* Bottom Link to Register */}
          <div className="text-center pt-4 border-t border-slate-100 mt-5">
            <span className="text-xs text-slate-500">First time opening this application? </span>
            <Link
              to="/register"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Register here
            </Link>
          </div>
        </div>

        {/* Card Footer */}
        <div className="bg-slate-50 px-8 py-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Institutional SGP Portal</span>
          <span className="font-mono text-slate-400">TeamSync v1.2.0</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
