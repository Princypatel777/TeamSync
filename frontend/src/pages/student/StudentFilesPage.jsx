import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Folder, Upload, Download, FileText, File, Plus, X, Trash2, Calendar, User } from 'lucide-react';

export const StudentFilesPage = ({ facultyMode = false, specificProjectId = null }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('SRS Documents');
  const [description, setDescription] = useState('');
  const [relatedToType, setRelatedToType] = useState('GENERAL');
  const [fileUrl, setFileUrl] = useState('');

  // Fetch Auth Data
  const { data: authData } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await API.get('/auth/me');
      return res.data;
    }
  });

  const myUserId = authData?.user?._id;

  const { data, isLoading } = useQuery({
    queryKey: ['collabFiles', specificProjectId],
    queryFn: async () => {
      const url = specificProjectId ? `/collaboration/files?projectId=${specificProjectId}` : '/collaboration/files';
      const res = await API.get(url);
      return res.data;
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await API.post('/collaboration/files', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['collabFiles']);
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id) => {
      const res = await API.delete(`/collaboration/files/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['collabFiles']);
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Failed to delete file');
    }
  });

  const resetForm = () => {
    setName('');
    setCategory('SRS Documents');
    setDescription('');
    setRelatedToType('GENERAL');
    setFileUrl('');
  };

  const handleDelete = (id, fileName) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      deleteFileMutation.mutate(id);
    }
  };

  const handleDownload = async (file) => {
    if (file.fileUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = file.fileUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (file.fileUrl.startsWith('/uploads/') || file.fileUrl.startsWith('http')) {
      const downloadPath = file.fileUrl.startsWith('/uploads/') ? file.fileUrl : file.fileUrl;
      const a = document.createElement('a');
      a.href = downloadPath;
      a.download = file.name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      try {
        const res = await API.get(`/collaboration/files/${file._id}/download`);
        if (res.data?.downloadUrl) {
          window.open(res.data.downloadUrl, '_blank');
        }
      } catch (err) {
        alert('Download error or unauthorized access.');
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert("File size must be less than 8MB to upload directly.");
        return;
      }
      
      if (!name) setName(file.name);

      const reader = new FileReader();
      reader.onloadend = () => setFileUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !fileUrl) {
      alert("Please provide a file name and select a file to upload.");
      return;
    }
    uploadFileMutation.mutate({ name, category, description, relatedToType, fileUrl });
  };

  if (isLoading) return <LoadingSpinner text="Loading Project Files..." />;

  const files = data?.files || [];

  const groupedFiles = files.reduce((acc, f) => {
    const cat = f.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const categories = Object.keys(groupedFiles).sort();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Folder className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Project Files</h1>
            <p className="text-sm text-slate-500 mt-1">
              Central document storage for SRS, designs, presentations, and reports.
            </p>
          </div>
        </div>

        {!facultyMode && (
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center space-x-1.5 shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
        )}
      </div>

      {/* Files Dashboard View */}
      {files.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Folder className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No Project Files</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            Upload your first project document to start building your centralized file storage.
          </p>
          {!facultyMode && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-6 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors"
            >
              Upload File
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 p-4">
                <h3 className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2 text-sm">
                  <Folder className="w-4 h-4 text-slate-400" /> {cat} ({groupedFiles[cat].length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {groupedFiles[cat].map(f => {
                  const canDelete = f.uploaderId?._id === myUserId; 

                  return (
                    <div key={f._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-lg mb-1">{f.name}</h4>
                          {f.description && <p className="text-sm text-slate-600 mb-2">{f.description}</p>}
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Uploaded by: {f.uploaderId?.name || 'Unknown'}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date: {new Date(f.createdAt).toLocaleDateString('en-GB')}</span>
                            {f.relatedToType !== 'GENERAL' && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">
                                Related To: {f.relatedToType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                        <button
                          onClick={() => handleDownload(f)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>

                        {canDelete && (
                          <button
                            onClick={() => handleDelete(f._id, f.name)}
                            disabled={deleteFileMutation.isPending}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload File Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full flex flex-col shadow-2xl border border-slate-200 max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-600" /> 
                Upload File
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <form id="upload-form" onSubmit={handleUploadSubmit} className="space-y-4">
                
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">File *</label>
                  {fileUrl ? (
                    <div className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg">
                      <span className="text-xs font-bold text-green-700 flex items-center gap-2">
                        <File className="w-4 h-4" /> File Selected
                      </span>
                      <button type="button" onClick={() => setFileUrl('')} className="text-rose-600 text-xs font-bold hover:underline">
                        Change File
                      </button>
                    </div>
                  ) : (
                    <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 hover:bg-slate-50 transition-colors text-center cursor-pointer">
                      <input 
                        type="file" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">Click or drag file to upload</p>
                      <p className="text-xs text-slate-500 mt-1">PDF, PPT, DOCX, Images (Max 8MB)</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">File Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. SRS_v2.pdf"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="SRS Documents">SRS Documents</option>
                      <option value="Design Documents">Design Documents</option>
                      <option value="Presentations">Presentations</option>
                      <option value="Progress Reports">Progress Reports</option>
                      <option value="Research Papers">Research Papers</option>
                      <option value="Technical Documents">Technical Documents</option>
                      <option value="Final Reports">Final Reports</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Related To</label>
                    <select
                      value={relatedToType}
                      onChange={(e) => setRelatedToType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="GENERAL">General Project</option>
                      <option value="FEATURE">Feature</option>
                      <option value="TASK">Task</option>
                      <option value="MILESTONE">Milestone</option>
                      <option value="BUG">Bug</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description</label>
                  <textarea
                    rows="2"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the document..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                  ></textarea>
                </div>

              </form>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end space-x-3 bg-slate-50 rounded-b-2xl shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button 
                type="submit" 
                form="upload-form"
                onClick={handleUploadSubmit}
                disabled={uploadFileMutation.isPending} 
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center space-x-2"
              >
                {uploadFileMutation.isPending ? 'Uploading...' : 'Upload File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentFilesPage;
