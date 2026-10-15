import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { BookOpen, Plus, X, Search, FileText, Edit2, Trash2, Paperclip, Clock } from 'lucide-react';

export const StudentWikiPage = ({ facultyMode = false, specificProjectId = null }) => {
  const queryClient = useQueryClient();
  const [selectedWiki, setSelectedWiki] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [editingWikiId, setEditingWikiId] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Technical Documentation');
  const [content, setContent] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['collabWiki', specificProjectId],
    queryFn: async () => {
      const url = specificProjectId ? `/collaboration/wiki?projectId=${specificProjectId}` : '/collaboration/wiki';
      const res = await API.get(url);
      return res.data;
    },
  });

  const saveWikiMutation = useMutation({
    mutationFn: async (payload) => {
      const body = {
        ...payload,
        projectId: specificProjectId || undefined,
      };
      if (editingWikiId) {
        return (await API.put(`/collaboration/wiki/${editingWikiId}`, body)).data;
      } else {
        return (await API.post('/collaboration/wiki', body)).data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['collabWiki']);
      setIsModalOpen(false);
      resetForm();
      if (data.wikiPage) setSelectedWiki(data.wikiPage);
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Failed to save wiki page.');
    }
  });

  const deleteWikiMutation = useMutation({
    mutationFn: async (id) => {
      const url = specificProjectId ? `/collaboration/wiki/${id}?projectId=${specificProjectId}` : `/collaboration/wiki/${id}`;
      const res = await API.delete(url);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['collabWiki']);
      setSelectedWiki(null);
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Failed to delete wiki page.');
    }
  });

  const resetForm = () => {
    setTitle('');
    setCategory('Technical Documentation');
    setContent('');
    setAttachmentUrl('');
    setEditingWikiId(null);
  };

  const handleEdit = (page) => {
    setEditingWikiId(page._id);
    setTitle(page.title);
    setCategory(page.category || 'Technical Documentation');
    setContent(page.content);
    setAttachmentUrl(page.attachmentUrl || '');
    setIsModalOpen(true);
  };

  const handleDelete = (id, pageTitle) => {
    if (window.confirm(`Are you sure you want to delete Wiki Page: "${pageTitle}"?`)) {
      deleteWikiMutation.mutate(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      category,
      content,
      attachmentUrl
    };
    if (editingWikiId) payload._id = editingWikiId;
    saveWikiMutation.mutate(payload);
  };



  if (isLoading) return <LoadingSpinner text="Loading Project Wiki..." />;

  const pages = data?.wikiPages || [];

  const filteredPages = pages.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group by category
  const groupedPages = filteredPages.reduce((acc, page) => {
    const cat = page.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(page);
    return acc;
  }, {});

  const categories = Object.keys(groupedPages).sort();

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Project Wiki</h1>
            <p className="text-sm text-slate-500 mt-1">
              Project knowledge, documentation, and architecture guidelines.
            </p>
          </div>
        </div>

        {!facultyMode && (
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center space-x-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Wiki Page</span>
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start h-full">
        
        {/* Sidebar - Pages List */}
        <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-[calc(100vh-220px)]">
          <div className="p-4 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search Wiki..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {categories.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No pages found.</p>
            ) : (
              categories.map(cat => (
                <div key={cat} className="mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">{cat}</h3>
                  <div className="space-y-1">
                    {groupedPages[cat].map(page => (
                      <button
                        key={page._id}
                        onClick={() => setSelectedWiki(page)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                          selectedWiki?._id === page._id 
                            ? 'bg-indigo-50 text-indigo-700' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileText className={`w-4 h-4 shrink-0 ${selectedWiki?._id === page._id ? 'text-indigo-500' : 'text-slate-400'}`} />
                        <span className="truncate">{page.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content - View Page */}
        <div className="w-full lg:w-2/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-[calc(100vh-220px)]">
          {!selectedWiki ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <BookOpen className="w-16 h-16 text-slate-200 mb-4" />
              <h2 className="text-xl font-bold text-slate-700">Select a Wiki Page</h2>
              <p className="text-slate-500 mt-2 max-w-md">
                Choose a page from the sidebar to view its contents, or create a new page to add documentation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Toolbar */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50 rounded-t-xl">
                <div className="flex items-center space-x-4 text-xs text-slate-500">
                  <span className="flex items-center space-x-1"><FileText className="w-3.5 h-3.5" /> <span>{selectedWiki.category}</span></span>
                  <span className="flex items-center space-x-1"><Clock className="w-3.5 h-3.5" /> <span>Last updated: {new Date(selectedWiki.updatedAt).toLocaleDateString()}</span></span>
                </div>
                {!facultyMode && (
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleEdit(selectedWiki)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit Page">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(selectedWiki._id, selectedWiki.title)} disabled={deleteWikiMutation.isPending} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Delete Page">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-8 overflow-y-auto flex-1">
                <h1 className="text-3xl font-black text-slate-800 mb-6">{selectedWiki.title}</h1>
                
                <div className="prose prose-slate max-w-none">
                  {selectedWiki.content.split('\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4 text-slate-700 whitespace-pre-wrap">{paragraph}</p>
                  ))}
                </div>

                {selectedWiki.attachmentUrl && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" /> Attachments
                    </h4>
                    {selectedWiki.attachmentUrl.startsWith('data:image') ? (
                      <img src={selectedWiki.attachmentUrl} alt="Attachment" className="max-w-full h-auto rounded-lg border border-slate-200 shadow-sm" />
                    ) : (
                      <a href={selectedWiki.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-sm font-medium">
                        View Attached File
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full flex flex-col shadow-2xl border border-slate-200 max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" /> 
                {editingWikiId ? 'Edit Wiki Page' : 'Create Wiki Page'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <form id="wiki-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Page Title *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. System Architecture"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Project Overview">Project Overview</option>
                      <option value="Technical Documentation">Technical Documentation</option>
                      <option value="API Documentation">API Documentation</option>
                      <option value="Database Design">Database Design</option>
                      <option value="User Guide">User Guide</option>
                      <option value="Meeting Notes">Meeting Notes</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Content (Rich Text / Markdown) *</label>
                  <textarea
                    required
                    rows="12"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your documentation here..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                  ></textarea>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Attachment URL (Optional)</label>
                  <input
                    type="url"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="https://link-to-document-or-image.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end space-x-3 bg-slate-50 rounded-b-2xl shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button 
                type="submit" 
                form="wiki-form"
                onClick={handleSubmit}
                disabled={saveWikiMutation.isPending} 
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all"
              >
                {saveWikiMutation.isPending ? 'Saving...' : 'Save Page'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentWikiPage;
