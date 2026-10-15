import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Users, Search, ChevronRight, AlertCircle, Clock } from 'lucide-react';

export const FacultyAssignedGroupsPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL');

  const { data, isLoading, error } = useQuery({
    queryKey: ['facultyAssignedGroups'],
    queryFn: async () => {
      const res = await API.get('/faculty/groups');
      return res.data;
    }
  });

  if (isLoading) return <LoadingSpinner text="Loading Assigned Groups..." />;
  if (error) return <div className="p-8 text-rose-500 font-bold">Failed to load assigned groups.</div>;

  const groups = data?.groups || [];

  const filteredGroups = groups.filter(g => {
    const matchesSearch = 
      g.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      g.activeProject?.title?.toLowerCase().includes(searchTerm.toLowerCase());
      
    if (!matchesSearch) return false;
    
    if (filter === 'ACTIVE' && g.status !== 'ACTIVE') return false;
    if (filter === 'COMPLETED' && g.status !== 'COMPLETED') return false;
    if (filter === 'PROPOSAL_PENDING' && g.pendingReviewsCount === 0) return false;
    
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <Users className="w-6 h-6 mr-3 text-blue-600" />
          Assigned Groups
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage and monitor all project groups explicitly assigned to you by the Department Coordinator.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 bg-slate-100 rounded-lg p-1">
          <button 
            onClick={() => setFilter('ALL')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            All Groups
          </button>
          <button 
            onClick={() => setFilter('PROPOSAL_PENDING')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'PROPOSAL_PENDING' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Proposal Pending
          </button>
          <button 
            onClick={() => setFilter('ACTIVE')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'ACTIVE' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Active Projects
          </button>
          <button 
            onClick={() => setFilter('COMPLETED')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${filter === 'COMPLETED' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Completed
          </button>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search Groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {filteredGroups.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Users className="w-12 h-12 text-slate-300 mb-4" />
            <p className="font-medium text-slate-700 text-lg">No groups found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Group</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Students</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map(group => (
                    <tr key={group.id || group._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                          <span className="text-blue-700 font-bold text-xs">{group.code?.split('-').pop() || 'GRP'}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{group.name || group.code}</p>
                          <p className="text-[10px] text-slate-500 font-mono font-semibold">{group.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{group.activeProject?.title || 'No Project Submitted'}</p>
                        {group.activeProject && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              group.activeProject.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              group.activeProject.status === 'SUBMITTED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {group.activeProject.status}
                            </span>
                            {group.activeProject.domain && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                • {group.activeProject.domain}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {group.activeProject && group.activeProject.status === 'APPROVED' && (
                        <div className="w-48 bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden flex items-center">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${group.progress || 0}%` }}
                          />
                          <span className="text-[10px] ml-2 text-slate-500 font-bold">{group.progress || 0}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold">
                        <Users className="w-3.5 h-3.5" />
                        <span>{group.studentCount}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        group.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                        group.status === 'COMPLETED' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {group.status}
                      </span>
                      {group.pendingReviewsCount > 0 && (
                        <div className="mt-2 flex justify-center">
                          <span className="flex items-center text-[10px] text-amber-600 font-bold">
                            <Clock className="w-3 h-3 mr-1" />
                            {group.pendingReviewsCount} Pending
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => navigate(`/faculty/group/${group.id || group._id}`)}
                        className="inline-flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm group-hover:shadow"
                      >
                        Workspace
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyAssignedGroupsPage;
