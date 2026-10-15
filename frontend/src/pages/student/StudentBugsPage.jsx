import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Bug as BugIcon, Plus, X, Edit2, Calendar, Paperclip, User } from 'lucide-react';

export const StudentBugsPage = ({ facultyMode = false, specificProjectId = null, membersList = null }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [formError, setFormError] = useState('');

  // Form State
  const [editingBugId, setEditingBugId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [featureId, setFeatureId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [status, setStatus] = useState('OPEN');
  const [dueDate, setDueDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Fetch Bugs
  const { data: bugsData, isLoading } = useQuery({
    queryKey: ['agileBugs', specificProjectId],
    queryFn: async () => {
      const url = specificProjectId ? `/agile/bugs?projectId=${specificProjectId}` : '/agile/bugs';
      const res = await API.get(url);
      return res.data;
    },
  });

  // Fetch Auth Data
  const { data: authData } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await API.get('/auth/me');
      return res.data;
    }
  });

  // Fetch Features (for dropdown)
  const { data: featuresData } = useQuery({
    queryKey: ['agileFeatures', specificProjectId],
    queryFn: async () => {
      const url = specificProjectId ? `/agile/features?projectId=${specificProjectId}` : '/agile/features';
      const res = await API.get(url);
      return res.data;
    },
  });

  // Fetch Group (for assignee dropdown)
  const { data: groupData } = useQuery({
    queryKey: ['myGroup'],
    queryFn: async () => {
      const res = await API.get('/groups/my-group');
      return res.data;
    },
  });

  // Create Bug Mutation
  const createBugMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await API.post('/agile/bugs', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agileBugs'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to report bug.');
    }
  });

  // Update Bug Mutation
  const updateBugMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await API.put(`/agile/bugs/${editingBugId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agileBugs'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to update bug.');
    }
  });

  // Delete Bug Mutation
  const deleteBugMutation = useMutation({
    mutationFn: async (id) => {
      const res = await API.delete(`/agile/bugs/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agileBugs'] });
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Failed to delete bug');
    }
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFeatureId('');
    setAssigneeId('');
    setPriority('MEDIUM');
    setStatus('OPEN');
    setDueDate('');
    setAttachmentUrl('');
    setFormError('');
    setEditingBugId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) {
      setFormError('Bug title is required.');
      return;
    }
    const payload = {
      title: title.trim(),
      description: description ? description.trim() : '',
      featureId: featureId || null,
      assigneeId: assigneeId || null,
      priority,
      status,
      dueDate: dueDate || null,
      attachmentUrl: attachmentUrl || '',
    };
    if (specificProjectId) payload.projectId = specificProjectId;

    if (editingBugId) {
      updateBugMutation.mutate(payload);
    } else {
      createBugMutation.mutate(payload);
    }
  };

  const handleEdit = (bug) => {
    setEditingBugId(bug._id);
    setTitle(bug.title);
    setDescription(bug.description || '');
    setFeatureId(bug.featureId?._id || '');
    setAssigneeId(bug.assigneeId?._id || '');
    setPriority(bug.priority || 'MEDIUM');
    setStatus(bug.status || 'OPEN');
    setDueDate(bug.dueDate ? new Date(bug.dueDate).toISOString().split('T')[0] : '');
    setAttachmentUrl(bug.attachmentUrl || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDelete = (id, bugTitle) => {
    if (window.confirm(`Are you sure you want to delete the bug: "${bugTitle}"?\nThis action cannot be undone.`)) {
      deleteBugMutation.mutate(id);
    }
  };

  if (isLoading) return <LoadingSpinner text="Loading Bugs..." />;

  const bugs = bugsData?.bugs || [];
  const features = featuresData?.features || [];
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

  const myUserId = authData?.user?._id;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredBugs = bugs.filter(b => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN' && b.status !== 'OPEN') return false;
    if (filter === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return false;
    if (filter === 'FIXED' && b.status !== 'FIXED') return false;
    if (filter === 'CLOSED' && b.status !== 'CLOSED') return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <BugIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Project Bugs</h1>
            <p className="text-sm text-slate-500 mt-1">
              Report and track problems, errors, or issues during project development.
            </p>
          </div>
        </div>

        {!facultyMode && (
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Report Bug</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'OPEN', 'IN_PROGRESS', 'FIXED', 'CLOSED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border ${
              filter === f 
                ? 'bg-slate-800 text-white border-slate-800' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'ALL' ? 'All Bugs' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Bugs List */}
      {filteredBugs.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
          <BugIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No Bugs Found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            Everything seems to be working perfectly. If you find an issue, report a bug.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBugs.map(bug => (
            <div key={bug._id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
              <div className="w-2 bg-rose-500 shrink-0 hidden md:block"></div>
              
              <div className="flex-1 p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-rose-500"><BugIcon className="w-5 h-5" /></span>
                    <h3 className="text-lg font-bold text-slate-800">{bug.title}</h3>
                  </div>
                  {!facultyMode && (
                    <div className="flex space-x-2">
                      <button onClick={() => handleEdit(bug)} className="px-3 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 text-xs font-bold rounded transition-colors">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(bug._id, bug.title)} disabled={deleteBugMutation.isPending} className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded transition-colors">
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-600 mb-4">{bug.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase">Feature</span>
                    <span className="text-sm font-medium text-slate-700">{bug.featureId?.title || 'None'}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase">Assigned To</span>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">{bug.assigneeId?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase">Priority</span>
                    <span className={`text-sm font-bold ${bug.priority === 'CRITICAL' ? 'text-rose-600' : bug.priority === 'HIGH' ? 'text-orange-500' : 'text-slate-700'}`}>
                      {bug.priority}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">Status</span>
                    <StatusBadge status={bug.status} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3 mt-2">
                  <span>Reported by {bug.reporterId?.name} on {new Date(bug.createdAt).toLocaleDateString()}</span>
                  {bug.attachmentUrl && (
                    <a href={bug.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-blue-600 hover:underline">
                      <Paperclip className="w-3.5 h-3.5" /> <span>View Attachment</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bug Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto py-10">
          <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl border border-slate-200 my-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BugIcon className="w-5 h-5 text-rose-500" /> 
                {editingBugId ? 'Edit Bug' : 'Report Bug'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[70vh]">
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm font-semibold">
                  {formError}
                </div>
              )}
              <form id="bug-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Bug Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Login button not working"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description</label>
                  <textarea
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue, steps to reproduce, etc."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Related Feature</label>
                    <select
                      value={featureId}
                      onChange={(e) => setFeatureId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">None</option>
                      {features.map(f => <option key={f._id} value={f._id}>{f.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Assign To</label>
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">Unassigned</option>
                      {members.map(m => (
                        <option key={m._id} value={m._id}>
                          {m.name} {m.enrollmentNumber ? `(${m.enrollmentNumber})` : ''} {String(m._id) === String(myUserId) ? '— (You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="FIXED">Fixed</option>
                      <option value="REOPENED">Reopened</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Screenshot / Attachment</label>
                    {attachmentUrl ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-200 truncate max-w-[150px]">File Attached</span>
                        <button type="button" onClick={() => setAttachmentUrl('')} className="text-rose-500 text-xs font-bold hover:underline">Remove</button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                      />
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 shrink-0 flex items-center justify-end space-x-3 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button 
                type="submit" 
                form="bug-form"
                disabled={createBugMutation.isPending || updateBugMutation.isPending} 
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {createBugMutation.isPending || updateBugMutation.isPending ? 'Submitting...' : editingBugId ? 'Save Changes' : 'Report Bug'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentBugsPage;
