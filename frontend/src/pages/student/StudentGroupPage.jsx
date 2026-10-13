import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  Users,
  Plus,
  Crown,
  UserPlus,
  Check,
  X,
  LogOut,
  Mail,
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  FolderGit2,
  Sparkles,
} from 'lucide-react';

export const StudentGroupPage = () => {
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [showAddGroupSection, setShowAddGroupSection] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch student's groups & invites
  const { data, isLoading } = useQuery({
    queryKey: ['myGroup', selectedGroupId],
    queryFn: async () => {
      const url = selectedGroupId ? `/groups/my-group?groupId=${selectedGroupId}` : '/groups/my-group';
      const res = await API.get(url);
      return res.data;
    },
  });

  // Create Group Mutation
  const createGroupMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await API.post('/groups', payload);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myGroup']);
      setGroupName('');
      setShowAddGroupSection(false);
      const newGId = resData.group?._id || resData.group?.id;
      if (newGId) setSelectedGroupId(newGId);
      setSuccessMessage('New project group created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setErrorMessage('');
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.message || 'Failed to create group.');
    },
  });

  // Join Group By Code Mutation
  const joinByCodeMutation = useMutation({
    mutationFn: async (code) => {
      const res = await API.post('/groups/join-by-code', { code });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myGroup']);
      setJoinCodeInput('');
      setShowAddGroupSection(false);
      const joinedGId = resData.group?._id || resData.group?.id;
      if (joinedGId) setSelectedGroupId(joinedGId);
      setSuccessMessage(resData.message || 'Joined group successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setErrorMessage('');
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.message || 'Failed to join group.');
    },
  });

  // Invite Member Mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ groupId, searchIdentifier }) => {
      const res = await API.post(`/groups/${groupId}/invite`, { searchIdentifier });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myGroup']);
      setInviteIdentifier('');
      setSuccessMessage(resData.message || 'Invitation sent!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setErrorMessage('');
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.response?.data?.errors?.[0]?.message ||
        'Failed to send invite.';
      setErrorMessage(msg);
    },
  });

  // Respond Invite Mutation
  const respondInviteMutation = useMutation({
    mutationFn: async ({ inviteId, action }) => {
      const res = await API.post(`/groups/invites/${inviteId}/respond`, { action });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myGroup']);
      setSuccessMessage(resData?.message || 'Invitation processed successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
      setErrorMessage('');
    },
    onError: (err) => {
      setErrorMessage(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Failed to process invitation.'
      );
    },
  });

  // Leave Group Mutation
  const leaveGroupMutation = useMutation({
    mutationFn: async (groupId) => {
      const res = await API.post(`/groups/${groupId}/leave`);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myGroup']);
      setSelectedGroupId(null);
      setSuccessMessage(resData?.message || 'You have left the group.');
      setTimeout(() => setSuccessMessage(''), 4000);
      setErrorMessage('');
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.message || 'Failed to leave group.');
    },
  });

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, memberId }) => {
      const res = await API.delete(`/groups/${groupId}/members/${memberId}`);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myGroup']);
      setSuccessMessage(resData?.message || 'Member removed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      setErrorMessage('');
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.message || err.response?.data?.detail || 'Failed to remove member.');
    },
  });

  // Cancel Invite Mutation
  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId) => {
      const res = await API.delete(`/groups/invites/${inviteId}`);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries(['myGroup']);
      setSuccessMessage(resData?.message || 'Invitation cancelled successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
      setErrorMessage('');
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.message || err.response?.data?.detail || 'Failed to cancel invitation.');
    },
  });

  // Mark Group Ready Mutation
  const markGroupReadyMutation = useMutation({
    mutationFn: async (groupId) => {
      const res = await API.put(`/groups/${groupId}/ready`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myGroup']);
      setSuccessMessage('Group marked as Ready for Proposal');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.message || 'Failed to update group status.');
    }
  });

  const handleCreateGroupSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!groupName.trim()) {
      setErrorMessage('Group name is required.');
      return;
    }
    createGroupMutation.mutate({ name: groupName });
  };

  const handleJoinByCodeSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!joinCodeInput.trim()) {
      setErrorMessage('Please enter a valid Group Code.');
      return;
    }
    joinByCodeMutation.mutate(joinCodeInput);
  };

  const hasGroup = data?.hasGroup;
  const group = data?.group;
  const groups = data?.groups || (group ? [group] : []);
  const members = data?.members || [];
  const userRoleInGroup = data?.userRoleInGroup;
  const sentInvites = data?.sentInvites || [];
  const incomingInvites = data?.pendingInvites || [];
  const maxMembers = Number(data?.maxMembers || group?.maxMembers || 4);
  const minMembers = Number(data?.minMembers || group?.minMembers || 2);
  const isGroupFull = members.length >= maxMembers;
  const pendingInvitesCount = sentInvites.length;
  const isInviteCapacityReached = (members.length + pendingInvitesCount) >= maxMembers;
  const availableSlots = Math.max(0, maxMembers - members.length - pendingInvitesCount);

  const handleInviteSubmit = (e, groupId) => {
    e.preventDefault();
    setErrorMessage('');
    if (isGroupFull) {
      setErrorMessage(`Cannot invite: Group has reached the maximum allowed limit of ${maxMembers} members set by the administrator.`);
      return;
    }
    if (isInviteCapacityReached) {
      setErrorMessage(`Cannot invite: All ${maxMembers} group slots are occupied (${members.length} members + ${pendingInvitesCount} pending invites). Cancel a pending invitation below to invite someone else.`);
      return;
    }
    if (!inviteIdentifier.trim()) {
      setErrorMessage('Enter an enrollment number or email address.');
      return;
    }
    inviteMemberMutation.mutate({ groupId, searchIdentifier: inviteIdentifier });
  };

  if (isLoading) return <LoadingSpinner text="Loading group information..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Project Groups</h1>
              <StatusBadge status={hasGroup ? 'ACTIVE' : 'PLANNED'} customLabel={hasGroup ? `${groups.length} Group${groups.length > 1 ? 's' : ''}` : 'Unassigned'} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Manage your teams for different projects, form new groups with different members, or join using a Group Code.
            </p>
          </div>
        </div>

        {hasGroup && (
          <button
            type="button"
            onClick={() => setShowAddGroupSection(!showAddGroupSection)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddGroupSection ? 'Close Form' : 'Create / Join Another Group'}</span>
          </button>
        )}
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Incoming Invitations Banner (if student received invites to other groups) */}
      {incomingInvites.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-900 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-indigo-600" />
              Incoming Group Invitations ({incomingInvites.length})
            </h3>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
              Action Required
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingInvites.map((invite) => {
              const inviteId = invite._id || invite.id;
              return (
                <div
                  key={inviteId}
                  className="p-3.5 bg-white border border-indigo-100 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {invite.groupId?.name || 'Project Group'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      From: <span className="font-semibold text-slate-700">{invite.invitedBy?.name || invite.groupId?.leaderId?.name || 'Leader'}</span>
                      {(invite.invitedBy?.enrollmentNumber || invite.groupId?.leaderId?.enrollmentNumber) ? (
                        <> (<span className="font-mono text-slate-600">{invite.invitedBy?.enrollmentNumber || invite.groupId?.leaderId?.enrollmentNumber}</span>)</>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => respondInviteMutation.mutate({ inviteId, action: 'ACCEPT' })}
                      disabled={respondInviteMutation.isPending}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => respondInviteMutation.mutate({ inviteId, action: 'REJECT' })}
                      disabled={respondInviteMutation.isPending}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs transition cursor-pointer"
                      title="Decline"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Group Switcher Bar */}
      {hasGroup && groups.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <FolderGit2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Your Project Groups ({groups.length}):
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {groups.map((g) => {
              const gId = g._id || g.id;
              const isSelected = (group?._id || group?.id) === gId;
              return (
                <button
                  key={gId}
                  type="button"
                  onClick={() => setSelectedGroupId(gId)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span>{g.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {g.userRole === 'LEADER' ? 'Leader' : 'Member'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE NEW GROUP & JOIN GROUP FORMS (Shown when toggled OR when student has 0 groups) */}
      {(!hasGroup || showAddGroupSection) && (
        <div className="p-6 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center">
                <Plus className="w-4 h-4 mr-2 text-blue-600" />
                Form a New Group or Join Another Project Team
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                You can participate in multiple project groups with different members for different projects.
              </p>
            </div>
            {hasGroup && (
              <button
                type="button"
                onClick={() => setShowAddGroupSection(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Join Group By Code Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Join Group by Code</h4>
                  <p className="text-xs text-slate-500">
                    Enter a Group Code provided by a teammate.
                  </p>
                </div>
              </div>

              <form onSubmit={handleJoinByCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Group Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    placeholder="e.g. GRP-2026-X639"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                  />
                </div>

                <button
                  type="submit"
                  disabled={joinByCodeMutation.isPending}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center justify-center cursor-pointer"
                >
                  {joinByCodeMutation.isPending ? 'Joining...' : 'Join Group'}
                </button>
              </form>
            </div>

            {/* Create Group Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">Create New Group</h4>
                  <p className="text-xs text-slate-500">
                    Form a new project team as the Group Leader.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Project Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Smart Campus Innovators"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={createGroupMutation.isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center justify-center cursor-pointer"
                >
                  {createGroupMutation.isPending ? 'Creating Group...' : 'Form Group & Become Leader'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE GROUP DETAILS */}
      {hasGroup && group && (
        <div className="space-y-6">
          {/* Group Overview Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-extrabold tracking-tight">{group.name}</h2>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-mono font-semibold">
                  {group.status || 'FORMING'}
                </span>
                <span className="px-2.5 py-0.5 bg-white/10 text-slate-300 rounded-md text-xs font-semibold">
                  Your Role: {userRoleInGroup}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono mb-2">
                Group Code: <span className="text-white font-bold">{group.code}</span>
              </p>

              <div className="flex items-center text-xs font-medium text-slate-300 bg-white/5 rounded-lg px-3 py-1.5 inline-flex border border-white/10">
                <Users className="w-3.5 h-3.5 mr-1.5" />
                {members.length} / {maxMembers} Members {isGroupFull ? '• (Max Limit Reached)' : `(Min: ${minMembers})`}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {userRoleInGroup === 'LEADER' && group.status === 'FORMING' && members.length >= (group.minMembers || 2) && (
                <button
                  onClick={() => {
                    if (window.confirm('Mark this group as ready for proposal? You will no longer be able to remove members directly.')) {
                      markGroupReadyMutation.mutate(group._id || group.id);
                    }
                  }}
                  disabled={markGroupReadyMutation.isPending}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{markGroupReadyMutation.isPending ? 'Updating...' : 'Ready for Proposal'}</span>
                </button>
              )}

              <button
                onClick={() => {
                  navigator.clipboard.writeText(group.code);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to leave group "${group.name}"?`)) {
                    leaveGroupMutation.mutate(group._id || group.id);
                  }
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Group</span>
              </button>
            </div>
          </div>

          {/* Members & Invite Management Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Group Members ({members.length} / {maxMembers})
              </h3>
              <span className="text-xs text-slate-500">
                Min: {minMembers} members required
              </span>
            </div>

            {/* Member Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => (
                <div
                  key={member._id || member.id}
                  className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-start justify-between relative group hover:border-blue-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 text-sm truncate">
                        {member.user?.name || member.userId?.name}
                      </span>
                      {member.role === 'LEADER' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          <Crown className="w-3 h-3 mr-1 text-amber-500" />
                          Leader
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {member.user?.enrollmentNumber || member.userId?.enrollmentNumber}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {member.user?.email || member.userId?.email}
                    </p>

                    {/* Member Skills */}
                    {member.user?.profile?.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {member.user.profile.skills.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 bg-white text-slate-600 border border-slate-200 rounded text-[10px] font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {userRoleInGroup === 'LEADER' && member.role !== 'LEADER' && group.status === 'FORMING' && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${member.user?.name || 'this member'} from the group?`)) {
                          removeMemberMutation.mutate({
                            groupId: group._id || group.id,
                            memberId: member.user?._id || member.user?.id || member.userId?._id || member.userId?.id || member.userId,
                          });
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                      title="Remove Member"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Invite Teammates Section (Only visible to Leader) */}
            {userRoleInGroup === 'LEADER' && group.status === 'FORMING' && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center">
                    <UserPlus className="w-4 h-4 mr-1.5 text-blue-600" />
                    Invite Classmate to this Group
                  </h4>
                  {!isGroupFull && !isInviteCapacityReached && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {availableSlots} slot{availableSlots > 1 ? 's' : ''} available
                    </span>
                  )}
                </div>

                {isGroupFull ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-amber-900">Maximum Group Limit Reached ({maxMembers} Members)</h5>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        The administrator has configured a maximum limit of <strong>{maxMembers} members</strong> per project group. Your group currently has {members.length} active members.
                      </p>
                    </div>
                  </div>
                ) : isInviteCapacityReached ? (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-blue-900">All Available Slots Reserved ({maxMembers} / {maxMembers})</h5>
                      <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                        Your group has {members.length} accepted member(s) and {pendingInvitesCount} pending invite(s). Cancel a pending invitation below to invite someone else.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={(e) => handleInviteSubmit(e, group._id || group.id)} className="flex gap-2 max-w-lg">
                    <input
                      type="text"
                      value={inviteIdentifier}
                      onChange={(e) => setInviteIdentifier(e.target.value)}
                      placeholder="Enter student enrollment number (e.g. 24IT002)..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={inviteMemberMutation.isPending}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{inviteMemberMutation.isPending ? 'Sending...' : 'Send Invite'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Outgoing Pending Invites */}
            {userRoleInGroup === 'LEADER' && group.status === 'FORMING' && sentInvites.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 flex items-center mb-3">
                  📨 Pending Invitations Sent for this Group
                </h4>
                <div className="space-y-2">
                  {sentInvites.map((inv) => (
                    <div key={inv._id || inv.id} className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-slate-50">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{inv.userId?.name || inv.invitee?.name || inv.searchIdentifier}</div>
                        <div className="text-xs text-slate-500">Invitation Pending ({inv.userId?.enrollmentNumber || inv.userId?.email || ''})</div>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel this invitation?')) {
                            cancelInviteMutation.mutate(inv._id || inv.id);
                          }
                        }}
                        disabled={cancelInviteMutation.isPending}
                        className="px-3 py-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {cancelInviteMutation.isPending ? 'Cancelling...' : 'Cancel Invitation'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentGroupPage;
