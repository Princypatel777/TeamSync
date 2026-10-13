import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import API from '../../services/api';
import {
  LayoutDashboard,
  User,
  Users,
  FolderGit2,
  FileText,
  CheckSquare,
  Kanban,
  Bug,
  Flag,
  FileCode,
  MessageSquare,
  Github,
  Calendar,
  Award,
  Building,
  GraduationCap,
  Settings,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

const MENU_ITEMS_BY_ROLE = {
  STUDENT: [
    { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Profile', path: '/student/profile', icon: User },
    { label: 'My Group', path: '/student/group', icon: Users },
    { label: 'Project & Proposal', path: '/student/proposal', icon: FileText },
    { label: 'Requirements', path: '/student/requirements', icon: ClipboardList },
    { label: 'Features', path: '/student/features', icon: Layers },
    { label: 'Work Management', path: '/student/kanban', icon: Kanban },
    { label: 'Bugs', path: '/student/bugs', icon: Bug },
    { label: 'Milestones', path: '/student/milestones', icon: Flag },
    { label: 'Files', path: '/student/files', icon: FileCode },
    { label: 'Wiki', path: '/student/wiki', icon: FileText },
    { label: 'Chat', path: '/student/chat', icon: MessageSquare },
    { label: 'GitHub', path: '/student/github', icon: Github },
    { label: 'Releases', path: '/student/releases', icon: Layers },
    { label: 'Calendar', path: '/student/calendar', icon: Calendar },
    { label: 'Reviews & Marks', path: '/student/reviews', icon: Award },
  ],
  FACULTY: [
    { label: 'Dashboard', path: '/faculty/dashboard', icon: LayoutDashboard },
    { label: 'Assigned Groups', path: '/faculty/projects', icon: Users },
    { label: 'Proposals to Review', path: '/faculty/proposals', icon: FileText },
    { label: 'Reviews & Feedback', path: '/faculty/reviews', icon: MessageSquare },
    { label: 'Marks & Evaluation', path: '/faculty/marks', icon: Award },
    { label: 'Project Analytics', path: '/faculty/analytics', icon: Layers },
    { label: 'Calendar', path: '/faculty/calendar', icon: Calendar },
    { label: 'Profile', path: '/faculty/profile', icon: User },
  ],
  COORDINATOR: [
    { label: 'Dashboard', path: '/coordinator/dashboard', icon: LayoutDashboard },
    { label: 'Students', path: '/coordinator/students', icon: GraduationCap },
    { label: 'Groups', path: '/coordinator/groups', icon: Users },
    { label: 'Projects', path: '/coordinator/projects', icon: FolderGit2 },
    { label: 'Faculty Assignment', path: '/coordinator/faculty-assign', icon: Users },
    { label: 'Reviews Overview', path: '/coordinator/reviews', icon: Award },
    { label: 'Marks & Evaluation', path: '/coordinator/marks', icon: Award },
    { label: 'Department Analytics', path: '/coordinator/analytics', icon: Layers },
    { label: 'Calendar', path: '/coordinator/calendar', icon: Calendar },
    { label: 'Profile', path: '/coordinator/profile', icon: User },
  ],
  ADMIN: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Students', path: '/admin/students', icon: GraduationCap },
    { label: 'Faculty', path: '/admin/faculty', icon: Users },
    { label: 'Coordinators', path: '/admin/coordinators', icon: Users },
    { label: 'Departments', path: '/admin/departments', icon: Building },
    { label: 'Academic Years', path: '/admin/academic-years', icon: Calendar },
    { label: 'SGP Cycles', path: '/admin/sgp-cycles', icon: Layers },
    { label: 'Groups', path: '/admin/groups', icon: Users },
    { label: 'Projects', path: '/admin/projects', icon: FolderGit2 },
    { label: 'Faculty Assignment', path: '/admin/faculty-assign', icon: Users },
    { label: 'Reviews', path: '/admin/reviews', icon: Award },
    { label: 'Marks & Evaluation', path: '/admin/marks', icon: Award },
    { label: 'Analytics', path: '/admin/analytics', icon: LayoutDashboard },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldCheck },
    { label: 'System & AI Settings', path: '/admin/settings', icon: Settings },
  ],
};

export const Sidebar = ({ role }) => {
  const menuItems = MENU_ITEMS_BY_ROLE[role] || MENU_ITEMS_BY_ROLE.STUDENT;

  const { data: unreadData } = useQuery({
    queryKey: ['chatUnreadCounts'],
    queryFn: async () => {
      const res = await API.get('/collaboration/chat/unread');
      return res.data;
    },
    refetchInterval: 5000,
    enabled: role === 'STUDENT' || role === 'FACULTY' || role === 'COORDINATOR'
  });

  const totalUnread = unreadData?.total || 0;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 border-r border-slate-800 select-none overflow-y-auto">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg font-bold text-lg">
            TS
          </div>
          <div>
            <h1 className="font-bold text-white tracking-wide text-lg">TeamSync</h1>
            <p className="text-[10px] text-slate-400 font-mono leading-none">SGP Management</p>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <IconComponent className="w-4 h-4 mr-3 shrink-0" />
              <span className="truncate flex-1">{item.label}</span>
              {item.label === 'Chat' && totalUnread > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm ml-2">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 font-mono text-center">
        v1.0.0 • Institutional Build
      </div>
    </aside>
  );
};

export default Sidebar;
