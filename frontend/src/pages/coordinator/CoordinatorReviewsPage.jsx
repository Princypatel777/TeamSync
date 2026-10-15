import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { 
  Award, 
  Plus, 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  CheckCircle2, 
  X,
  Lock,
  Unlock,
  Shield,
  Edit2,
  Trash2,
  Image,
  Paperclip,
  Download,
  Search,
  Eye,
  MessageSquare,
  Send
} from 'lucide-react';

export const CoordinatorReviewsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [marksReviewModal, setMarksReviewModal] = useState(null);
  const [marksSearchTerm, setMarksSearchTerm] = useState('');

  // Query marks for selected review
  const { data: marksDetailData, isLoading: isMarksDetailLoading } = useQuery({
    queryKey: ['reviewMarksDetail', marksReviewModal?._id || marksReviewModal?.id],
    queryFn: async () => {
      const revId = marksReviewModal?._id || marksReviewModal?.id;
      if (!revId) return null;
      const res = await API.get(`/reviews/${revId}/marks`);
      return res.data;
    },
    enabled: !!marksReviewModal,
  });

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    type: 'Proposal Review',
    department: 'Computer Engineering',
    reviewDate: '',
    startTime: '',
    endTime: '',
    maxMarks: 20,
    status: 'DRAFT',
    marksVisibility: 'HIDDEN',
    attachmentUrl: ''
  });

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['adminReviews'],
    queryFn: async () => {
      const res = await API.get('/reviews');
      return res.data;
    }
  });

  const publishReviewMutation = useMutation({
    mutationFn: async (id) => {
      const res = await API.post(`/reviews/${id}/publish`);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['adminReviews']);
      queryClient.invalidateQueries(['calendar-events']);
      alert(resData?.message || 'Review schedule published and sent to all students & faculty!');
    },
    onError: (err) => {
      alert(err.response?.data?.detail || err.response?.data?.message || 'Failed to publish review schedule.');
    }
  });

  const saveReviewMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingReview) {
        const id = editingReview._id || editingReview.id;
        const res = await API.put(`/reviews/${id}`, payload);
        return res.data;
      }
      const res = await API.post('/reviews', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminReviews']);
      queryClient.invalidateQueries(['calendar-events']);
      setIsModalOpen(false);
      setEditingReview(null);
      resetForm();
    },
    onError: (err) => {
      alert(err.response?.data?.detail || err.response?.data?.message || 'Failed to save review schedule.');
    }
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id) => {
      const res = await API.delete(`/reviews/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminReviews']);
      queryClient.invalidateQueries(['calendar-events']);
    },
    onError: (err) => {
      alert(err.response?.data?.detail || err.response?.data?.message || 'Failed to delete review schedule.');
    }
  });

  const resetForm = () => {
    setFormData({
      title: '', type: 'Proposal Review', department: 'Computer Engineering',
      reviewDate: '', startTime: '', endTime: '', maxMarks: 20, status: 'DRAFT', marksVisibility: 'HIDDEN', attachmentUrl: ''
    });
  };

  const openCreateModal = () => {
    setEditingReview(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (review) => {
    setEditingReview(review);
    setFormData({
      title: review.title || '',
      type: review.type || 'Proposal Review',
      department: review.department || 'Computer Engineering',
      reviewDate: review.reviewDate ? new Date(review.reviewDate).toISOString().split('T')[0] : '',
      startTime: review.startTime || '',
      endTime: review.endTime || '',
      maxMarks: review.maxMarks || 20,
      status: review.status || 'DRAFT',
      marksVisibility: review.marksVisibility || 'HIDDEN',
      attachmentUrl: review.attachmentUrl || ''
    });
    setIsModalOpen(true);
  };

  if (isLoading) return <LoadingSpinner text="Loading Reviews Overview..." />;
  const reviews = reviewsData?.reviews || [];

  // Derived Stats
  const totalReviews = reviews.length;
  const completedReviews = reviews.filter(r => r.status === 'COMPLETED').length;
  const upcomingReviews = reviews.filter(r => r.status === 'PUBLISHED').length;
  const draftReviews = reviews.filter(r => r.status === 'DRAFT').length;

  const handleSubmit = (e) => {
    e.preventDefault();
    saveReviewMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Award className="w-7 h-7 text-indigo-600" />
            Reviews Overview
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage project review schedules, faculty evaluations and student feedback.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Review
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600"><FileText className="w-5 h-5"/></div>
          <div><p className="text-xs font-bold text-slate-500 uppercase">Total</p><p className="text-xl font-black text-slate-800">{totalReviews}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle2 className="w-5 h-5"/></div>
          <div><p className="text-xs font-bold text-slate-500 uppercase">Completed</p><p className="text-xl font-black text-slate-800">{completedReviews}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600"><Clock className="w-5 h-5"/></div>
          <div><p className="text-xs font-bold text-slate-500 uppercase">Upcoming</p><p className="text-xl font-black text-slate-800">{upcomingReviews}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600"><Lock className="w-5 h-5"/></div>
          <div><p className="text-xs font-bold text-slate-500 uppercase">Drafts</p><p className="text-xl font-black text-slate-800">{draftReviews}</p></div>
        </div>
      </div>

      {/* REVIEW SCHEDULE */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4 uppercase tracking-wider">Review Schedule</h2>
        
        {reviews.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
            <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700">No Reviews Scheduled</h3>
            <p className="text-slate-500 text-sm mt-1">Click Create Review to schedule the first academic review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review._id} className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row justify-between gap-4 shadow-sm hover:shadow-md transition">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      {review.title}
                    </h3>
                    <StatusBadge status={review.status} />
                    {review.marksVisibility === 'VISIBLE' ? (
                       <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase"><Unlock className="w-3 h-3"/> Marks Visible</span>
                    ) : (
                       <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase"><Lock className="w-3 h-3"/> Marks Hidden</span>
                    )}
                    {review.attachmentUrl && (
                      <a href={review.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded border border-blue-200 hover:underline">
                        <Paperclip className="w-3 h-3 mr-1" /> Attached Photo/Doc
                      </a>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> {new Date(review.reviewDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> {review.startTime || '10:00 AM'} - {review.endTime || '04:00 PM'}</div>
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /> Groups: {review.assignedGroups?.length || 0}</div>
                    <div className="flex items-center gap-2 font-medium"><Shield className="w-4 h-4 text-slate-400" /> Max Marks: {review.maxMarks}</div>
                  </div>

                  {review.attachmentUrl && (
                    <div className="mt-2 max-w-xs">
                      <img src={review.attachmentUrl} alt="Review Notice" className="h-20 object-cover rounded-lg border border-slate-200 shadow-xs" onError={(e) => e.target.style.display='none'} />
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-end gap-2 shrink-0">
                  {review.status === 'DRAFT' && (
                    <button 
                      onClick={() => {
                        if (confirm(`Send and publish review schedule "${review.title}" to all students and faculty?`)) {
                          publishReviewMutation.mutate(review._id || review.id);
                        }
                      }}
                      disabled={publishReviewMutation.isPending}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                      title="Send and publish this review schedule"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{publishReviewMutation.isPending ? 'Sending...' : 'Send Schedule'}</span>
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setMarksSearchTerm('');
                      setMarksReviewModal(review);
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                    title="View marks submitted by faculty for this review"
                  >
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>View Group Marks</span>
                  </button>
                  <button 
                    onClick={() => openEditModal(review)}
                    className="p-2 text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition"
                    title="Edit Review"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(`Delete review "${review.title}"?`)) deleteReviewMutation.mutate(review._id || review.id);
                    }}
                    className="p-2 text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {editingReview ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />} 
                {editingReview ? 'Edit Review Schedule' : 'Create Review Schedule'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="createReviewForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Review Type *</label>
                    <select 
                      required
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option>Proposal Review</option>
                      <option>SRS Review</option>
                      <option>Design Review</option>
                      <option>Development Review</option>
                      <option>Mid-Term Review</option>
                      <option>Testing Review</option>
                      <option>Final Report Review</option>
                      <option>Final Evaluation</option>
                    </select>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Review Title *</label>
                    <input 
                      type="text" required
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      placeholder="e.g. Mid-Term Review 2026"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Review Date *</label>
                    <input 
                      type="date" required
                      value={formData.reviewDate}
                      onChange={e => setFormData({...formData, reviewDate: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Marks *</label>
                    <input 
                      type="number" required min="1" max="100"
                      value={formData.maxMarks}
                      onChange={e => setFormData({...formData, maxMarks: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                    <input 
                      type="time" required
                      value={formData.startTime}
                      onChange={e => setFormData({...formData, startTime: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
                    <input 
                      type="time" required
                      value={formData.endTime}
                      onChange={e => setFormData({...formData, endTime: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                      <Image className="w-3.5 h-3.5 text-blue-600" /> Notice Photo / Document URL
                    </label>
                    <input 
                      type="text"
                      value={formData.attachmentUrl}
                      onChange={e => setFormData({...formData, attachmentUrl: e.target.value})}
                      placeholder="https://example.com/notice-photo.jpg"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-mono rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Marks Visibility</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer flex-1">
                        <input type="radio" name="visibility" value="HIDDEN" checked={formData.marksVisibility === 'HIDDEN'} onChange={() => setFormData({...formData, marksVisibility: 'HIDDEN'})} />
                        <Lock className="w-4 h-4 text-slate-500" /> <span className="text-sm font-semibold">Hidden from Students</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer flex-1">
                        <input type="radio" name="visibility" value="VISIBLE" checked={formData.marksVisibility === 'VISIBLE'} onChange={() => setFormData({...formData, marksVisibility: 'VISIBLE'})} />
                        <Unlock className="w-4 h-4 text-emerald-600" /> <span className="text-sm font-semibold text-emerald-700">Visible to Students</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Status</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="DRAFT">Save as Draft (⚪)</option>
                      <option value="PUBLISHED">Publish immediately (🟡)</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition">Cancel</button>
              {(!editingReview || editingReview.status === 'DRAFT') && (
                <button
                  type="button"
                  disabled={saveReviewMutation.isPending}
                  onClick={() => {
                    saveReviewMutation.mutate({ ...formData, status: 'PUBLISHED' });
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 text-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish & Send Now</span>
                </button>
              )}
              <button 
                type="submit" form="createReviewForm"
                disabled={saveReviewMutation.isPending}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saveReviewMutation.isPending ? 'Saving...' : editingReview ? 'Save Changes' : 'Save as Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* GROUP EVALUATIONS & MARKS MODAL */}
      {marksReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] border border-slate-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Award className="w-6 h-6 text-indigo-600" />
                    {marksReviewModal.title}
                  </h2>
                  <StatusBadge status={marksReviewModal.status} />
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Max Marks: {marksReviewModal.maxMarks}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Faculty evaluations, individual student scores, and feedback for assigned project groups.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!marksDetailData?.groups || marksDetailData.groups.length === 0) {
                      alert('No evaluation records available to export.');
                      return;
                    }
                    const headers = ['Group Code', 'Group Name', 'Faculty Evaluator', 'Evaluator Email', 'Student Name', 'Enrollment No', 'Marks Obtained', 'Max Marks', 'Percentage', 'Status', 'Feedback'];
                    const rows = [];
                    marksDetailData.groups.forEach(g => {
                      (g.students || []).forEach(s => {
                        const pct = Math.round((s.marks / (s.maxMarks || marksReviewModal.maxMarks || 20)) * 100);
                        rows.push([
                          `"${g.groupCode || 'N/A'}"`,
                          `"${g.groupName || 'N/A'}"`,
                          `"${g.faculty?.name || 'Faculty'}"`,
                          `"${g.faculty?.email || ''}"`,
                          `"${s.name || 'Student'}"`,
                          `"${s.enrollmentNumber || 'N/A'}"`,
                          s.marks,
                          s.maxMarks || marksReviewModal.maxMarks || 20,
                          `"${pct}%"`,
                          `"${s.status || 'SUBMITTED'}"`,
                          `"${(s.feedback || '').replace(/"/g, '""')}"`
                        ]);
                      });
                    });
                    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                    const link = document.createElement('a');
                    link.href = encodeURI(csvContent);
                    link.download = `Review_${(marksReviewModal.title || 'Marks').replace(/\s+/g, '_')}_Evaluations.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMarksReviewModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter & Metric Bar */}
            <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter student, group, or faculty..."
                  value={marksSearchTerm}
                  onChange={(e) => setMarksSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span>Total Evaluations: <b className="text-slate-900">{marksDetailData?.totalEvaluations || 0}</b></span>
                <span>Groups Graded: <b className="text-slate-900">{marksDetailData?.groups?.length || 0}</b></span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {isMarksDetailLoading ? (
                <LoadingSpinner text="Loading group evaluations and marks..." />
              ) : !marksDetailData?.groups || marksDetailData.groups.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-700">No Marks Recorded Yet</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Faculty panel evaluators have not submitted marks or draft evaluations for this review event yet.
                  </p>
                </div>
              ) : (
                marksDetailData.groups
                  .filter((grp) => {
                    const term = marksSearchTerm.toLowerCase();
                    if (!term) return true;
                    const matchGroup = (grp.groupName || '').toLowerCase().includes(term) || (grp.groupCode || '').toLowerCase().includes(term);
                    const matchFaculty = (grp.faculty?.name || '').toLowerCase().includes(term);
                    const matchStudent = (grp.students || []).some(
                      (s) => (s.name || '').toLowerCase().includes(term) || (s.enrollmentNumber || '').toLowerCase().includes(term)
                    );
                    return matchGroup || matchFaculty || matchStudent;
                  })
                  .map((grp) => (
                    <div key={grp.groupId} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                      {/* Group Header Card */}
                      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded font-mono">
                              {grp.groupCode || 'GROUP'}
                            </span>
                            <h4 className="font-bold text-slate-800 text-sm">{grp.groupName}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Evaluated by: <b className="text-slate-700">{grp.faculty?.name || 'Faculty Guide'}</b> {grp.faculty?.email ? `(${grp.faculty.email})` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            grp.status === 'SUBMITTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {grp.status || 'SUBMITTED'}
                          </span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                            Group Avg: {grp.averageMarks} / {marksReviewModal.maxMarks}
                          </span>
                        </div>
                      </div>

                      {/* Students Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2.5">Student</th>
                              <th className="px-4 py-2.5">Enrollment No</th>
                              <th className="px-4 py-2.5">Score</th>
                              <th className="px-4 py-2.5">Faculty Feedback</th>
                              <th className="px-4 py-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(grp.students || []).map((student) => {
                              const pct = Math.round((student.marks / (student.maxMarks || marksReviewModal.maxMarks || 20)) * 100);
                              return (
                                <tr key={student._id || student.studentId} className="hover:bg-slate-50/80 transition">
                                  <td className="px-4 py-3 font-semibold text-slate-800">
                                    {student.name}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-slate-500">
                                    {student.enrollmentNumber || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 font-bold">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-mono text-slate-900">{student.marks}</span>
                                      <span className="text-slate-400 font-normal">/ {student.maxMarks || marksReviewModal.maxMarks}</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                        pct >= 75 ? 'bg-emerald-100 text-emerald-800' : pct >= 50 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {pct}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 italic max-w-md">
                                    {student.feedback ? `"${student.feedback}"` : <span className="text-slate-400 not-italic">No feedback provided</span>}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      student.status === 'SUBMITTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                    }`}>
                                      {student.status || 'SUBMITTED'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
              <button
                type="button"
                onClick={() => setMarksReviewModal(null)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorReviewsPage;
