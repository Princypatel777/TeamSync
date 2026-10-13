import React from 'react';
import { useAuthStore } from '../../store/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import { ShieldCheck, Users, Building, Layers, Activity } from 'lucide-react';

export const AdminDashboard = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Admin Control Center
            </h1>
            <StatusBadge status="ACTIVE" customLabel="System Online" />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span>. Full institutional control system activated.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600">
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          <span>Role: ADMIN</span>
        </div>
      </div>

      {/* Quick Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">System Users</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">5</div>
          <div className="text-xs text-slate-500 mt-1">Initial seed accounts active</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Departments</span>
            <Building className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">0</div>
          <div className="text-xs text-slate-500 mt-1">Active Departments</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">SGP Cycles</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">0</div>
          <div className="text-xs text-slate-500 mt-1">Active Cycles</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">System Status</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">Operational</div>
          <div className="text-xs text-slate-500 mt-1">JWT Auth & RBAC Active</div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
