import React, { useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { LayoutDashboard, Users, FileText, ClipboardList, Layers, Kanban, Bug, Flag, FolderGit2, Github, Activity, ArrowLeft, AlertCircle, MessageSquare, Box, Calendar, X, CheckCircle2, ShieldAlert } from 'lucide-react';

import StudentRequirementsPage from '../student/StudentRequirementsPage';
import StudentKanbanPage from '../student/StudentKanbanPage';
import StudentBugsPage from '../student/StudentBugsPage';
import StudentFeaturesPage from '../student/StudentFeaturesPage';
import StudentMilestonesPage from '../student/StudentMilestonesPage';
import StudentFilesPage from '../student/StudentFilesPage';
import StudentGithubPage from '../student/StudentGithubPage';
import StudentWikiPage from '../student/StudentWikiPage';
import StudentChatPage from '../student/StudentChatPage';
import { StudentReleasesPage } from '../student/StudentReleasesPage';
import { StudentCalendarPage } from '../student/StudentCalendarPage';
import { StudentActivityPage } from '../student/StudentActivityPage';
import { StudentPermissionsPage } from '../student/StudentPermissionsPage';
// Assume these exist or will be reused
import FacultyProposalsPage from './FacultyProposalsPage';

const NoProjectEmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-500">
      <AlertCircle className="w-8 h-8" />
    </div>
    <h2 className="text-lg font-bold text-slate-800">No Active Project</h2>
    <p className="text-slate-500 text-sm max-w-md mt-2">
      This group has not yet finalized and started a project. They must submit a proposal and get it approved before this module unlocks.
    </p>
  </div>
);

export const FacultyGroupWorkspace = () => {
  const { groupId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStudentProfile, setSelectedStudentProfile] = useState(null);

  // We should ideally fetch group context to ensure the faculty is authorized
  const { data: groupData, isLoading, error } = useQuery({
    queryKey: ['facultyGroupContext', groupId],
    queryFn: async () => {
      // Create this endpoint or reuse an existing one to fetch group details + project
      const res = await API.get(`/faculty/groups/${groupId}`);
      return res.data;
    }
  });

  if (isLoading) return <LoadingSpinner text="Loading Group Workspace..." />;
  if (error) return (
    <div className="p-8 text-center bg-white rounded-xl shadow-xs border border-rose-200 text-rose-600">
      <h3 className="font-bold text-lg mb-2">Access Denied</h3>
      <p>You are not assigned to this project or the group does not exist.</p>
      <Link to="/faculty/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">Return to Dashboard</Link>
    </div>
  );

  const group = groupData?.group;
  const project = groupData?.project; // Assuming the API returns the active project

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'proposal', label: 'Proposal', icon: FileText },
    { id: 'requirements', label: 'Requirements', icon: ClipboardList },
    { id: 'features', label: 'Features', icon: Layers },
    { id: 'tasks', label: 'Tasks', icon: Kanban },
    { id: 'bugs', label: 'Bugs', icon: Bug },
    { id: 'milestones', label: 'Milestones', icon: Flag },
    { id: 'files', label: 'Files', icon: FolderGit2 },
    { id: 'wiki', label: 'Wiki', icon: FileText },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'github', label: 'GitHub', icon: Github },
    { id: 'releases', label: 'Releases', icon: Box },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'permissions', label: 'Permissions', icon: ShieldAlert },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 space-y-4">
      {/* Workspace Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 shadow-xs flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <Link to="/faculty/dashboard" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="font-mono font-bold text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {group?.code || groupId}
              </span>
              <StatusBadge status={group?.status || 'ACTIVE'} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">
              {project?.title || 'No Active Project'}
            </h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Faculty Workspace Mode</p>
          <p className="text-sm font-semibold text-emerald-600">Read & Review Only</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 px-6 pb-6">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-64 shrink-0 bg-white border border-slate-200 rounded-xl p-3 shadow-xs self-start">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6 shadow-xs min-h-[500px]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Project Overview</h2>
              <p className="text-slate-500 text-sm">Welcome to the faculty workspace. Select a tab on the left to monitor this group's progress.</p>
              {/* Insert summary cards here */}
            </div>
          )}
          {activeTab === 'members' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Group Members</h2>
                <p className="text-slate-500 text-sm">Students assigned to this project group.</p>
              </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group?.members?.map((m) => {
                  const memberUser = m.user || m.userId || {};
                  const memberId = m.id || m._id;
                  return (
                  <div 
                    key={memberId} 
                    onClick={() => setSelectedStudentProfile(m)}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center space-x-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {memberUser.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{memberUser.name || 'Unknown User'}</h3>
                      <p className="text-xs text-slate-500">{memberUser.email}</p>
                      <div className="flex space-x-2 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">
                          {m.role}
                        </span>
                        {memberUser.enrollmentNumber && (
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                            {memberUser.enrollmentNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">View Profile</span>
                    </div>
                  </div>
                  );
                })}
                {!group?.members?.length && (
                  <div className="col-span-full p-8 text-center text-slate-500">
                    No members found in this group.
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'proposal' && (
            <div className="space-y-4">
              {/* Using the FacultyProposalsPage, but it might need to be filtered by group */}
              <p className="text-slate-500 text-sm">Proposal Reviews for this specific group.</p>
              <FacultyProposalsPage specificGroupId={groupId} />
            </div>
          )}
          {activeTab === 'requirements' && (
            project ? (
              <StudentRequirementsPage facultyMode={true} specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'tasks' && (
            project ? (
              <StudentKanbanPage facultyMode={true} specificProjectId={project.id || project._id} membersList={group?.members} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'bugs' && (
            project ? (
              <StudentBugsPage facultyMode={true} specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'features' && (
            project ? (
              <StudentFeaturesPage facultyMode={true} specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'milestones' && (
            project ? (
              <StudentMilestonesPage facultyMode={true} specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'files' && (
            project ? (
              <StudentFilesPage facultyMode={true} specificProjectId={project.id || project._id} specificGroupId={groupId} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'github' && (
            project ? (
              <StudentGithubPage facultyMode={true} specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'wiki' && (
            project ? (
              <StudentWikiPage facultyMode={true} specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'chat' && (
            <StudentChatPage facultyMode={true} specificGroupId={groupId} />
          )}
          {activeTab === 'releases' && (
            project ? (
              <StudentReleasesPage facultyMode={true} specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'calendar' && (
            project ? (
              <StudentCalendarPage facultyMode={true} specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'activity' && (
            project ? (
              <StudentActivityPage specificProjectId={project.id || project._id} />
            ) : (
              <NoProjectEmptyState />
            )
          )}
          {activeTab === 'permissions' && (
            <StudentPermissionsPage facultyMode={true} specificGroupId={groupId} specificProjectId={project?.id || project?._id} />
          )}
        </div>
      </div>

      {/* Student Profile Modal */}
      {selectedStudentProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedStudentProfile(null)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="h-24 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
            
            <div className="px-6 pb-6 relative">
                {(() => {
                  const profileUser = selectedStudentProfile.user || selectedStudentProfile.userId || {};
                  return (
                    <>
                      <div className="w-20 h-20 bg-white border-4 border-white rounded-full flex items-center justify-center -mt-10 mb-4 shadow-sm relative z-10 mx-auto">
                        <div className="w-full h-full bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold">
                          {profileUser.name?.charAt(0) || '?'}
                        </div>
                      </div>
                      
                      <div className="text-center space-y-1 mb-6">
                        <h2 className="text-xl font-bold text-slate-800">{profileUser.name}</h2>
                        <p className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block">
                          {profileUser.enrollmentNumber || 'N/A'}
                        </p>
                        <p className="text-sm text-slate-500">{profileUser.email}</p>
                      </div>
                    </>
                  );
                })()}
              
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Group Assignment</h3>
                
                <div className="flex justify-between items-center py-2 border-b border-slate-200/60 last:border-0">
                  <span className="text-sm font-medium text-slate-500">Project Role</span>
                  <span className="text-sm font-bold text-slate-800 uppercase px-2 py-1 bg-white rounded shadow-xs">{selectedStudentProfile.role}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-slate-200/60 last:border-0">
                  <span className="text-sm font-medium text-slate-500">Group Code</span>
                  <span className="text-sm font-bold text-slate-800">{group?.code || groupId}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-slate-200/60 last:border-0">
                  <span className="text-sm font-medium text-slate-500">Membership Status</span>
                  <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {selectedStudentProfile.status}
                  </span>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <button 
                  onClick={() => setSelectedStudentProfile(null)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyGroupWorkspace;
