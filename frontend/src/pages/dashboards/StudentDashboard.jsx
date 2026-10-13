import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import API from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Users, CheckSquare, Bell, FolderGit2, Activity, Clock, Calendar, CheckCircle, UploadCloud, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export const StudentDashboard = () => {
  const { user } = useAuthStore();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['studentDashboard'],
    queryFn: async () => {
      const res = await API.get('/student/dashboard');
      return res.data;
    },
  });

  if (isLoading) return <LoadingSpinner text="Loading your workspace..." />;

  const data = dashboardData || {};
  const hasGroup = data.hasGroup;
  const project = data.project;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Student Workspace
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-700">{user?.name} 👋</span>
            <br />
            <span className="font-mono text-xs">{user?.enrollmentNumber}</span>
          </p>
        </div>
        <div className="text-xs font-mono bg-blue-50 px-3 py-1.5 rounded-lg text-blue-700 font-semibold border border-blue-200">
          Role: STUDENT
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/student/group" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors block">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Group Status</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          {hasGroup ? (
            <>
              <div className="text-sm font-semibold text-slate-700 flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> ACTIVE
              </div>
              <div className="text-xs text-slate-500 mt-1">{data.group?.membersCount || 0} Members</div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-slate-700 flex items-center">
                <span className="w-2 h-2 rounded-full bg-slate-300 mr-2"></span> No Active Group
              </div>
              <div className="text-xs text-slate-500 mt-1">Form or join a group</div>
            </>
          )}
        </Link>

        <Link to="/student/proposal" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors block">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Project</span>
            <FolderGit2 className="w-4 h-4 text-indigo-600" />
          </div>
          {project ? (
            <>
              <div className="text-sm font-semibold text-slate-700 truncate" title={project.title}>
                {project.title || 'SGP Project'}
              </div>
              <div className="text-xs font-medium text-emerald-600 mt-1 flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span> {project.status}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-slate-700">No Active Project</div>
            </>
          )}
        </Link>

        <Link to="/student/kanban" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors block">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">My Tasks</span>
            <CheckSquare className="w-4 h-4 text-amber-500" />
          </div>
          {data.tasks ? (
            <div className="space-y-1 mt-2">
              <div className="text-xs text-slate-600 flex justify-between font-medium"><span>{data.tasks.pending}</span> <span className="text-slate-500">Pending</span></div>
              <div className="text-xs text-slate-600 flex justify-between font-medium"><span>{data.tasks.inProgress}</span> <span className="text-slate-500">In Progress</span></div>
              <div className="text-xs text-rose-600 flex justify-between font-bold"><span>{data.tasks.dueSoon}</span> <span>Due Soon</span></div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-1">No tasks assigned</div>
          )}
        </Link>

        <Link to="/student/notifications" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors block">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Notifications</span>
            <Bell className={`w-4 h-4 ${(data.notificationsCount || 0) > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-bold text-slate-800">{data.notificationsCount || 0}</div>
          <div className="text-xs text-slate-500 mt-1">New notifications</div>
        </Link>
      </div>

      {project && data.progress && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Project Progress */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-blue-600" /> PROJECT PROGRESS
                </h3>
                <span className="text-sm font-bold text-blue-600">{data.progress.overall}%</span>
              </div>
              
              <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
                <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${data.progress.overall}%` }}></div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Features</div>
                  <div className="flex items-center">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mr-2">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${data.progress.features}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{data.progress.features}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Tasks</div>
                  <div className="flex items-center">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mr-2">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${data.progress.tasks}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{data.progress.tasks}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Milestones</div>
                  <div className="flex items-center">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mr-2">
                      <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${data.progress.milestones}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{data.progress.milestones}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 flex items-center mb-4">
                <Clock className="w-4 h-4 mr-2 text-rose-500" /> UPCOMING DEADLINES
              </h3>
              <div className="space-y-3">
                {data.deadlines?.map(deadline => (
                  <div key={deadline.id} className="flex items-start p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors cursor-pointer">
                    <div className={`mt-0.5 w-2.5 h-2.5 rounded-full mr-3 shrink-0 ${
                      deadline.urgency === 'high' ? 'bg-rose-500' :
                      deadline.urgency === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{deadline.title}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" /> Due {deadline.due}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs h-full">
              <h3 className="text-base font-bold text-slate-800 flex items-center mb-4 pb-3 border-b border-slate-100">
                <Activity className="w-4 h-4 mr-2 text-slate-600" /> RECENT ACTIVITY
              </h3>
              <div className="space-y-4">
                {data.activity?.map(act => (
                  <div key={act.id} className="flex items-start">
                    <div className="p-1.5 rounded-full bg-slate-100 text-slate-500 mr-3 shrink-0">
                      {act.type === 'task' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      {act.type === 'file' && <UploadCloud className="w-3.5 h-3.5 text-blue-500" />}
                      {act.type === 'comment' && <MessageSquare className="w-3.5 h-3.5 text-amber-500" />}
                      {act.type === 'feature' && <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    <div>
                      <div className="text-sm text-slate-700 font-medium">{act.text}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{act.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;

