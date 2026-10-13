import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Users, BookOpen, AlertCircle, Clock, ChevronRight } from 'lucide-react';

export const FacultyDashboardPage = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['facultyGroupsSummary'],
    queryFn: async () => {
      const res = await API.get('/faculty/groups');
      return res.data;
    }
  });

  if (isLoading) return <LoadingSpinner text="Loading Faculty Dashboard..." />;
  if (error) return <div className="p-8 text-rose-500 font-bold">Failed to load groups. Make sure you are assigned by the Coordinator.</div>;

  const { summary = {}, groups = [] } = data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Welcome Banner */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <BookOpen className="w-48 h-48" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Faculty Guide Dashboard</h1>
        <p className="text-slate-300 text-sm max-w-xl">
          Welcome back. You are currently managing {summary.totalGroups} groups. Select a group below to enter its workspace and monitor proposals, requirements, tasks, and code.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Groups</p>
            <p className="text-xl font-bold text-slate-800">{summary.totalGroups || 0}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BookOpen className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Proposals</p>
            <p className="text-xl font-bold text-slate-800">{summary.pendingProposals || 0}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Reviews</p>
            <p className="text-xl font-bold text-slate-800">{summary.pendingReviews || 0}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertCircle className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Overdue Tasks</p>
            <p className="text-xl font-bold text-slate-800">{summary.overdueTasks || 0}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><BookOpen className="w-5 h-5" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Upcoming Evals</p>
            <p className="text-xl font-bold text-slate-800">{summary.upcomingEvaluations || 0}</p>
          </div>
        </div>
      </div>

      {/* My Assigned Groups */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">My Assigned Groups</h2>
        </div>
        
        {groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No Groups Assigned</h3>
            <p className="text-slate-500 text-sm mt-1">You have not been assigned as a guide to any project groups by the Department Coordinator yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div key={group._id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold font-mono tracking-wider">
                      {group.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      group.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {group.status}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {group.activeProject ? group.activeProject.title : 'No Approved Project'}
                  </h3>
                  
                  <div className="flex items-center space-x-2 text-xs text-slate-500 mb-4">
                    <Users className="w-3.5 h-3.5" />
                    <span>{group.studentCount} Students</span>
                  </div>

                  {/* Progress Bar */}
                  {group.activeProject && (
                    <div className="space-y-1.5 mb-4">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>Project Progress</span>
                        <span>{group.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${group.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-4">
                    {group.pendingReviewsCount > 0 && (
                      <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold flex items-center">
                        📄 {group.pendingReviewsCount} Review Pending
                      </span>
                    )}
                    {group.overdueTasksCount > 0 && (
                      <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold flex items-center">
                        ⚠️ {group.overdueTasksCount} Overdue
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="p-3 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => {
                      navigate(`/faculty/group/${group._id}`);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                  >
                    <span>Open Workspace</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyDashboardPage;
