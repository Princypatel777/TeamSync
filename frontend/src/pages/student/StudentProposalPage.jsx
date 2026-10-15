import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  FileText,
  Sparkles,
  ShieldAlert,
  Save,
  Send,
  Plus,
  X,
  CheckCircle,
  AlertTriangle,
  Clock,
  MessageSquare,
  HelpCircle,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  RotateCcw,
  Trash2,
  Lock,
} from 'lucide-react';

export const StudentProposalPage = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('DRAFT'); // DRAFT | AI | SIMILARITY
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);

  // Draft State
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('Web Development');
  const [techStack, setTechStack] = useState([]);
  const [newTech, setNewTech] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [objectives, setObjectives] = useState([]);
  const [newObj, setNewObj] = useState('');
  const [scope, setScope] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [innovation, setInnovation] = useState('');

  const [uiMessage, setUiMessage] = useState({ type: '', text: '' });

  // Fetch my proposal draft
  const { data, isLoading } = useQuery({
    queryKey: ['myProposal', selectedGroupId],
    queryFn: async () => {
      const url = selectedGroupId ? `/proposals/my-proposal?groupId=${selectedGroupId}` : '/proposals/my-proposal';
      const res = await API.get(url);
      return res.data;
    },
  });

  const projects = data?.projects || [];
  const project = projects.find(p => (p.id || p._id) === activeProjectId) || data?.project;

  useEffect(() => {
    if (data?.group?._id && !selectedGroupId) {
      setSelectedGroupId(data.group._id);
    }
  }, [data?.group?._id, selectedGroupId]);

  useEffect(() => {
    if (data?.projects?.length > 0) {
      const availableIds = data.projects.map(p => p.id || p._id);
      if (!activeProjectId || !availableIds.includes(activeProjectId)) {
        setActiveProjectId(availableIds[0]);
      }
    }
  }, [data, activeProjectId]);

  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setDomain(project.domain || 'Web Development');
      setTechStack(project.techStack || []);
      setProblemStatement(project.problemStatement || '');
      setObjectives(project.objectives || []);
      setScope(project.scope || '');
      setExpectedOutcome(project.expectedOutcome || '');
      setInnovation(project.innovation || '');
    }
  }, [project]);

  // Create New Proposal Mutation
  const createProposalMutation = useMutation({
    mutationFn: async () => {
      const res = await API.post('/proposals/create', { groupId: selectedGroupId || data?.group?._id });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myProposal']);
      const newId = resData.project?.id || resData.project?._id;
      if (newId) setActiveProjectId(newId);
      setUiMessage({ type: 'success', text: 'New proposal draft created successfully!' });
      setTimeout(() => setUiMessage({ type: '', text: '' }), 3000);
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create proposal.';
      setUiMessage({ type: 'error', text: msg });
    }
  });

  // Withdraw Proposal Mutation
  const withdrawProposalMutation = useMutation({
    mutationFn: async () => {
      const res = await API.post('/proposals/withdraw', { projectId: activeProjectId });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myProposal']);
      setUiMessage({ type: 'success', text: resData.message || 'Proposal withdrawn to draft. You can now edit.' });
      setTimeout(() => setUiMessage({ type: '', text: '' }), 4000);
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to withdraw proposal.';
      setUiMessage({ type: 'error', text: msg });
    }
  });

  // Delete Proposal Slot Mutation
  const deleteProposalMutation = useMutation({
    mutationFn: async (pId) => {
      const res = await API.delete(`/proposals/${pId}`);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myProposal']);
      setActiveProjectId(null);
      setUiMessage({ type: 'success', text: resData.message || 'Proposal slot deleted.' });
      setTimeout(() => setUiMessage({ type: '', text: '' }), 3000);
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete proposal slot.';
      setUiMessage({ type: 'error', text: msg });
    }
  });

  // Save Draft Mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await API.put('/proposals/draft', { ...payload, projectId: activeProjectId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myProposal']);
      setUiMessage({ type: 'success', text: 'Proposal draft saved successfully.' });
      setTimeout(() => setUiMessage({ type: '', text: '' }), 3000);
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to save draft.';
      setUiMessage({ type: 'error', text: msg });
    },
  });

  // Submit Proposal Mutation — auto-saves draft first, then submits
  const submitProposalMutation = useMutation({
    mutationFn: async (draftPayload) => {
      // Step 1: Save the latest draft data so the backend validates current form values
      await API.put('/proposals/draft', { ...draftPayload, projectId: activeProjectId });
      // Step 2: Submit the saved proposal for faculty review
      const res = await API.post('/proposals/submit', { projectId: activeProjectId });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myProposal']);
      setUiMessage({ type: 'success', text: resData.message || 'Proposal submitted for faculty review!' });
    },
    onError: (err) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        'Submission failed. Make sure all required fields are filled in.';
      setUiMessage({ type: 'error', text: msg });
    },
  });

  // AI Recommendation Mutation
  const aiRecommendationMutation = useMutation({
    mutationFn: async (selectedDomain) => {
      const res = await API.post('/proposals/ai-recommendations', {
        domain: selectedDomain,
        projectId: activeProjectId,
        groupId: selectedGroupId || data?.group?._id,
      });
      return res.data;
    },
  });

  // Similarity Scan Mutation
  const similarityScanMutation = useMutation({
    mutationFn: async () => {
      const res = await API.post('/proposals/similarity-check', { projectId: activeProjectId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myProposal']);
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Similarity check failed.';
      setUiMessage({ type: 'error', text: msg });
    }
  });

  // Request Edit Mutation
  const requestEditMutation = useMutation({
    mutationFn: async ({ reason, fields }) => {
      const res = await API.post('/proposals/request-edit', { reason, fields, projectId: activeProjectId });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myProposal']);
      setIsChangeModalOpen(false);
      setChangeReason('');
      setSelectedFields([]);
      setUiMessage({ type: 'success', text: resData.message || 'Edit request sent successfully.' });
      setTimeout(() => setUiMessage({ type: '', text: '' }), 3000);
    },
    onError: (err) => {
      setUiMessage({ type: 'error', text: err.response?.data?.message || 'Failed to request edit.' });
    }
  });

  const handleAddTech = (e) => {
    e.preventDefault();
    if (newTech.trim() && !techStack.includes(newTech.trim())) {
      setTechStack([...techStack, newTech.trim()]);
      setNewTech('');
    }
  };

  const handleAddObjective = (e) => {
    e.preventDefault();
    if (newObj.trim() && !objectives.includes(newObj.trim())) {
      setObjectives([...objectives, newObj.trim()]);
      setNewObj('');
    }
  };

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({
      title,
      domain,
      techStack,
      problemStatement,
      objectives,
      scope,
      expectedOutcome,
      innovation,
    });
  };

  const handleApplyAiRecommendation = (rec) => {
    setTitle(rec.title);
    setDomain(rec.domain || domain);
    setProblemStatement(rec.problemStatement);
    setObjectives(rec.objectives || []);
    setTechStack(rec.techStack || []);
    setInnovation(rec.innovation || '');
    setExpectedOutcome(rec.expectedOutcome || '');
    setActiveTab('DRAFT');
    setUiMessage({ type: 'success', text: `Loaded AI Recommendation: "${rec.title}" into your proposal draft!` });
  };

  if (isLoading) return <LoadingSpinner text="Loading proposal draft..." />;

  // Handle error state — user has no group or API failed
  if (!data?.project) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Project Proposal</h1>
              <p className="text-sm text-amber-600 mt-1 font-medium">
                You must belong to a project group before you can create a proposal. Please join or create a group first.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userRoleInGroup = data.userRoleInGroup;
  const feedbackHistory = data.feedbackHistory || [];
  const similarityReport = similarityScanMutation.data?.similarityReport;

  const isLocked = project.status === 'APPROVED' || project.status === 'SUBMITTED' || project.status === 'UNDER_REVIEW' || project.status === 'EDIT_REQUESTED' || project.status === 'CHANGE_REQUESTED';
  const canEdit = !isLocked;
  const isLeader = userRoleInGroup === 'LEADER';

  const isFieldLocked = (fieldName) => {
    if (project.status === 'CHANGE_APPROVED') {
      return !(project.unlockedFields || []).includes(fieldName);
    }
    return isLocked;
  };

  const activeProjects = projects.filter(p => p.status !== 'REJECTED' && !p.isArchived);
  const rejectedProjects = projects.filter(p => p.status === 'REJECTED' || p.isArchived);

  return (
    <div className="space-y-6">
      {/* Faculty / Coordinator Reviewer Banner */}
      {(data?.isReviewerMode || ['FACULTY', 'COORDINATOR'].includes(user?.role)) && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-indigo-900 shadow-xs">
          <div className="flex items-center space-x-2 text-sm font-semibold">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Faculty Guide Inspection Mode: Viewing Group Proposal ({data?.group?.name || 'Group'})</span>
          </div>
          <Link
            to="/faculty/proposals"
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition"
          >
            Open Review Desk
          </Link>
        </div>
      )}
      {/* Active Group Selector Banner / Tabs */}
      {data?.groups && data.groups.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Project Group</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {data.groups.length} {data.groups.length === 1 ? 'Group' : 'Groups'}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-800">
                {data.group?.name || 'My Project Group'}
                {data.group?.code && (
                  <span className="ml-2 text-xs font-mono font-medium text-slate-500">
                    ({data.group.code})
                  </span>
                )}
              </h2>
            </div>
          </div>

          {/* Group Switcher Tabs */}
          {data.groups.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">Switch Group:</span>
              {data.groups.map((g) => {
                const gId = g.id || g._id;
                const isCurrent = String(gId) === String(selectedGroupId || data.group?._id);
                return (
                  <button
                    key={gId}
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(gId);
                      setActiveProjectId(null);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-2 ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{g.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isCurrent ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'}`}>
                      {g.userRole}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* SIDEBAR: Project Ideas List */}
        <div className="w-full xl:w-72 shrink-0 space-y-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Proposal Slots</h3>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              {activeProjects.length} / 3 Used
            </span>
          </div>

          <div className="space-y-3">
            {activeProjects.map((p, idx) => {
              const pId = p.id || p._id;
              const isSelected = activeProjectId === pId;
              return (
                <div
                  key={pId}
                  className={`group relative rounded-xl border transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveProjectId(pId)}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700">Option {idx + 1}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="text-sm font-semibold text-slate-900 truncate pr-6">
                      {p.title || 'Untitled Proposal'}
                    </div>
                  </button>
                  {isLeader && p.status === 'DRAFT' && activeProjects.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete proposal slot "Option ${idx + 1}"?`)) {
                          deleteProposalMutation.mutate(pId);
                        }
                      }}
                      className="absolute right-2.5 bottom-2.5 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Delete draft slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {activeProjects.length < 3 && (
              <button
                onClick={() => createProposalMutation.mutate()}
                disabled={createProposalMutation.isPending}
                className="w-full mt-2 p-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center space-y-1"
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs font-bold">Create New Proposal</span>
              </button>
            )}

            {rejectedProjects.length > 0 && (
              <div className="pt-4 mt-2 border-t border-slate-100 space-y-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">History (Rejected/Archived)</h3>
                {rejectedProjects.map((p) => {
                  const pId = p.id || p._id;
                  return (
                    <button
                      key={pId}
                      type="button"
                      onClick={() => setActiveProjectId(pId)}
                      className={`w-full text-left p-3 rounded-xl border transition-all opacity-80 ${
                        activeProjectId === pId
                          ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500 ring-opacity-20'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="text-sm font-semibold text-slate-700 truncate line-through">
                        {p.title || 'Untitled Proposal'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 space-y-6 w-full">
      {/* Status Banner for locked proposals */}
      {isLocked && (
        <div className={`p-4 rounded-xl border text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          project.status === 'APPROVED'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center space-x-2.5">
            {project.status === 'APPROVED' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            ) : (
              <Clock className="w-5 h-5 shrink-0 text-blue-600" />
            )}
            <span className="font-medium text-xs sm:text-sm">
              {project.status === 'APPROVED' && 'Your proposal has been approved! The project is now active for development.'}
              {project.status === 'SUBMITTED' && 'Your proposal has been submitted and is awaiting faculty review. Editing is locked until feedback is received.'}
              {project.status === 'UNDER_REVIEW' && 'Your proposal is currently being reviewed by the faculty guide. Please wait for feedback.'}
              {project.status === 'EDIT_REQUESTED' && 'You have requested to edit your approved proposal. Awaiting faculty approval.'}
              {project.status === 'REVISION_REQUIRED' && 'Revision required! Please update based on faculty feedback and resubmit.'}
              {project.status === 'REJECTED' && 'Proposal rejected! You have regained a submission try. Please create a new draft and submit.'}
            </span>
          </div>

          {/* Leader action: Withdraw to edit */}
          {project.status === 'SUBMITTED' && isLeader && (
            <button
              onClick={() => {
                if (window.confirm('Withdraw proposal back to draft? You will be able to edit all fields and resubmit.')) {
                  withdrawProposalMutation.mutate();
                }
              }}
              disabled={withdrawProposalMutation.isPending}
              className="px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold shadow-xs shrink-0 flex items-center space-x-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{withdrawProposalMutation.isPending ? 'Withdrawing...' : 'Withdraw to Edit'}</span>
            </button>
          )}
        </div>
      )}

      {/* Project Status Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Project Status</h3>
        <div className="flex items-center text-xs font-semibold overflow-x-auto pb-2">
          <div className="flex items-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Draft Created
          </div>
          <div className="w-8 h-px bg-slate-300 mx-2"></div>
          <div className={`flex items-center ${(project.status === 'SUBMITTED' || project.status === 'UNDER_REVIEW' || project.status === 'REVISION_REQUIRED' || project.status === 'APPROVED' || project.status === 'ACTIVE') ? 'text-emerald-600' : 'text-slate-400'}`}>
            {(project.status === 'SUBMITTED' || project.status === 'UNDER_REVIEW' || project.status === 'REVISION_REQUIRED' || project.status === 'APPROVED' || project.status === 'ACTIVE') ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <div className={`w-2 h-2 rounded-full mr-2 ${project.status === 'DRAFT' ? 'bg-blue-600' : 'bg-slate-300'}`}></div>}
            Proposal Submitted
          </div>
          <div className="w-8 h-px bg-slate-300 mx-2"></div>
          <div className={`flex items-center ${(project.status === 'UNDER_REVIEW' || project.status === 'REVISION_REQUIRED' || project.status === 'APPROVED' || project.status === 'ACTIVE') ? 'text-emerald-600' : 'text-slate-400'}`}>
            {(project.status === 'REVISION_REQUIRED' || project.status === 'APPROVED' || project.status === 'ACTIVE') ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <div className={`w-2 h-2 rounded-full mr-2 ${project.status === 'SUBMITTED' ? 'bg-blue-600' : 'bg-slate-300'}`}></div>}
            Faculty Review
          </div>
          {project.status === 'REVISION_REQUIRED' && (
            <>
              <div className="w-8 h-px bg-rose-300 mx-2"></div>
              <div className="flex items-center text-rose-600">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Revision Required
              </div>
            </>
          )}
          {project.status === 'REJECTED' && (
            <>
              <div className="w-8 h-px bg-red-300 mx-2"></div>
              <div className="flex items-center text-red-600">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Rejected (Try Again)
              </div>
            </>
          )}
          <div className="w-8 h-px bg-slate-300 mx-2"></div>
          <div className={`flex items-center ${(project.status === 'APPROVED' || project.status === 'ACTIVE') ? 'text-emerald-600' : 'text-slate-400'}`}>
            {(project.status === 'ACTIVE') ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <div className={`w-2 h-2 rounded-full mr-2 ${project.status === 'APPROVED' ? 'bg-blue-600' : 'bg-slate-300'}`}></div>}
            Approved
          </div>
          <div className="w-8 h-px bg-slate-300 mx-2"></div>
          <div className={`flex items-center ${project.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${project.status === 'ACTIVE' ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
            Development Active
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Project Proposal</h1>
              <StatusBadge status={project.status || 'DRAFT'} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Draft your project proposal, generate AI recommendations based on member skills, and run plagiarism similarity scans.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {project.status === 'APPROVED' && (
            <button
              onClick={() => setIsChangeModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Request Edit from Faculty</span>
            </button>
          )}

          {(canEdit || project.status === 'CHANGE_APPROVED') && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saveDraftMutation.isPending}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}</span>
              </button>

              {isLeader ? (
                <div className="flex flex-col items-end space-y-1">
                  <button
                    onClick={() => {
                      if (!title || title.length < 5) {
                        setUiMessage({ type: 'error', text: 'Project title must be at least 5 characters long.' });
                        return;
                      }
                      if (!problemStatement || problemStatement.length < 15) {
                        setUiMessage({ type: 'error', text: 'Problem statement must be at least 15 characters long.' });
                        return;
                      }
                      if (!techStack || techStack.length === 0) {
                        setUiMessage({ type: 'error', text: 'Please add at least 1 technology to your tech stack.' });
                        return;
                      }
                      if (window.confirm('Submit proposal for official Faculty Guide review? Your draft will be auto-saved.')) {
                        submitProposalMutation.mutate({
                          title,
                          domain,
                          techStack,
                          problemStatement,
                          objectives,
                          scope,
                          expectedOutcome,
                          innovation,
                        });
                      }
                    }}
                    disabled={submitProposalMutation.isPending || project.submissionCount >= 3}
                    className={`flex items-center space-x-1.5 px-4 py-2 text-white rounded-lg text-sm font-semibold shadow-md transition-all ${
                      project.submissionCount >= 3 ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitProposalMutation.isPending ? 'Submitting...' : (project.status === 'REVISION_REQUIRED' || project.status === 'REJECTED' || project.status === 'CHANGE_APPROVED' ? 'Resubmit Proposal' : 'Submit Proposal')}</span>
                  </button>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${project.submissionCount >= 3 ? 'text-rose-600' : 'text-slate-500'}`}>
                    Submissions: {project.submissionCount || 0} / 3
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                  Only the group leader can submit
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {uiMessage.text && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center space-x-2 ${
            uiMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {uiMessage.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          )}
          <span>{uiMessage.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button
          onClick={() => setActiveTab('DRAFT')}
          className={`pb-3 font-semibold text-sm flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'DRAFT'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Proposal Editor</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('AI');
            if (!aiRecommendationMutation.data) {
              aiRecommendationMutation.mutate(domain);
            }
          }}
          className={`pb-3 font-semibold text-sm flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'AI'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
          <span>AI Idea Engine</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('SIMILARITY');
            if (!similarityScanMutation.data) {
              similarityScanMutation.mutate();
            }
          }}
          className={`pb-3 font-semibold text-sm flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'SIMILARITY'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Similarity & Plagiarism</span>
        </button>
      </div>

      {/* TAB 1: PROPOSAL DRAFT EDITOR */}
      {activeTab === 'DRAFT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Project Title *
              </label>
              <input
                type="text"
                disabled={isFieldLocked('title')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI-Driven Smart Attendance & Risk Analytics"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Domain / Category
                </label>
                <select
                  disabled={isFieldLocked('domain')}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Web Development">Web Development</option>
                  <option value="Mobile App Development">Mobile App Development</option>
                  <option value="Artificial Intelligence / ML">Artificial Intelligence / ML</option>
                  <option value="Cloud Computing / DevOps">Cloud Computing / DevOps</option>
                  <option value="Cyber Security">Cyber Security</option>
                  <option value="Blockchain">Blockchain</option>
                  <option value="IoT & Embedded Systems">IoT & Embedded Systems</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Project Key Prefix
                </label>
                <input
                  type="text"
                  readOnly
                  value={project?.projectKey || 'PROJ'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-500 font-bold"
                />
              </div>
            </div>

            {/* Problem Statement */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Problem Statement *
              </label>
              <textarea
                rows="4"
                disabled={isFieldLocked('problemStatement')}
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="Describe the problem your project solves in detail..."
                className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            {/* Objectives */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                Project Objectives
              </label>
              <ul className="space-y-2 mb-3">
                {objectives.map((obj, i) => (
                  <li key={i} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                    <span className="font-medium">
                      {i + 1}. {obj}
                    </span>
                    {!isFieldLocked('objectives') && (
                      <button
                        onClick={() => setObjectives(objectives.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!isFieldLocked('objectives') && (
                <form onSubmit={handleAddObjective} className="flex gap-2">
                  <input
                    type="text"
                    value={newObj}
                    onChange={(e) => setNewObj(e.target.value)}
                    placeholder="Add objective statement..."
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>

            {/* Tech Stack */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                Tech Stack *
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {techStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200 font-mono"
                  >
                    {tech}
                    {!isFieldLocked('techStack') && (
                      <button
                        onClick={() => setTechStack(techStack.filter((t) => t !== tech))}
                        className="ml-1.5 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!isFieldLocked('techStack') && (
                <form onSubmit={handleAddTech} className="flex gap-2 max-w-sm">
                  <input
                    type="text"
                    value={newTech}
                    onChange={(e) => setNewTech(e.target.value)}
                    placeholder="Add tech (e.g. React, Node.js)..."
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>

            {/* Innovation & Outcome */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Innovation / Novelty
                </label>
                <textarea
                  rows="3"
                  disabled={isFieldLocked('innovation')}
                  value={innovation}
                  onChange={(e) => setInnovation(e.target.value)}
                  placeholder="What makes this project innovative compared to existing tools?"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Expected Outcome
                </label>
                <textarea
                  rows="3"
                  disabled={isFieldLocked('expectedOutcome')}
                  value={expectedOutcome}
                  onChange={(e) => setExpectedOutcome(e.target.value)}
                  placeholder="Deliverables (e.g. Web portal, mobile web scanner)..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Feedback & Review Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-blue-600" />
                Review & Feedback History
              </h3>

              {feedbackHistory.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No faculty feedback submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {feedbackHistory.map((fb) => (
                    <div key={fb._id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{fb.facultyId?.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(fb.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-xs font-semibold">
                        Action: <span className="text-indigo-600">{fb.action}</span>
                      </div>
                      <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100 mt-1">
                        "{fb.feedback}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Faculty Guide Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-500">
                Assigned Faculty Guide
              </h3>
              {project?.facultyGuideId ? (
                <div className="flex items-center space-x-3 pt-2">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{project.facultyGuideId.name}</div>
                    <div className="text-xs text-slate-500">{project.facultyGuideId.email}</div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 mt-2">
                  Faculty Guide unassigned. SGP Coordinator will assign your guide.
                </div>
              )}
            </div>
            
            {/* Project Team */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-500 flex items-center">
                <Users className="w-4 h-4 mr-2 text-indigo-600" />
                PROJECT TEAM
              </h3>
              <div className="space-y-3">
                {data.members?.map((member) => (
                  <div key={member._id} className="flex items-start p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800 flex items-center">
                        {member.userId?.name || member.user?.name}
                        {member.role === 'LEADER' && (
                          <span className="ml-2 bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                            Leader
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{member.userId?.enrollmentNumber || member.user?.enrollmentNumber}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI IDEA RECOMMENDATION ENGINE */}
      {activeTab === 'AI' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="text-xl font-bold">AI Project Recommendation Engine</h2>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Generates innovative, non-duplicate SGP ideas dynamically mapped to your team's skills.
              </p>
            </div>

            <button
              onClick={() => aiRecommendationMutation.mutate(domain)}
              disabled={aiRecommendationMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center space-x-2"
            >
              <Cpu className="w-4 h-4" />
              <span>{aiRecommendationMutation.isPending ? 'Generating Ideas...' : 'Regenerate Ideas'}</span>
            </button>
          </div>

          {aiRecommendationMutation.isPending ? (
            <LoadingSpinner text="Analyzing group skill vector & generating recommendations..." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(aiRecommendationMutation.data?.recommendations || []).map((rec, idx) => (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold font-mono">
                        {rec.matchScore}% Match Score
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{rec.difficulty}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">{rec.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-3">{rec.problemStatement}</p>

                    <div className="pt-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Tech Stack:
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {(rec.techStack || []).map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic">
                      "{rec.explanation}"
                    </p>
                  </div>

                  {!isLocked && (
                    <button
                      onClick={() => handleApplyAiRecommendation(rec)}
                      className="mt-6 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <span>Apply to Proposal Draft</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SIMILARITY & PLAGIARISM CHECK */}
      {activeTab === 'SIMILARITY' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Historical Similarity & Plagiarism Detector</h3>
                <p className="text-xs text-slate-500">
                  Scans college project repository to prevent duplicate topic submissions.
                </p>
              </div>
            </div>

            <button
              onClick={() => similarityScanMutation.mutate()}
              disabled={similarityScanMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
            >
              {similarityScanMutation.isPending ? 'Scanning DB...' : 'Re-Run Scan'}
            </button>
          </div>

          {similarityScanMutation.isPending ? (
            <LoadingSpinner text="Computing Jaccard keyword overlap against institutional project database..." />
          ) : similarityReport ? (
            <div className="space-y-6">
              {/* Score Display Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center space-x-6">
                  <div
                    className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-black font-mono border-4 ${
                      similarityReport.isHighRisk
                        ? 'bg-rose-50 text-rose-600 border-rose-400'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-400'
                    }`}
                  >
                    {similarityReport.similarityScore}%
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800">
                      {similarityReport.isHighRisk ? 'High Similarity Warning' : 'Low Overlap (Original Idea)'}
                    </h4>
                    <p className="text-xs text-slate-600 max-w-lg mt-1">{similarityReport.originalityAdvice}</p>
                  </div>
                </div>
              </div>

              {/* Similar Projects Table */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-slate-500">
                  Matching Historical Projects ({similarityReport.similarProjects?.length || 0})
                </h4>

                {similarityReport.similarProjects?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4">No matching historical projects found.</p>
                ) : (
                  <div className="space-y-3">
                    {similarityReport.similarProjects.map((match, i) => (
                      <div key={i} className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{match.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{match.reason}</div>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 font-mono text-xs font-bold rounded-full">
                          {match.similarityPercentage}% Match
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Change Request Modal */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800">Request Edit from Assigned Faculty</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assigned Guide: <span className="font-semibold text-slate-700">{project?.facultyGuideId?.name || data?.group?.guideId?.name || 'Faculty Guide'}</span>
                </p>
              </div>
              <button onClick={() => setIsChangeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Select Details to Change</label>
                <div className="grid grid-cols-2 gap-2">
                  {['title', 'domain', 'techStack', 'problemStatement', 'objectives', 'scope', 'expectedOutcome', 'innovation'].map(field => (
                    <label key={field} className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedFields.includes(field)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedFields([...selectedFields, field]);
                          else setSelectedFields(selectedFields.filter(f => f !== field));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Reason for Change *</label>
                <textarea
                  rows="3"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Explain why these fields need to be changed..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
              <button
                onClick={() => setIsChangeModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!changeReason) {
                    setUiMessage({ type: 'error', text: 'Reason is required.' });
                    return;
                  }
                  if (selectedFields.length === 0) {
                    setUiMessage({ type: 'error', text: 'Select at least one field to change.' });
                    return;
                  }
                  requestEditMutation.mutate({ reason: changeReason, fields: selectedFields });
                }}
                disabled={requestEditMutation.isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all"
              >
                {requestEditMutation.isPending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
    </div>
  );
};

export default StudentProposalPage;
