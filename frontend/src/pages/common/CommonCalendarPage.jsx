import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Flag,
  Award,
  Package,
  User,
  Search,
  Filter,
  X,
  Plus,
  List,
  LayoutGrid,
  ExternalLink,
  CheckSquare,
  Square,
  Flame,
  Check,
  Folder,
  Tag,
  AlertTriangle,
  CalendarDays
} from 'lucide-react';

const EVENT_COLORS = {
  TASK: 'bg-blue-100 text-blue-700 border-blue-200',
  FEATURE: 'bg-teal-100 text-teal-700 border-teal-200',
  BUG: 'bg-rose-100 text-rose-700 border-rose-200',
  MILESTONE: 'bg-amber-100 text-amber-700 border-amber-200',
  SPRINT: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  REVIEW: 'bg-purple-100 text-purple-700 border-purple-200',
  RELEASE: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const EVENT_ICONS = {
  TASK: <CheckSquare className="w-3.5 h-3.5 mr-1" />,
  FEATURE: <Flag className="w-3.5 h-3.5 mr-1" />,
  BUG: <AlertCircle className="w-3.5 h-3.5 mr-1" />,
  MILESTONE: <Flame className="w-3.5 h-3.5 mr-1" />,
  SPRINT: <Clock className="w-3.5 h-3.5 mr-1" />,
  REVIEW: <Award className="w-3.5 h-3.5 mr-1" />,
  RELEASE: <Package className="w-3.5 h-3.5 mr-1" />
};

// Safe date normalization avoiding timezone shifts
const parseLocalDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate());
  }
  if (typeof dateVal === 'string') {
    const parts = dateVal.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
  }
  const dt = new Date(dateVal);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const formatDateNice = (dateVal) => {
  if (!dateVal) return 'No Date';
  const dt = new Date(dateVal);
  if (isNaN(dt.getTime())) return String(dateVal);
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const CommonCalendarPage = ({ facultyMode = false, coordinatorMode = false, specificProjectId = null }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Navigation & View State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('MONTH'); // 'MONTH' | 'AGENDA'
  const [selectedProjectId, setSelectedProjectId] = useState(specificProjectId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'COMPLETED' | 'OVERDUE'
  
  const [activeFilters, setActiveFilters] = useState({
    TASK: true,
    FEATURE: true,
    BUG: true,
    MILESTONE: true,
    SPRINT: true,
    REVIEW: true,
    RELEASE: true
  });

  // Modal States
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState(null); // { dateStr, dateObj, events }
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    startDate: '',
    dueDate: '',
    dueTime: '',
    priority: 'MEDIUM',
    showInKanban: true,
    projectId: ''
  });

  // Fetch Calendar Events
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events', selectedProjectId || specificProjectId],
    queryFn: async () => {
      const pId = selectedProjectId || specificProjectId;
      const url = pId ? `/calendar/events?projectId=${pId}` : '/calendar/events';
      const res = await API.get(url);
      return res.data;
    }
  });

  const events = data?.events || [];
  const projects = data?.projects || [];

  // Mutations for Quick Add / Edit / Delete Task
  const createTaskMutation = useMutation({
    mutationFn: async (taskData) => {
      const payload = { 
        ...taskData, 
        isCalendarEventOnly: !taskData.showInKanban,
        projectId: taskData.projectId || selectedProjectId || (projects[0]?._id)
      };
      const res = await API.post('/agile/tasks', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      setIsTaskModalOpen(false);
      resetTaskForm();
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to create task');
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, taskData }) => {
      const payload = { ...taskData, isCalendarEventOnly: !taskData.showInKanban };
      const res = await API.put(`/agile/tasks/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      setIsTaskModalOpen(false);
      setEditingEventId(null);
      setSelectedEvent(null);
      resetTaskForm();
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to update task');
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id) => {
      const res = await API.delete(`/agile/tasks/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      setIsTaskModalOpen(false);
      setEditingEventId(null);
      setSelectedEvent(null);
    }
  });

  const resetTaskForm = () => {
    setNewTask({
      title: '',
      description: '',
      startDate: '',
      dueDate: '',
      dueTime: '',
      priority: 'MEDIUM',
      showInKanban: true,
      projectId: selectedProjectId || (projects[0]?._id || '')
    });
  };

  const handleCreateTaskSubmit = (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    if (editingEventId) {
      updateTaskMutation.mutate({ id: editingEventId, taskData: newTask });
    } else {
      createTaskMutation.mutate(newTask);
    }
  };

  // Helper: Determine Event Status & Badges
  const getEventStatusInfo = (ev) => {
    const isDone = !!ev.isDone;
    const deadline = ev.dueDate || ev.end;
    const isOverdue = !isDone && deadline && new Date(deadline).setHours(23, 59, 59, 999) < Date.now();
    const isCompletedLate = isDone && deadline && ev.details?.updatedAt && 
      new Date(deadline).setHours(23, 59, 59, 999) < new Date(ev.details.updatedAt).getTime();

    if (isCompletedLate) {
      return {
        label: 'Completed Late',
        badgeClass: 'bg-pink-100 text-pink-800 border-pink-300',
        chipClass: 'bg-pink-50 text-pink-800 border-pink-300 line-through opacity-85',
        icon: <CheckCircle2 className="w-3 h-3 text-pink-600 inline mr-1" />
      };
    }
    if (isDone) {
      return {
        label: 'Completed',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        chipClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 opacity-90',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 inline mr-1" />
      };
    }
    if (isOverdue) {
      return {
        label: 'Overdue Deadline',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse',
        chipClass: 'bg-rose-100 text-rose-900 border-rose-400 font-bold shadow-xs',
        icon: <AlertCircle className="w-3 h-3 text-rose-600 inline mr-1" />
      };
    }
    return {
      label: ev.status ? ev.status.replace(/_/g, ' ') : 'In Progress',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      chipClass: EVENT_COLORS[ev.type] || 'bg-slate-100 text-slate-800 border-slate-200',
      icon: EVENT_ICONS[ev.type] || <Clock className="w-3 h-3 inline mr-1" />
    };
  };

  // KPI Calculations
  const totalEvents = events.length;
  const completedEvents = events.filter(ev => ev.isDone).length;
  const overdueEvents = events.filter(ev => {
    if (ev.isDone) return false;
    const deadline = ev.dueDate || ev.end;
    return deadline && new Date(deadline).setHours(23, 59, 59, 999) < Date.now();
  }).length;
  const pendingEvents = totalEvents - completedEvents - overdueEvents;
  const completionPercentage = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

  // Filter Events
  const filteredEvents = events.filter(ev => {
    // Type Filter
    if (!activeFilters[ev.type]) return false;

    // Status Filter
    const isDone = !!ev.isDone;
    const deadline = ev.dueDate || ev.end;
    const isOverdue = !isDone && deadline && new Date(deadline).setHours(23, 59, 59, 999) < Date.now();

    if (statusFilter === 'COMPLETED' && !isDone) return false;
    if (statusFilter === 'PENDING' && (isDone || isOverdue)) return false;
    if (statusFilter === 'OVERDUE' && (!isOverdue || isDone)) return false;

    // Search Query
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = ev.title?.toLowerCase().includes(term);
      const matchResp = ev.responsible?.toLowerCase().includes(term);
      const matchType = ev.type?.toLowerCase().includes(term);
      const matchDesc = ev.details?.description?.toLowerCase().includes(term);
      return matchTitle || matchResp || matchType || matchDesc;
    }
    return true;
  });

  // Calendar Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const isToday = (d) => {
    const t = new Date();
    return d === t.getDate() && month === t.getMonth() && year === t.getFullYear();
  };

  // Get Events for a day cell
  const getEventsForDay = (d) => {
    const cellDate = new Date(year, month, d);
    cellDate.setHours(0, 0, 0, 0);

    return filteredEvents.filter(ev => {
      const start = parseLocalDate(ev.start);
      const end = parseLocalDate(ev.end || ev.start);
      if (!start) return false;
      return cellDate >= start && cellDate <= (end || start);
    });
  };

  // Open Details Modal on Event Click
  const handleEventClick = (ev, e) => {
    if (e) e.stopPropagation();
    setSelectedEvent(ev);
  };

  // Navigate to management page
  const handleNavigateToModule = (ev) => {
    if (coordinatorMode) {
      navigate('/coordinator/reviews');
      return;
    }
    if (ev.type === 'TASK') navigate('/student/kanban');
    else if (ev.type === 'FEATURE') navigate('/student/features');
    else if (ev.type === 'BUG') navigate('/student/bugs');
    else if (ev.type === 'MILESTONE') navigate('/student/milestones');
    else if (ev.type === 'SPRINT') navigate('/student/kanban');
    else if (ev.type === 'REVIEW') navigate('/student/marks');
    else if (ev.type === 'RELEASE') navigate('/student/releases');
  };

  // Prepare Agenda Timeline Events
  const sortedAgendaEvents = [...filteredEvents].sort((a, b) => {
    const dateA = new Date(a.dueDate || a.end || a.start).getTime();
    const dateB = new Date(b.dueDate || b.end || b.start).getTime();
    return dateA - dateB;
  });

  const groupedAgendaEvents = {};
  sortedAgendaEvents.forEach(ev => {
    const dVal = ev.dueDate || ev.end || ev.start;
    const dateKey = dVal ? new Date(dVal).toISOString().split('T')[0] : 'undated';
    if (!groupedAgendaEvents[dateKey]) groupedAgendaEvents[dateKey] = [];
    groupedAgendaEvents[dateKey].push(ev);
  });

  if (isLoading) return <LoadingSpinner text="Synchronizing Project Deadlines & Calendar..." />;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP STATS / KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Total Items</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalEvents}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tasks, Milestones & Reviews</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-600 tracking-wider">Completed Work</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {completedEvents} <span className="text-xs font-semibold text-emerald-600">({completionPercentage}%)</span>
            </p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Marked done on time</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-amber-600 tracking-wider">Upcoming Deadlines</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{pendingEvents}</p>
            <p className="text-[11px] text-amber-600 mt-0.5">Active & In Progress</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-xs flex items-center justify-between ${
          overdueEvents > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${
              overdueEvents > 0 ? 'text-rose-700 font-bold' : 'text-slate-500'
            }`}>Overdue Items</p>
            <p className={`text-2xl font-bold mt-1 ${
              overdueEvents > 0 ? 'text-rose-700' : 'text-slate-700'
            }`}>{overdueEvents}</p>
            <p className={`text-[11px] mt-0.5 ${
              overdueEvents > 0 ? 'text-rose-600' : 'text-slate-500'
            }`}>{overdueEvents > 0 ? 'Requires immediate action' : 'All deadlines on track'}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
            overdueEvents > 0 ? 'bg-rose-100 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. CONTROLS BAR: Navigation, Views, Project Selector, Search */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-4 justify-between items-center">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <button 
            onClick={prevMonth} 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-800 w-44 text-center">
            {monthNames[month]} {year}
          </h2>
          <button 
            onClick={nextMonth} 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button 
            onClick={today} 
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
          >
            Today
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 ml-2">
            <button
              onClick={() => setViewMode('MONTH')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'MONTH' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Month
            </button>
            <button
              onClick={() => setViewMode('AGENDA')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'AGENDA' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Agenda List
            </button>
          </div>
        </div>

        {/* Right Controls: Project Filter, Search, Quick Add */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Multi-Project Selector (if multiple projects exist) */}
          {projects.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-slate-400" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All My Projects ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    [{p.projectKey || 'PROJ'}] {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search deadline, task, bug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Button */}
          {coordinatorMode ? (
            <button 
              onClick={() => navigate('/coordinator/reviews')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Schedule Review
            </button>
          ) : !facultyMode && (
            <button 
              onClick={() => {
                setEditingEventId(null);
                resetTaskForm();
                setIsTaskModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Quick Add Task
            </button>
          )}
        </div>
      </div>

      {/* 3. STATUS & TYPE FILTERS BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {[
            { id: 'ALL', label: `All (${totalEvents})` },
            { id: 'PENDING', label: `Upcoming (${pendingEvents})` },
            { id: 'COMPLETED', label: `Completed (${completedEvents})` },
            { id: 'OVERDUE', label: `Overdue (${overdueEvents})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                statusFilter === tab.id 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type Category Filters */}
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(activeFilters).map(type => (
            <button 
              key={type}
              onClick={() => setActiveFilters(prev => ({ ...prev, [type]: !prev[type] }))}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center border ${
                activeFilters[type] 
                  ? EVENT_COLORS[type] || 'bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-white text-slate-400 border-slate-200 opacity-60'
              }`}
            >
              {EVENT_ICONS[type]} {type}
            </button>
          ))}
        </div>
      </div>

      {/* 4. CALENDAR VIEW BODY */}
      {viewMode === 'MONTH' ? (
        /* MONTH GRID */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {/* Days Header */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2.5 text-center text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200 last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Month Cells */}
          <div className="grid grid-cols-7 auto-rows-[minmax(125px,auto)]">
            {/* Empty cells before start of month */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="border-r border-b border-slate-100 bg-slate-50/40 p-2 min-h-[125px]"></div>
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const hasCompleted = dayEvents.some(ev => ev.isDone);
              const hasOverdue = dayEvents.some(ev => {
                if (ev.isDone) return false;
                const dl = ev.dueDate || ev.end;
                return dl && new Date(dl).setHours(23, 59, 59, 999) < Date.now();
              });

              return (
                <div 
                  key={day} 
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDayInfo({ 
                        dateStr: `${day} ${monthNames[month]} ${year}`, 
                        dateObj: new Date(year, month, day),
                        events: dayEvents 
                      });
                    }
                  }}
                  className="border-r border-b border-slate-100 p-2 hover:bg-slate-50/80 transition-colors group relative min-h-[125px] flex flex-col justify-between"
                >
                  <div>
                    {/* Day Header with Indicator Badges */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday(day) 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'text-slate-700 group-hover:text-indigo-600'
                      }`}>
                        {day}
                      </span>
                      
                      {/* Status indicator dots */}
                      <div className="flex items-center gap-1">
                        {hasOverdue && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Has Overdue Deadline" />
                        )}
                        {hasCompleted && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Has Completed Work" />
                        )}
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Day Events Chips */}
                    <div className="space-y-1 relative z-10">
                      {dayEvents.slice(0, 3).map(ev => {
                        const statusInfo = getEventStatusInfo(ev);
                        return (
                          <div 
                            key={ev.id} 
                            onClick={(e) => handleEventClick(ev, e)}
                            className={`px-2 py-1 rounded text-[11px] font-medium border truncate flex flex-col cursor-pointer hover:shadow-xs transition-shadow ${statusInfo.chipClass}`} 
                            title={`${ev.title} (${statusInfo.label})`}
                          >
                            <div className="flex items-center justify-between font-bold truncate">
                              <span className="truncate flex items-center">
                                {statusInfo.icon}
                                <span className="truncate">{ev.title}</span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] opacity-80 mt-0.5">
                              <span className="truncate">{ev.responsible}</span>
                              {ev.priority && (
                                <span className="font-semibold uppercase text-[8px] ml-1">{ev.priority}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* + More Events link */}
                  {dayEvents.length > 3 && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDayInfo({ 
                          dateStr: `${day} ${monthNames[month]} ${year}`, 
                          dateObj: new Date(year, month, day),
                          events: dayEvents 
                        });
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 pt-1 cursor-pointer"
                    >
                      + {dayEvents.length - 3} more items
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* AGENDA TIMELINE LIST VIEW */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {Object.keys(groupedAgendaEvents).length === 0 ? (
            <div className="text-center py-16 px-4">
              <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No deadlines or events found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No items match your active filters. Try resetting the status or type filters to see all project deadlines.
              </p>
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchTerm('');
                  setActiveFilters({
                    TASK: true, FEATURE: true, BUG: true, MILESTONE: true, SPRINT: true, REVIEW: true, RELEASE: true
                  });
                }}
                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold text-xs rounded-lg transition"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            Object.keys(groupedAgendaEvents).map(dateKey => {
              const dayItems = groupedAgendaEvents[dateKey];
              const dateObj = new Date(dateKey);
              const isPast = dateObj.setHours(23, 59, 59, 999) < Date.now();
              const isDayToday = new Date().toISOString().split('T')[0] === dateKey;

              return (
                <div key={dateKey} className="p-5">
                  {/* Date Group Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                      isDayToday 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : isPast 
                          ? 'bg-slate-200 text-slate-700' 
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {isDayToday ? 'Today' : formatDateNice(dateKey)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {dayItems.length} {dayItems.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* List of items for this date */}
                  <div className="space-y-2">
                    {dayItems.map(ev => {
                      const statusInfo = getEventStatusInfo(ev);
                      return (
                        <div
                          key={ev.id}
                          onClick={() => handleEventClick(ev)}
                          className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all hover:shadow-xs group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">{statusInfo.icon}</div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  EVENT_COLORS[ev.type] || 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {ev.type}
                                </span>
                                <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                  {ev.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                                <span className="flex items-center gap-1 font-medium">
                                  <User className="w-3 h-3 text-slate-400" /> {ev.responsible}
                                </span>
                                {ev.priority && (
                                  <span className="text-[11px] font-bold uppercase text-slate-600">
                                    Priority: {ev.priority}
                                  </span>
                                )}
                                {ev.progress !== undefined && (
                                  <span className="text-[11px] font-semibold text-amber-600">
                                    Progress: {ev.progress}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${statusInfo.badgeClass}`}>
                              {statusInfo.label}
                            </span>
                            <button className="text-slate-400 group-hover:text-indigo-600 p-1">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. RICH EVENT DETAILS MODAL (POPUP ON CLICKING ANY EVENT) */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" 
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh]" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center ${
                  EVENT_COLORS[selectedEvent.type] || 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {EVENT_ICONS[selectedEvent.type]} {selectedEvent.type}
                </span>
                {selectedEvent.details?.project && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-200 text-slate-700">
                    {selectedEvent.details.project.projectKey || selectedEvent.details.project.title}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setSelectedEvent(null)} 
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Title & Status */}
              <div>
                <h3 className="text-xl font-bold text-slate-900 leading-snug">
                  {selectedEvent.title}
                </h3>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {(() => {
                    const st = getEventStatusInfo(selectedEvent);
                    return (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center ${st.badgeClass}`}>
                        {st.icon} {st.label}
                      </span>
                    );
                  })()}
                  {selectedEvent.priority && (
                    <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md">
                      Priority: {selectedEvent.priority}
                    </span>
                  )}
                </div>
              </div>

              {/* Deadlines & Timeline Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Schedule & Deadline Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Target Deadline / Due Date</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatDateNice(selectedEvent.dueDate || selectedEvent.end)}
                    </span>
                    {(selectedEvent.dueTime || selectedEvent.details?.dueTime) && (
                      <span className="text-slate-500 text-xs block font-mono">
                        Time: {selectedEvent.dueTime || selectedEvent.details?.dueTime}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Start Date</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatDateNice(selectedEvent.startDate || selectedEvent.start)}
                    </span>
                    {(selectedEvent.startTime || selectedEvent.details?.startTime) && (
                      <span className="text-slate-500 text-xs block font-mono">
                        Time: {selectedEvent.startTime || selectedEvent.details?.startTime}
                      </span>
                    )}
                  </div>
                </div>

                {/* Overdue or Completed Indicator Note */}
                {selectedEvent.isDone ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Work Completed and Verified.</span>
                  </div>
                ) : (selectedEvent.dueDate || selectedEvent.end) && 
                  new Date(selectedEvent.dueDate || selectedEvent.end).setHours(23, 59, 59, 999) < Date.now() ? (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Deadline Passed! This item is currently overdue.</span>
                  </div>
                ) : null}
              </div>

              {/* Responsible / Assignee */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Responsible / Assigned</span>
                  <span className="text-xs font-bold text-slate-800">{selectedEvent.responsible}</span>
                </div>
              </div>

              {/* Description (if present) */}
              {selectedEvent.details?.description && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description</h4>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {selectedEvent.details.description}
                  </p>
                </div>
              )}

              {/* Milestone Specific: Progress & Requirements */}
              {selectedEvent.type === 'MILESTONE' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>Milestone Progress</span>
                    <span className="text-amber-600">{selectedEvent.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-amber-500 h-2 rounded-full transition-all" 
                      style={{ width: `${selectedEvent.progress || 0}%` }} 
                    />
                  </div>

                  {selectedEvent.details?.requirements?.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-bold text-slate-600 mb-1.5">Requirements Checklist:</h4>
                      <div className="space-y-1">
                        {selectedEvent.details.requirements.map((req, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                            {req.isCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className={req.isCompleted ? 'line-through text-slate-500' : ''}>{req.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Feature Specific: Checklist Items */}
              {selectedEvent.type === 'FEATURE' && selectedEvent.details?.checklistItems?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Checklist & Scope:</h4>
                  <div className="space-y-1.5">
                    {selectedEvent.details.checklistItems.map((chk, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        {chk.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className={chk.isCompleted ? 'line-through text-slate-500 font-medium' : 'font-medium'}>
                          {chk.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Specific: Max marks and reviewers */}
              {selectedEvent.type === 'REVIEW' && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-semibold text-purple-900">Maximum Marks:</span>
                    <span className="font-bold text-purple-900">{selectedEvent.details?.maxMarks || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-purple-900">Review Timing:</span>
                    <span className="font-bold text-purple-900">
                      {selectedEvent.details?.startTime || 'TBD'} - {selectedEvent.details?.endTime || ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Release Specific: Version & GitHub link */}
              {selectedEvent.type === 'RELEASE' && selectedEvent.details?.githubReleaseUrl && (
                <div>
                  <a
                    href={selectedEvent.details.githubReleaseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View on GitHub
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3 shrink-0">
              {/* If it's a calendar quick task, allow edit/delete */}
              {selectedEvent.type === 'TASK' && selectedEvent.details?.isCalendarEventOnly ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingEventId(selectedEvent.details._id);
                      setNewTask({
                        title: selectedEvent.details.title || '',
                        description: selectedEvent.details.description || '',
                        startDate: selectedEvent.details.startDate ? new Date(selectedEvent.details.startDate).toISOString().split('T')[0] : '',
                        dueDate: selectedEvent.details.dueDate ? new Date(selectedEvent.details.dueDate).toISOString().split('T')[0] : '',
                        dueTime: selectedEvent.details.dueTime || '',
                        priority: selectedEvent.details.priority || 'MEDIUM',
                        showInKanban: false,
                        projectId: selectedEvent.details.projectId?._id || selectedProjectId
                      });
                      setIsTaskModalOpen(true);
                      setSelectedEvent(null);
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
                  >
                    Edit Task
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this event?')) {
                        deleteTaskMutation.mutate(selectedEvent.details._id);
                      }
                    }}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleNavigateToModule(selectedEvent)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Go to {selectedEvent.type} Page
                </button>
              )}

              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. DAY EVENTS MODAL (CLICKING DAY WITH MULTIPLE EVENTS) */}
      {selectedDayInfo && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" 
          onClick={() => setSelectedDayInfo(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-600" /> 
                Events for {selectedDayInfo.dateStr}
              </h2>
              <button 
                onClick={() => setSelectedDayInfo(null)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5">
              {selectedDayInfo.events.map(ev => {
                const statusInfo = getEventStatusInfo(ev);
                return (
                  <div 
                    key={ev.id} 
                    onClick={() => {
                      setSelectedDayInfo(null);
                      setSelectedEvent(ev);
                    }}
                    className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer hover:shadow-xs transition-all ${statusInfo.chipClass}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center font-bold text-xs gap-1.5">
                        {statusInfo.icon} <span>{ev.title}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] opacity-80 mt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <User className="w-3 h-3"/> {ev.responsible}
                      </span>
                      <span className="font-semibold">{ev.type}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedDayInfo(null)}
                className="px-4 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. QUICK ADD TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                {editingEventId ? 'Edit Event' : 'Quick Add Task'}
              </h3>
              <button 
                onClick={() => setIsTaskModalOpen(false)} 
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTaskSubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* Project Selection if multiple projects exist */}
              {projects.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Project</label>
                  <select
                    value={newTask.projectId || selectedProjectId || projects[0]?._id}
                    onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        [{p.projectKey || 'PROJ'}] {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  placeholder="e.g., Complete SRS Document Section 3"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={newTask.startDate}
                    onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Deadline</label>
                  <input 
                    type="date" 
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Time (Optional)</label>
                  <input 
                    type="time" 
                    value={newTask.dueTime}
                    onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea 
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[75px]"
                  placeholder="Details, requirements, or links..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="showInKanban"
                  checked={newTask.showInKanban}
                  onChange={(e) => setNewTask({ ...newTask, showInKanban: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="showInKanban" className="text-xs font-medium text-slate-700">
                  Also show as a task on Kanban Board
                </label>
              </div>

              <div className="pt-3 flex justify-between gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createTaskMutation.isPending || updateTaskMutation.isPending || !newTask.title.trim()}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
                >
                  {(createTaskMutation.isPending || updateTaskMutation.isPending) ? 'Saving...' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommonCalendarPage;
