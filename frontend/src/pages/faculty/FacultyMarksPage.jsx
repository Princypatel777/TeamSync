import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { Award, Users, CheckCircle2, Lock, Unlock, FileText, Search, ShieldCheck } from 'lucide-react';

export const FacultyMarksPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('ALL');

  // Fetch Faculty Assigned Groups
  const { data: groupsData, isLoading: isGroupsLoading } = useQuery({
    queryKey: ['facultyAssignedGroupsMarks'],
    queryFn: async () => {
      const res = await API.get('/faculty/groups');
      return res.data;
    }
  });

  // Fetch Rubric Marks Records
  const { data: marksData, isLoading: isMarksLoading } = useQuery({
    queryKey: ['facultyGroupMarksRecords'],
    queryFn: async () => {
      const res = await API.get('/evaluation/marks');
      return res.data;
    }
  });

  // Fetch Review Marks Records (from Faculty Review Desk)
  const { data: reviewMarksData, isLoading: isReviewMarksLoading } = useQuery({
    queryKey: ['allFacultyReviewMarks'],
    queryFn: async () => {
      const res = await API.get('/reviews/marks');
      return res.data;
    }
  });

  if (isGroupsLoading || isMarksLoading || isReviewMarksLoading) {
    return <LoadingSpinner text="Loading Marks & Evaluation Transcripts..." />;
  }

  const groups = groupsData?.groups || [];
  const rubricRecords = marksData?.markRecords || [];
  const reviewRecords = (reviewMarksData?.marks || []).map(rm => {
    const max = rm.reviewId?.maxMarks || 20;
    const ratio = rm.marks / max;
    const grade = ratio >= 0.85 ? 'A+' : ratio >= 0.7 ? 'A' : ratio >= 0.5 ? 'B' : 'C';

    return {
      _id: rm._id,
      studentId: rm.studentId,
      projectId: {
        title: rm.reviewId?.title || 'Review Evaluation',
        groupId: rm.groupId
      },
      reviewStage: rm.reviewId?.type || rm.reviewId?.title || 'Review Stage',
      totalMarksObtained: rm.marks,
      maxMarks: max,
      grade,
      status: rm.status || 'SUBMITTED',
      feedback: rm.feedback,
      createdAt: rm.createdAt
    };
  });

  // Combine both sources
  const allRecords = [...rubricRecords, ...reviewRecords];

  // Filter mark records
  const filteredMarks = allRecords.filter(m => {
    const gId = m.projectId?.groupId?._id || m.projectId?.groupId?.id || m.projectId?.groupId;
    const matchesGroup = selectedGroupId === 'ALL' || String(gId) === String(selectedGroupId);
    const studentName = m.studentId?.name || '';
    const enrollNo = m.studentId?.enrollmentNumber || '';
    const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase()) || enrollNo.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Award className="w-7 h-7 text-indigo-600" />
            Marks & Evaluation Records
          </h1>
          <p className="text-slate-500 text-sm mt-1">View student scores, grade breakdowns, and review transcripts for your assigned project groups.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Coordinator Controls Grade Publishing
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search student or enrollment..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select 
            value={selectedGroupId}
            onChange={e => setSelectedGroupId(e.target.value)}
            className="border border-slate-200 rounded-lg text-xs font-semibold px-3 py-2 bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Assigned Groups ({groups.length})</option>
            {groups.map(g => (
              <option key={g._id || g.id} value={g._id || g.id}>
                {g.name || g.code || g.title || 'Group'}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500">
          Showing {filteredMarks.length} student records
        </div>
      </div>

      {/* MARKS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredMarks.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-700">No Evaluation Records Found</h3>
            <p className="text-xs mt-1 text-slate-400">Complete student evaluations under <b>Reviews & Feedback</b> desk to see recorded marks here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Enrollment No.</th>
                  <th className="px-5 py-3">Project / Group</th>
                  <th className="px-5 py-3">Review Stage</th>
                  <th className="px-5 py-3">Marks Obtained</th>
                  <th className="px-5 py-3">Grade</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMarks.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      {m.studentId?.name || 'Student'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-indigo-600">
                      {m.studentId?.enrollmentNumber || '24IT001'}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-700">
                      <span className="font-bold">{m.projectId?.title || 'Project'}</span>
                      {m.projectId?.groupId && (
                        <span className="block font-mono text-slate-400">{m.projectId.groupId.code || m.projectId.groupId.name}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 bg-slate-100 font-mono font-bold text-xs text-slate-700 rounded-md">
                        {m.reviewStage || 'REVIEW_1'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-black text-slate-900 text-base">
                      {m.totalMarksObtained} / {m.maxMarks || 100}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        m.grade === 'A+' || m.grade === 'A'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.grade === 'B+' || m.grade === 'B'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {m.grade || 'A'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        m.status === 'SUBMITTED' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {m.status === 'SUBMITTED' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3" />}
                        {m.status === 'SUBMITTED' ? 'Submitted / Recorded' : 'Draft / Pending'}
                      </span>
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

export default FacultyMarksPage;
