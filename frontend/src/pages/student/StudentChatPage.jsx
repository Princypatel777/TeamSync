import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  MessageSquare,
  Send,
  Users,
  GraduationCap,
  Edit2,
  Trash2,
  Paperclip,
  Reply,
  X,
  Image as ImageIcon,
  CheckCircle2,
  FolderGit2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const StudentChatPage = ({ facultyMode = false, specificGroupId = null, specificProjectId = null }) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const [editingMsgId, setEditingMsgId] = useState(null);
  const [replyingToMsg, setReplyingToMsg] = useState(null);

  const [activeChannelType, setActiveChannelType] = useState('GROUP'); // GROUP, FACULTY, PERSONAL
  const [selectedReceiverId, setSelectedReceiverId] = useState(null); // for PERSONAL
  const [selectedProjectId, setSelectedProjectId] = useState(specificProjectId || null);

  const chatEndRef = useRef(null);

  // Fetch Group Members for Group Chat Details
  const { data: groupData } = useQuery({
    queryKey: ['myGroup'],
    queryFn: async () => {
      const res = await API.get('/groups/my-group');
      return res.data;
    },
  });

  const effectiveProjectId = selectedProjectId || specificProjectId;

  // Fetch Messages based on active channel and project
  const { data: chatData, isLoading } = useQuery({
    queryKey: ['collabChat', activeChannelType, selectedReceiverId, effectiveProjectId],
    queryFn: async () => {
      const params = new URLSearchParams({ channelType: activeChannelType });
      if (effectiveProjectId) {
        params.append('projectId', effectiveProjectId);
      }
      if (activeChannelType === 'PERSONAL' && selectedReceiverId) {
        params.append('receiverId', selectedReceiverId);
      }
      const res = await API.get(`/collaboration/chat?${params.toString()}`);
      return res.data;
    },
    refetchInterval: 3000,
    enabled: !(activeChannelType === 'PERSONAL' && !selectedReceiverId),
  });

  const currentProject = chatData?.project;
  const allProjects = chatData?.allProjects || [];
  const projectGroupMembers = chatData?.groupMembers || [];

  // Update selectedProjectId if not set yet and project is available
  useEffect(() => {
    if (!selectedProjectId && currentProject?._id) {
      setSelectedProjectId(currentProject._id);
    }
  }, [currentProject?._id, selectedProjectId]);

  // Teammates for direct messaging within the current project group
  const directTeammates =
    projectGroupMembers.length > 0
      ? projectGroupMembers.filter((m) => String(m._id) !== String(user?._id))
      : groupData?.members
          ?.filter((m) => String(m.user?._id) !== String(user?._id))
          .map((m) => ({
            _id: m.user?._id,
            name: m.user?.name,
            enrollmentNumber: m.user?.enrollmentNumber,
            role: m.role,
          })) || [];

  const selectedReceiver = directTeammates.find((m) => String(m._id) === String(selectedReceiverId));

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatData]);

  const sendMsgMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await API.post('/collaboration/chat', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['collabChat']);
      resetInput();
    },
  });

  const updateMsgMutation = useMutation({
    mutationFn: async ({ id, content }) => {
      const res = await API.put(`/collaboration/chat/${id}`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['collabChat']);
      resetInput();
    },
  });

  const deleteMsgMutation = useMutation({
    mutationFn: async (id) => {
      const res = await API.delete(`/collaboration/chat/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['collabChat']);
    },
  });

  const resetInput = () => {
    setContent('');
    setAttachmentUrl('');
    setEditingMsgId(null);
    setReplyingToMsg(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim() && !attachmentUrl) return;

    if (editingMsgId) {
      updateMsgMutation.mutate({ id: editingMsgId, content });
    } else {
      sendMsgMutation.mutate({
        content,
        attachmentUrl,
        replyToId: replyingToMsg?._id || null,
        channelType: activeChannelType,
        receiverId: selectedReceiverId,
        ...(effectiveProjectId && { projectId: effectiveProjectId }),
      });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setAttachmentUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const messages = chatData?.messages || [];

  return (
    <div className="flex h-[calc(100vh-100px)] max-h-[820px] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Sidebar - Channels & Active Project Context */}
      <div className="w-1/3 min-w-[280px] max-w-[340px] bg-slate-50/70 border-r border-slate-200 flex flex-col">
        {/* Sidebar Header with Active Project Context Card */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" /> Project Chat
            </h2>
            {currentProject?.group?.code && (
              <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                {currentProject.group.code}
              </span>
            )}
          </div>

          {/* Active Project Identification Card */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 rounded-xl shadow-xs border border-indigo-900/40">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-indigo-300 font-bold mb-1">
              <span className="flex items-center gap-1">
                <FolderGit2 className="w-3 h-3 text-indigo-400" /> Active Project
              </span>
              {currentProject?.projectKey && (
                <span className="font-mono bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-200 font-semibold">
                  {currentProject.projectKey}
                </span>
              )}
            </div>
            <div
              className="text-sm font-bold text-white truncate"
              title={currentProject?.title || 'Loading project...'}
            >
              {currentProject?.title || 'SGP Project Workspace'}
            </div>
            {currentProject?.group && (
              <div className="text-xs text-indigo-200/80 mt-1 flex items-center gap-1.5 truncate">
                <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">
                  Group: <strong>{currentProject.group.name}</strong>
                </span>
              </div>
            )}

            {/* Multiple Projects Switcher */}
            {allProjects.length > 1 && (
              <div className="mt-2.5 pt-2 border-t border-indigo-800/60">
                <label className="block text-[10px] font-medium text-indigo-300 mb-1">
                  Switch Project Chat:
                </label>
                <select
                  value={effectiveProjectId || ''}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    resetInput();
                  }}
                  className="w-full bg-indigo-900/90 border border-indigo-700/60 text-white rounded-lg text-xs py-1.5 px-2 font-medium focus:ring-1 focus:ring-indigo-400 outline-none cursor-pointer"
                >
                  {allProjects.map((p) => (
                    <option key={p._id} value={p._id} className="bg-slate-900 text-white">
                      {p.title} ({p.groupCode || p.projectKey || 'Proj'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Group Team Chat */}
          <button
            onClick={() => {
              setActiveChannelType('GROUP');
              resetInput();
            }}
            className={`w-full text-left p-3 rounded-xl border flex flex-col gap-1 transition-all cursor-pointer ${
              activeChannelType === 'GROUP'
                ? 'bg-indigo-50/90 border-indigo-300 shadow-xs ring-1 ring-indigo-500/20'
                : 'border-transparent hover:bg-white hover:border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users
                className={`w-4 h-4 ${
                  activeChannelType === 'GROUP' ? 'text-indigo-700' : 'text-slate-500'
                }`}
              />
              <span
                className={`font-bold text-sm truncate ${
                  activeChannelType === 'GROUP' ? 'text-indigo-950' : 'text-slate-700'
                }`}
              >
                {currentProject?.group?.name || 'Project Team Chat'}
              </span>
            </div>
            <span className="text-xs text-slate-500 pl-6 truncate">
              {currentProject?.title ? `Team room for ${currentProject.title}` : 'General team discussion'}
            </span>
          </button>

          {/* Faculty Chat */}
          <button
            onClick={() => {
              setActiveChannelType('FACULTY');
              setSelectedReceiverId(null);
              resetInput();
            }}
            className={`w-full text-left p-3 rounded-xl border flex flex-col gap-1 transition-all cursor-pointer ${
              activeChannelType === 'FACULTY'
                ? 'bg-purple-50/90 border-purple-300 shadow-xs ring-1 ring-purple-500/20'
                : 'border-transparent hover:bg-white hover:border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <GraduationCap
                className={`w-4 h-4 ${
                  activeChannelType === 'FACULTY' ? 'text-purple-700' : 'text-slate-500'
                }`}
              />
              <span
                className={`font-bold text-sm ${
                  activeChannelType === 'FACULTY' ? 'text-purple-950' : 'text-slate-700'
                }`}
              >
                Faculty Guidance Channel
              </span>
            </div>
            <span className="text-xs text-slate-500 pl-6 truncate">
              {currentProject?.facultyGuide?.name
                ? `Guide: ${currentProject.facultyGuide.name}`
                : 'Ask guides & mentors'}
            </span>
          </button>

          {/* Individual DMs */}
          {!facultyMode && (
            <div className="pt-3 pb-1 border-t border-slate-200/60 mt-3">
              <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Teammate Direct Messages
                </h3>
                <span className="text-[10px] font-semibold text-slate-400">
                  {directTeammates.length}
                </span>
              </div>
              {directTeammates.length > 0 ? (
                directTeammates.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => {
                      setActiveChannelType('PERSONAL');
                      setSelectedReceiverId(m._id);
                      resetInput();
                    }}
                    className={`w-full text-left p-2 rounded-xl border flex items-center justify-between gap-2 transition-all mb-1 cursor-pointer ${
                      activeChannelType === 'PERSONAL' && selectedReceiverId === m._id
                        ? 'bg-blue-50/90 border-blue-300 shadow-xs text-blue-950 ring-1 ring-blue-500/20'
                        : 'border-transparent hover:bg-white hover:border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          activeChannelType === 'PERSONAL' && selectedReceiverId === m._id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{m.name}</div>
                        {m.enrollmentNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {m.enrollmentNumber}
                          </div>
                        )}
                      </div>
                    </div>
                    {m.role === 'LEADER' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase shrink-0">
                        Leader
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-500 px-2 italic">
                  No other teammates in this project group.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/50 relative min-w-0">
        {/* Chat Header with Explicit Project & Group Indicator */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-white flex justify-between items-center shadow-xs z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shadow-xs shrink-0 ${
                activeChannelType === 'GROUP'
                  ? 'bg-indigo-100 text-indigo-700'
                  : activeChannelType === 'FACULTY'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {activeChannelType === 'GROUP' ? (
                <Users className="w-5 h-5" />
              ) : activeChannelType === 'FACULTY' ? (
                <GraduationCap className="w-5 h-5" />
              ) : (
                <MessageSquare className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                  {activeChannelType === 'GROUP'
                    ? currentProject?.group
                      ? `Team Chat • ${currentProject.group.name}`
                      : 'Project Team Chat'
                    : activeChannelType === 'FACULTY'
                    ? 'Faculty Guidance Discussion'
                    : `Direct Message: ${selectedReceiver?.name || 'Teammate'}`}
                </h3>
              </div>

              {/* Explicit Project & Group breadcrumb banner */}
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 truncate">
                <span className="font-semibold text-indigo-600 truncate flex items-center gap-1">
                  📁 Project: {currentProject?.title || 'SGP Project'}
                </span>
                {currentProject?.group?.code && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-slate-600 font-medium">
                      Group: {currentProject.group.code}
                    </span>
                  </>
                )}
                {activeChannelType === 'FACULTY' && currentProject?.facultyGuide?.name && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-purple-700 font-medium">
                      Guide: {currentProject.facultyGuide.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Badges */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {currentProject?.projectKey && (
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                {currentProject.projectKey}
              </span>
            )}
            {activeChannelType === 'GROUP' && projectGroupMembers.length > 0 && (
              <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> {projectGroupMembers.length} Members
              </span>
            )}
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <LoadingSpinner text="Loading messages..." />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-slate-400 space-y-2">
              <div className="p-4 bg-slate-100 rounded-2xl">
                <MessageSquare className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">
                No messages in this channel yet.
              </p>
              <p className="text-xs text-slate-400 max-w-sm text-center">
                Send a message below to start collaborating on{' '}
                <strong className="text-slate-600">{currentProject?.title || 'your project'}</strong>!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId?._id === user._id;

              return (
                <div
                  key={msg._id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} group relative`}
                >
                  <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender Name */}
                    {!isMine && (
                      <span className="text-xs font-bold text-slate-500 mb-1 ml-1 flex items-center gap-1.5">
                        <span>{msg.senderId?.name}</span>
                        {msg.senderId?.role === 'FACULTY' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold uppercase">
                            Faculty
                          </span>
                        )}
                      </span>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`relative px-4 py-2.5 rounded-2xl shadow-xs ${
                        isMine
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                      }`}
                    >
                      {/* Replying To Reference */}
                      {msg.replyToId && (
                        <div
                          className={`text-xs mb-2 p-2 rounded-lg border-l-2 ${
                            isMine
                              ? 'bg-indigo-700/50 border-indigo-300 text-indigo-100'
                              : 'bg-slate-50 border-indigo-400 text-slate-500'
                          }`}
                        >
                          <span className="font-bold block mb-0.5">
                            {msg.replyToId.senderId?.name || 'Someone'}
                          </span>
                          <span className="truncate block max-w-xs italic">
                            "{msg.replyToId.content}"
                          </span>
                        </div>
                      )}

                      {/* Message Content */}
                      {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}

                      {/* Attachments */}
                      {msg.attachmentUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-black/10">
                          {msg.attachmentUrl.startsWith('data:image') ? (
                            <img
                              src={msg.attachmentUrl}
                              alt="attachment"
                              className="max-w-xs max-h-48 object-cover"
                            />
                          ) : (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs underline ${
                                isMine ? 'text-white' : 'text-indigo-600'
                              }`}
                            >
                              View Attachment
                            </a>
                          )}
                        </div>
                      )}

                      {/* Timestamp & Status */}
                      <div
                        className={`text-[10px] flex items-center justify-end gap-1 mt-1 ${
                          isMine ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                      >
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {msg.isEdited && <span className="italic">(edited)</span>}
                        {isMine && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                    </div>

                    {/* Quick Actions (Hover) */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 shadow-sm border border-slate-200 rounded-lg p-1 ${
                        isMine ? '-left-24' : '-right-10'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setReplyingToMsg(msg);
                          setEditingMsgId(null);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 cursor-pointer"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      {isMine && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMsgId(msg._id);
                              setContent(msg.content);
                              setReplyingToMsg(null);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Delete message?')) deleteMsgMutation.mutate(msg._id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 p-4">
          {/* Replying / Editing Context Bar */}
          {(replyingToMsg || editingMsgId) && (
            <div className="mb-3 px-4 py-2 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-lg flex justify-between items-center">
              <div className="text-xs text-indigo-900">
                {editingMsgId ? (
                  <span className="font-bold flex items-center gap-1">
                    <Edit2 className="w-3.5 h-3.5" /> Editing Message
                  </span>
                ) : (
                  <>
                    <span className="font-bold flex items-center gap-1">
                      <Reply className="w-3.5 h-3.5" /> Replying to{' '}
                      {replyingToMsg?.senderId?.name}
                    </span>
                    <span className="block truncate text-indigo-700/80 mt-0.5 italic max-w-md">
                      "{replyingToMsg?.content}"
                    </span>
                  </>
                )}
              </div>
              <button onClick={resetInput} className="text-indigo-400 hover:text-indigo-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Attachment Preview */}
          {attachmentUrl && !editingMsgId && (
            <div className="mb-3 inline-flex items-center gap-2 p-2 pr-3 bg-slate-100 rounded-lg border border-slate-200">
              <div className="w-10 h-10 bg-white rounded flex items-center justify-center border border-slate-200">
                {attachmentUrl.startsWith('data:image') ? (
                  <ImageIcon className="w-5 h-5 text-indigo-500" />
                ) : (
                  <Paperclip className="w-5 h-5 text-indigo-500" />
                )}
              </div>
              <span className="text-xs font-bold text-slate-700">Attachment added</span>
              <button
                onClick={() => setAttachmentUrl('')}
                className="ml-2 text-rose-500 hover:bg-rose-50 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-3 relative">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-shadow">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={
                  editingMsgId
                    ? 'Edit your message...'
                    : activeChannelType === 'GROUP'
                    ? `Message team in "${currentProject?.title || 'Project'}"...`
                    : activeChannelType === 'FACULTY'
                    ? `Message Faculty Guide regarding "${currentProject?.title || 'Project'}"...`
                    : `Message ${selectedReceiver?.name || 'teammate'}...`
                }
                rows="2"
                className="w-full bg-transparent p-3 text-sm focus:outline-none resize-none max-h-32 text-slate-800 placeholder-slate-400"
              ></textarea>

              {!editingMsgId && (
                <div className="flex justify-between items-center px-2 pb-2 bg-slate-50">
                  <div className="flex items-center gap-1">
                    <label
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                      title="Attach Image/File"
                    >
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Paperclip className="w-4 h-4" />
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium px-2 hidden md:block">
                    Press Enter to send, Shift+Enter for new line
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={
                sendMsgMutation.isPending ||
                updateMsgMutation.isPending ||
                (!content.trim() && !attachmentUrl)
              }
              className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shrink-0 h-[52px] w-[52px] flex items-center justify-center mb-0.5 cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentChatPage;
