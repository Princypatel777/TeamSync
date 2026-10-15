import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  Kanban,
  Plus,
  Clock,
  User,
  X,
  Search,
  Filter,
  Trash2,
  Edit2
} from 'lucide-react';

export const StudentKanbanPage = ({ facultyMode = false, specificProjectId = null, membersList = null }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, MY_TASKS, OVERDUE, COMPLETED

  // Task Form State
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [featureId, setFeatureId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [checklistItemId, setChecklistItemId] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch Data
  const { data: authData } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await API.get('/auth/me');
      return res.data;
    }
  });
  
  const { data: groupData } = useQuery({
    queryKey: ['myGroup'],
    queryFn: async () => {
      const res = await API.get('/groups/my-group');
      return res.data;
    },
  });

  const { data: sprintsData } = useQuery({
    queryKey: ['agileSprints', specificProjectId],
    queryFn: async () => {
      const url = specificProjectId ? `/agile/sprints?projectId=${specificProjectId}` : '/agile/sprints';
      const res = await API.get(url);
      return res.data;
    },
  });

  const { data: featuresData } = useQuery({
    queryKey: ['agileFeatures', specificProjectId],
    queryFn: async () => {
      const url = specificProjectId ? `/agile/features?projectId=${specificProjectId}` : '/agile/features';
      const res = await API.get(url);
      return res.data;
    },
  });

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['agileTasks', selectedSprintId, specificProjectId],
    queryFn: async () => {
      const params = {};
      if (selectedSprintId) params.sprintId = selectedSprintId;
      if (specificProjectId) params.projectId = specificProjectId;
      const res = await API.get('/agile/tasks', { params });
      return res.data;
    },
  });

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await API.post('/agile/tasks', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agileTasks'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => setFormError(err.response?.data?.message || 'Failed to create task.'),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await API.put(`/agile/tasks/${editingTaskId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agileTasks'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => setFormError(err.response?.data?.message || 'Failed to update task.'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }) => {
      const res = await API.put(`/agile/tasks/${taskId}/status`, { status });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agileTasks'] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id) => {
      const res = await API.delete(`/agile/tasks/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agileTasks'] }),
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete task.')
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setPriority('MEDIUM');
    setStartDate('');
    setStartTime('');
    setDueDate('');
    setDueTime('');
    setFeatureId('');
    setSprintId('');
    setChecklistItemId('');
    setFormError('');
    setEditingTaskId(null);
  };

  const handleSaveTask = (e) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) return setFormError('Task title is required.');
    
    const payload = {
      title: title.trim(),
      description: description ? description.trim() : '',
      assigneeId: assigneeId || null,
      priority,
      startDate: startDate || null,
      startTime: startTime || '',
      dueDate: dueDate || null,
      dueTime: dueTime || '',
      featureId: featureId || null,
      checklistItemId: checklistItemId || null,
    };
    if (specificProjectId) payload.projectId = specificProjectId;

    if (editingTaskId) {
      updateTaskMutation.mutate(payload);
    } else {
      createTaskMutation.mutate(payload);
    }
  };

  const handleEditTask = (task) => {
    setEditingTaskId(task._id);
    setTitle(task.title);
    setDescription(task.description || '');
    setAssigneeId(task.assigneeId?._id || '');
    setPriority(task.priority);
    setStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
    setStartTime(task.startTime || '');
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setDueTime(task.dueTime || '');
    setFeatureId(task.featureId || '');
    setChecklistItemId(task.checklistItemId || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteTask = (id, taskTitle) => {
    if (window.confirm(`Are you sure you want to delete:\n\n"${taskTitle}"?`)) {
      deleteTaskMutation.mutate(id);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      updateStatusMutation.mutate({ taskId, status });
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  if (isLoading) return <LoadingSpinner text="Loading Tasks & Kanban..." />;

  const tasks = (tasksData?.tasks || []).filter(t => !t.isCalendarEventOnly);
  const rawMembers = membersList || groupData?.members || groupData?.group?.members || [];
  const members = rawMembers.map(m => {
    const u = m.user || m.userId || m;
    return {
      _id: u._id || m._id,
      name: u.name || m.name || 'Member',
      enrollmentNumber: u.enrollmentNumber || m.enrollmentNumber || '',
      role: m.role || 'MEMBER'
    };
  }).filter(m => m._id);
  const sprints = sprintsData?.sprints || [];
  const features = featuresData?.features || [];
  const myUserId = authData?.user?._id;

  const selectedFeatureObj = features.find(f => f._id === featureId);
  const checklistOptions = selectedFeatureObj?.checklistItems || [];

  // Filter Tasks
  const filteredTasks = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.taskKey.toLowerCase().includes(search.toLowerCase())) return false;
    
    if (!facultyMode && filterType === 'MY_TASKS' && t.assigneeId?._id !== myUserId) return false;
    if (facultyMode && filterType === 'MY_TASKS') return false; // Faculty has no 'My Tasks' in student group
    if (filterType === 'COMPLETED' && t.status !== 'DONE') return false;
    if (filterType === 'OVERDUE' && t.status !== 'DONE') {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      if (t.dueTime) {
        const [h, m] = t.dueTime.split(':');
        due.setHours(parseInt(h), parseInt(m));
      }
      if (due >= new Date()) return false;
    }
    return true;
  });

  const columns = [
    { id: 'TO_DO', title: 'To Do', color: 'border-slate-300 bg-slate-50 text-slate-700' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-300 bg-blue-50 text-blue-800' },
    { id: 'IN_REVIEW', title: 'In Review', color: 'border-amber-300 bg-amber-50 text-amber-800' },
    { id: 'DONE', title: 'Done', color: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Kanban className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Work Management</h1>
              <p className="text-sm text-slate-500 mt-1">Manage tasks, sprints, and track project execution.</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sprint:</span>
            <select
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sprints</option>
              {sprints.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            {['ALL', facultyMode ? null : 'MY_TASKS', 'OVERDUE', 'COMPLETED'].filter(Boolean).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  filterType === f ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div 
              key={col.id} 
              className="bg-slate-100/70 p-4 rounded-xl border border-slate-200 flex flex-col min-h-[500px]"
              onDrop={(e) => handleDrop(e, col.id)}
              onDragOver={handleDragOver}
            >
              <div className={`p-3 rounded-lg border font-bold text-xs uppercase tracking-wider mb-4 flex justify-between items-center ${col.color}`}>
                <span>{col.title}</span>
                <span className="px-2 py-0.5 bg-white/80 rounded-full font-mono text-[11px]">{colTasks.length}</span>
              </div>

              <div className="space-y-3 flex-1">
                {colTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">Drop tasks here</p>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task._id)}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-blue-400 cursor-grab active:cursor-grabbing transition-all relative group"
                    >
                      <div className="absolute top-3 right-3 hidden group-hover:flex items-center space-x-1 bg-white/90 backdrop-blur-sm p-1 rounded-lg border border-slate-100 shadow-xs">
                        <button onClick={() => handleEditTask(task)} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteTask(task._id, task.title)} className="p-1 text-slate-400 hover:text-rose-600 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pr-10">
                        <span className="font-mono text-[10px] font-bold text-slate-500">{task.taskKey}</span>
                        {task.priority && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            task.priority === 'HIGH' || task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                            task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {task.priority}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 leading-tight">{task.title}</h4>
                      {task.featureId && (
                        <div className="flex items-center text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-1.5 py-0.5 rounded w-max border border-amber-100">
                          ✨ {features.find(f => f._id === task.featureId)?.title || 'Feature'}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        <div className="flex items-center text-xs text-slate-500">
                          <User className="w-3 h-3 mr-1.5" />
                          <span className="truncate">{task.assigneeId ? task.assigneeId.name : 'Unassigned'}</span>
                        </div>
                        
                        {(task.startDate || task.dueDate) && (
                          <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                            {task.startDate && (
                              <div className="flex items-center space-x-1">
                                <span>Start:</span>
                                <span className="font-mono text-slate-700">{new Date(task.startDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}</span>
                                {task.startTime && <span>{task.startTime}</span>}
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center space-x-1">
                                <span>Due:</span>
                                <span className={`font-mono ${col.id !== 'DONE' && new Date(task.dueDate) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                                  {new Date(task.dueDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}
                                </span>
                                {task.dueTime && <span>{task.dueTime}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800">{editingTaskId ? 'Edit Task' : 'Create Task'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {formError && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{formError}</div>}
              
              <form id="task-form" onSubmit={handleSaveTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Design Login Page"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description</label>
                  <textarea
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Task details..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Assign To 👤</label>
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Unassigned</option>
                      {members.map(m => (
                        <option key={m._id} value={m._id}>
                          {m.name} {m.enrollmentNumber ? `(${m.enrollmentNumber})` : ''} {String(m._id) === String(myUserId) ? '— (You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Feature ✨</label>
                    <select
                      value={featureId}
                      onChange={(e) => setFeatureId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No Feature</option>
                      {features.map(f => (
                        <option key={f._id} value={f._id}>{f.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Start Time</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Due Date</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Due Time</label>
                    <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Checklist Item ☑️</label>
                    <select
                      value={checklistItemId}
                      onChange={(e) => setChecklistItemId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      disabled={!featureId}
                    >
                      <option value="">No Checklist Item</option>
                      {checklistOptions.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 shrink-0 flex items-center justify-between bg-slate-50 rounded-b-2xl">
              <div>
                {editingTaskId && (
                  <button
                    type="button"
                    onClick={() => {
                      if(window.confirm('Are you sure you want to delete this task?')) {
                        deleteTaskMutation.mutate(editingTaskId);
                      }
                    }}
                    disabled={deleteTaskMutation.isPending}
                    className="px-4 py-2 text-rose-600 hover:bg-rose-100 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  form="task-form"
                  disabled={createTaskMutation.isPending || updateTaskMutation.isPending} 
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all"
                >
                  {(createTaskMutation.isPending || updateTaskMutation.isPending) ? 'Saving...' : editingTaskId ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentKanbanPage;
