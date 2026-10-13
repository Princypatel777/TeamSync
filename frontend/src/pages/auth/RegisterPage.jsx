import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import API from '../../services/api';
import {
  Lock,
  Loader2,
  AlertCircle,
  Shield,
  UserCheck,
  GraduationCap,
  Eye,
  EyeOff,
  CheckCircle2,
  User,
  Mail,
  CreditCard,
  Building,
  School,
  X,
  ArrowRight,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

const ROLE_DEFAULT_DASHBOARDS = {
  ADMIN: '/admin/dashboard',
  COORDINATOR: '/coordinator/dashboard',
  FACULTY: '/faculty/dashboard',
  STUDENT: '/student/dashboard',
};

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, loginWithGoogle, isLoading, error, clearError } = useAuthStore();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    collegeId: '',
    role: 'STUDENT',
    departmentId: '',
    semester: 5,
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Google Modal State
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleCollegeId, setGoogleCollegeId] = useState('');
  const [googleDeptId, setGoogleDeptId] = useState('');
  const [googleRole, setGoogleRole] = useState('STUDENT');
  const [googleNeedsSetup, setGoogleNeedsSetup] = useState(false);

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await API.get('/auth/departments');
        if (res.data?.departments && res.data.departments.length > 0) {
          setDepartments(res.data.departments);
          setForm((prev) => ({ ...prev, departmentId: res.data.departments[0]._id }));
          setGoogleDeptId(res.data.departments[0]._id);
        }
      } catch (err) {
        setDepartments([
          { _id: 'dept_it', name: 'Information Technology', code: 'IT' },
          { _id: 'dept_cse', name: 'Computer Science & Engineering', code: 'CSE' },
        ]);
      }
    };
    fetchDepartments();
  }, []);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');
    clearError();

    if (!form.firstName.trim()) {
      setLocalError('First name is required');
      return;
    }
    if (!form.lastName.trim()) {
      setLocalError('Last name is required');
      return;
    }
    if (!form.email.trim()) {
      setLocalError('College email ID is required');
      return;
    }
    if (!form.collegeId.trim()) {
      setLocalError('College ID / Enrollment Number is required');
      return;
    }
    if (!form.password || form.password.length < 6) {
      setLocalError('Password must be at least 6 characters long');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    const result = await register({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      collegeId: form.collegeId.trim().toUpperCase(),
      role: form.role,
      departmentId: form.departmentId || departments[0]?._id,
      semester: Number(form.semester) || 5,
    });

    if (result.success) {
      setSuccessMsg('Account created successfully! Welcome to TeamSync.');
      setTimeout(() => {
        const redirectPath = ROLE_DEFAULT_DASHBOARDS[result.user.role] || '/student/dashboard';
        navigate(redirectPath, { replace: true });
      }, 700);
    }
  };

  const handleGoogleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!googleEmail.trim()) {
      setLocalError('Please enter your college email');
      return;
    }

    const payload = {
      email: googleEmail.trim(),
      name: googleName.trim() || googleEmail.split('@')[0],
      collegeId: googleCollegeId.trim().toUpperCase(),
      departmentId: googleDeptId || departments[0]?._id,
      role: googleRole,
    };

    const result = await loginWithGoogle(payload);
    if (result.success) {
      setIsGoogleModalOpen(false);
      const redirectPath = ROLE_DEFAULT_DASHBOARDS[result.user.role] || '/student/dashboard';
      navigate(redirectPath, { replace: true });
    } else if (result.requiresSetup) {
      setGoogleNeedsSetup(true);
      setLocalError('First-time Google Sign-In: Please enter your College ID to complete initial registration.');
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
        {/* Header */}
        <div className="bg-gradient-to-b from-slate-50 to-white px-8 py-6 text-center border-b border-slate-100">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-md shadow-blue-500/25 ring-4 ring-blue-50">
              TS
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">TeamSync</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Create Your Official College Project Account
          </p>

          {/* Direct Switch to Sign In */}
          <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-center gap-2 text-xs">
            <span className="text-slate-500">Already registered?</span>
            <Link
              to="/login"
              className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors hover:underline"
            >
              Sign In to your account <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {/* Notifications */}
          {displayError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ================= GOOGLE DIRECT SIGN IN OPTION ================= */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => {
                setGoogleEmail('');
                setGoogleName('');
                setGoogleCollegeId('');
                setGoogleNeedsSetup(false);
                setLocalError('');
                setIsGoogleModalOpen(true);
              }}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-xl text-slate-700 font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2.5 cursor-pointer group"
            >
              <GoogleIcon />
              <span>Direct Access with Google (College Email Only)</span>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Institutional
              </span>
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-1.5 flex items-center justify-center gap-1">
              <School className="w-3.5 h-3.5 text-slate-400" />
              Only official college email IDs (@*.edu, @*.edu.in, @charusat.edu.in) are accepted
            </p>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-bold">
                <span className="bg-white px-3 text-slate-400">Or Fill Institutional Form</span>
              </div>
            </div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {/* First Name & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sharma"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Role <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'STUDENT' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    form.role === 'STUDENT'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" /> Student Member
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, role: 'FACULTY' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    form.role === 'FACULTY'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4" /> Faculty Guide
                </button>
              </div>
            </div>

            {/* College Email ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                College Email ID <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="e.g. 24it001@charusat.edu.in or user@college.edu"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Must be an institutional address (@*.edu, @*.edu.in, @charusat.edu.in, @teamsync.edu)
              </span>
            </div>

            {/* College ID / Enrollment Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {form.role === 'STUDENT' ? 'College ID / Enrollment Number' : 'College Faculty ID'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder={form.role === 'STUDENT' ? 'e.g. 24IT001' : 'e.g. FAC-102'}
                  value={form.collegeId}
                  onChange={(e) => setForm({ ...form, collegeId: e.target.value.toUpperCase() })}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Department and Semester */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.role === 'STUDENT' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Semester
                  </label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Assistant Professor"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500"
                  />
                </div>
              )}
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Create Account & Sign In
                </>
              )}
            </button>
          </form>

          {/* Bottom Link to Sign In */}
          <div className="text-center pt-4 border-t border-slate-100 mt-5">
            <span className="text-xs text-slate-500">Already registered your account? </span>
            <Link
              to="/login"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Sign In here
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-8 py-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Institutional Registration</span>
          <span className="font-mono text-slate-400">TeamSync v1.2.0</span>
        </div>
      </div>

      {/* ================= GOOGLE REGISTRATION MODAL ================= */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200/80">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <GoogleIcon />
                <h3 className="font-bold text-slate-800 text-sm">
                  Google Institutional Sign-In
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGoogleSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>College Domain Check:</strong> Only verified college emails (@*.edu, @*.edu.in, @charusat.edu.in, @teamsync.edu) can register.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google College Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. 24it001@charusat.edu.in"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {(googleNeedsSetup || !googleCollegeId) && (
                <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      College ID Verification
                    </span>
                    <span className="text-[10px] text-slate-400">Required</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      College ID / Enrollment Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 24IT001 or FAC-101"
                      value={googleCollegeId}
                      onChange={(e) => setGoogleCollegeId(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Role</label>
                      <select
                        value={googleRole}
                        onChange={(e) => setGoogleRole(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                      >
                        <option value="STUDENT">Student</option>
                        <option value="FACULTY">Faculty</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">Department</label>
                      <select
                        value={googleDeptId}
                        onChange={(e) => setGoogleDeptId(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium truncate"
                      >
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>{d.code}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setGoogleEmail('24it001@charusat.edu.in');
                    setGoogleName('Rahul Sharma');
                    setGoogleCollegeId('24IT001');
                    setGoogleRole('STUDENT');
                  }}
                  className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                >
                  ⚡ Fill Sample College Google Account
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !googleEmail.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Sign In with Google'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterPage;
