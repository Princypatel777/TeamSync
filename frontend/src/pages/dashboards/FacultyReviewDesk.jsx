import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { Award, CheckCircle2, Users, FileText, Calendar, Clock, Lock, Unlock, AlertCircle } from 'lucide-react';

export const FacultyReviewDesk = () => {
  const queryClient = useQueryClient();
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [marksData, setMarksData] = useState({}); // { studentId: { marks, feedback, status } }
  const [successBanner, setSuccessBanner] = useState('');

  // Fetch Reviews assigned to Faculty
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['facultyReviews'],
    queryFn: async () => {
      const res = await API.get('/reviews/faculty/assigned');
      return res.data;
    }
  });

  // Fetch Faculty's Assigned Groups as Fallback
  const { data: groupsData } = useQuery({
    queryKey: ['facultyAssignedGroupsList'],
    queryFn: async () => {
      const res = await API.get('/faculty/groups');
      return res.data;
    }
  });

  const reviews = reviewsData?.reviews || [];
  const allFacultyGroups = groupsData?.groups || [];

  // Auto-select first review & group if none selected
  useEffect(() => {
    if (!selectedReviewId && reviews.length > 0) {
      const firstRev = reviews[0];
      setSelectedReviewId(firstRev._id);
      if (firstRev.assignedGroups && firstRev.assignedGroups.length > 0) {
        setSelectedGroupId(firstRev.assignedGroups[0]._id || firstRev.assignedGroups[0].id);
      }
    }
  }, [reviews, selectedReviewId]);

  // Fetch Existing Marks for the selected Review
  const { data: reviewMarksResponse, isLoading: isMarksLoading } = useQuery({
    queryKey: ['reviewMarksDetail', selectedReviewId],
    queryFn: async () => {
      if (!selectedReviewId) return null;
      const res = await API.get(`/reviews/${selectedReviewId}/marks`);
      return res.data;
    },
    enabled: !!selectedReviewId,
  });

  const selectedReview = reviews.find(r => String(r._id) === String(selectedReviewId));
  const availableGroups = (selectedReview?.assignedGroups && selectedReview.assignedGroups.length > 0)
    ? selectedReview.assignedGroups
    : allFacultyGroups;

  const selectedGroup = availableGroups.find(g => String(g._id || g.id) === String(selectedGroupId));

  // Sync marksData whenever selectedGroupId or reviewMarksResponse changes
  useEffect(() => {
    if (!selectedGroupId) {
      setMarksData({});
      return;
    }

    const marksMap = {};
    const rawMarks = reviewMarksResponse?.rawMarks || [];

    // Pre-populate from fetched review marks
    rawMarks.forEach(m => {
      const mGroupId = String(m.groupId?._id || m.groupId);
      if (mGroupId === String(selectedGroupId)) {
        const sId = String(m.studentId?._id || m.studentId);
        marksMap[sId] = {
          marks: m.marks !== undefined && m.marks !== null ? m.marks : '',
          feedback: m.feedback || '',
          status: m.status || 'SUBMITTED',
          savedAt: m.updatedAt || m.createdAt
        };
      }
    });

    // Fallback: check savedMarks in selectedGroup object
    if (Object.keys(marksMap).length === 0 && selectedGroup?.savedMarks) {
      selectedGroup.savedMarks.forEach(m => {
        const sId = String(m.studentId?._id || m.studentId);
        marksMap[sId] = {
          marks: m.marks !== undefined && m.marks !== null ? m.marks : '',
          feedback: m.feedback || '',
          status: m.status || 'SUBMITTED',
          savedAt: m.updatedAt || m.createdAt
        };
      });
    }

    setMarksData(marksMap);
  }, [selectedReviewId, selectedGroupId, reviewMarksResponse, selectedGroup]);

  // Submit Marks Mutation
  const submitMarksMutation = useMutation({
    mutationFn: async ({ reviewId, payload }) => {
      const res = await API.post(`/reviews/${reviewId}/marks`, payload);
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['facultyReviews']);
      queryClient.invalidateQueries(['reviewMarksDetail', variables.reviewId]);
      queryClient.invalidateQueries(['allFacultyReviewMarks']);
      queryClient.invalidateQueries(['facultyGroupMarksRecords']);

      const msg = variables.payload.isDraft
        ? 'Evaluation draft saved successfully!'
        : 'Marks submitted and recorded successfully!';
      setSuccessBanner(msg);
      setTimeout(() => setSuccessBanner(''), 5000);
    },
    onError: (error) => {
      alert(error?.response?.data?.message || 'Failed to save marks. Please try again.');
    }
  });

  if (isLoading) return <LoadingSpinner text="Loading Assigned Reviews..." />;

  const handleMarksChange = (studentId, field, value) => {
    if (field === 'marks') {
      const num = Number(value);
      const max = selectedReview?.maxMarks || 20;
      if (value !== '' && (num < 0 || num > max)) return; // Block invalid marks
    }
    setMarksData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSave = (isDraft) => {
    if (!selectedReview || !selectedGroup) return;
    
    const max = selectedReview.maxMarks || 20;
    
    // Validate marks range
    for (const studentId of Object.keys(marksData)) {
      const m = Number(marksData[studentId]?.marks || 0);
      if (m < 0 || m > max) {
        alert(`Marks must be between 0 and ${max}!`);
        return;
      }
    }

    const studentMarks = Object.keys(marksData)
      .filter(sId => marksData[sId]?.marks !== '' && marksData[sId]?.marks !== undefined)
      .map(studentId => ({
        studentId,
        marks: Number(marksData[studentId].marks || 0),
        feedback: marksData[studentId].feedback || ''
      }));

    if (studentMarks.length === 0) {
      alert('Please enter marks for at least one student before saving.');
      return;
    }

    submitMarksMutation.mutate({
      reviewId: selectedReview._id,
      payload: {
        groupId: selectedGroup._id || selectedGroup.id,
        isDraft,
        studentMarks
      }
    });
  };

  const groupMembers = (selectedGroup?.members && selectedGroup.members.length > 0)
    ? selectedGroup.members
    : (selectedGroup?.leaderId ? [selectedGroup.leaderId] : []);

  // Determine if current selected group is evaluated
  const currentRawMarks = (reviewMarksResponse?.rawMarks || []).filter(
    m => String(m.groupId?._id || m.groupId) === String(selectedGroupId)
  );
  const isGroupEvaluated = currentRawMarks.length > 0 || selectedGroup?.isEvaluated;
  const groupEvaluatedCount = currentRawMarks.length || selectedGroup?.evaluatedCount || 0;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6">
      {/* LEFT SIDEBAR: MY REVIEWS */}
      <div className="w-full lg:w-1/3 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            My Assigned Reviews
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
            {reviews.length} Active
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {reviews.length === 0 ? (
            <div className="text-center p-8 text-slate-500 text-sm">
              <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              No reviews scheduled yet by Department Coordinator.
            </div>
          ) : (
            reviews.map(review => {
              const reviewGroups = (review.assignedGroups && review.assignedGroups.length > 0) ? review.assignedGroups : allFacultyGroups;
              const gradedGroupsCount = review.evaluatedGroupsCount || reviewGroups.filter(g => g.isEvaluated).length;

              return (
                <div 
                  key={review._id} 
                  onClick={() => { 
                    setSelectedReviewId(review._id); 
                    if (reviewGroups.length > 0) {
                      setSelectedGroupId(reviewGroups[0]._id || reviewGroups[0].id);
                    } else {
                      setSelectedGroupId(null);
                    }
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedReviewId === review._id ? 'bg-indigo-50/70 border-indigo-300 shadow-xs ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-slate-900 text-sm">{review.title}</h3>
                    <StatusBadge status={review.status} />
                  </div>
                  <div className="text-xs font-medium text-slate-500 flex items-center justify-between my-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {new Date(review.reviewDate).toLocaleDateString()}
                    </span>
                    <span className="font-semibold text-slate-700">Max Marks: {review.maxMarks}</span>
                  </div>

                  {/* Progress indicator */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2 pt-1 border-t border-slate-100">
                    <span>Groups Graded:</span>
                    <span className="font-bold text-indigo-700">
                      {gradedGroupsCount} / {reviewGroups.length} Evaluated
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center mr-1">Select Group:</span>
                    {reviewGroups.map(group => {
                      const gId = String(group._id || group.id);
                      const isSelected = String(selectedReviewId) === String(review._id) && String(selectedGroupId) === gId;
                      const hasMarks = group.isEvaluated || (selectedReviewId === review._id && (reviewMarksResponse?.rawMarks || []).some(m => String(m.groupId?._id || m.groupId) === gId));

                      return (
                        <span 
                          key={gId} 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setSelectedReviewId(review._id); 
                            setSelectedGroupId(group._id || group.id); 
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                            isSelected 
                              ? 'bg-indigo-600 text-white shadow-xs' 
                              : hasMarks
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-800'
                          }`}
                        >
                          {hasMarks ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Users className="w-3.5 h-3.5" />}
                          {group.name || group.title || group.code || 'Group'}
                          {hasMarks && group.averageMarks ? ` (${group.averageMarks})` : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT SIDE: EVALUATION FORM */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
        {!selectedReview ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <Award className="w-16 h-16 mb-4 text-slate-200" />
            <h3 className="text-xl font-bold text-slate-700">Select a Review</h3>
            <p className="mt-2 text-sm max-w-sm">Choose an assigned review stage from the left panel to begin evaluating student groups.</p>
          </div>
        ) : !selectedGroup ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
             <Users className="w-16 h-16 mb-4 text-slate-200" />
             <h3 className="text-xl font-bold text-slate-700">Select a Group</h3>
             <p className="mt-2 text-sm max-w-sm">Select a specific group badge under <b>"{selectedReview.title}"</b> to record evaluation marks.</p>
           </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/80 rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-800">{selectedReview.title}</h2>
                  <StatusBadge status={selectedReview.status} />
                </div>
                <div className="text-slate-500 text-sm mt-1.5 flex flex-wrap items-center gap-3">
                  <span>Evaluating: <b className="text-indigo-700 font-semibold">{selectedGroup.name || selectedGroup.title || 'Selected Group'}</b></span>
                  {selectedGroup.code && <span className="font-mono text-xs px-2 py-0.5 bg-slate-200 rounded text-slate-700">{selectedGroup.code}</span>}
                  
                  {isGroupEvaluated ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Evaluated & Saved ({groupEvaluatedCount} marked)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Pending Evaluation
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-slate-800">{selectedReview.maxMarks}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max Marks</div>
              </div>
            </div>

            {/* Success Toast */}
            {successBanner && (
              <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between shadow-2xs">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {successBanner}
                </span>
                <button onClick={() => setSuccessBanner('')} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">✕</button>
              </div>
            )}

            {/* Students Evaluation List */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {isMarksLoading && (
                <div className="text-center py-4 text-slate-400 text-xs flex items-center justify-center gap-2">
                  <LoadingSpinner text="Fetching saved marks..." />
                </div>
              )}

              {groupMembers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">No members found in this group.</p>
                </div>
              ) : (
                groupMembers.map((student, i) => {
                  const studentId = student._id || student.id || `student-${i}`;
                  const studentName = student.name || `Student ${i + 1}`;
                  const enrollNo = student.enrollmentNumber || student.enrollmentNo || `24IT00${i + 1}`;
                  const existingMark = marksData[studentId];
                  const hasSavedMarks = existingMark?.marks !== undefined && existingMark?.marks !== '' && existingMark?.marks !== null;

                  return (
                    <div key={studentId} className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs relative overflow-hidden space-y-3 transition hover:border-indigo-200">
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${hasSavedMarks ? 'bg-emerald-500' : 'bg-indigo-600'}`}></div>
                      <div className="flex justify-between items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 shrink-0">
                          {studentName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900">{studentName}</h4>
                              {hasSavedMarks && (
                                <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Saved: {existingMark.marks} / {selectedReview.maxMarks} ({existingMark.status || 'SUBMITTED'})
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{enrollNo}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                            <div className="col-span-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Marks (Max: {selectedReview.maxMarks})</label>
                              <input 
                                type="number" min="0" max={selectedReview.maxMarks}
                                value={marksData[studentId]?.marks ?? ''}
                                onChange={(e) => handleMarksChange(studentId, 'marks', e.target.value)}
                                className={`w-full border rounded-lg p-2 text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm ${
                                  hasSavedMarks ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-300'
                                }`}
                                placeholder={`0 - ${selectedReview.maxMarks}`}
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Evaluation Feedback</label>
                              <textarea 
                                rows="2"
                                value={marksData[studentId]?.feedback || ''}
                                onChange={(e) => handleMarksChange(studentId, 'feedback', e.target.value)}
                                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 resize-none"
                                placeholder="Enter specific feedback, strengths, or recommendations for this student..."
                              ></textarea>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-xl">
              <button 
                onClick={() => handleSave(true)}
                disabled={submitMarksMutation.isPending}
                className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition text-xs disabled:opacity-50"
              >
                {submitMarksMutation.isPending ? 'Saving...' : 'Save as Draft'}
              </button>
              <button 
                onClick={() => handleSave(false)}
                disabled={submitMarksMutation.isPending}
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition flex items-center gap-2 text-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4"/>
                {submitMarksMutation.isPending ? 'Saving...' : isGroupEvaluated ? 'Update Evaluation' : 'Submit Evaluation'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FacultyReviewDesk;
