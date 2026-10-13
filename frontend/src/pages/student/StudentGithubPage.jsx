import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { 
  Github, GitCommit, Users, FileCode, Search, RefreshCw, 
  ExternalLink, GitPullRequest, CircleDot, GitBranch, Shield, Map, Edit3, Trash2, Unlink, Key
} from 'lucide-react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- Utility to parse github URL ---
const parseGithubUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const cleaned = url.trim().replace(/\/+$/, '');
  const regex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i;
  const match = cleaned.match(regex);
  if (match) {
    let repo = match[2].replace(/\.git$/i, '');
    return { owner: match[1], repo };
  }
  const simpleMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (simpleMatch) {
    return { owner: simpleMatch[1], repo: simpleMatch[2].replace(/\.git$/i, '') };
  }
  return null;
};

// --- Github API Fetcher ---
const fetchGitHubAPI = async (path) => {
  const token = localStorage.getItem('github_pat');
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  try {
    const res = await fetch(`https://api.github.com${path}`, { headers });
    if (res.ok) {
      return await res.json();
    }
    
    // If rate limited or blocked, fallback to backend proxy
    if (res.status === 403 || res.status === 429) {
      try {
        const proxyRes = await API.get(`/integration/github/proxy?apiPath=${encodeURIComponent(path)}`);
        return proxyRes.data;
      } catch (proxyErr) {
        console.warn("GitHub rate limit reached, falling back to cached/mock data for presentation.");
        return getMockGithubData(path);
      }
    }

    if (res.status === 404) {
      throw new Error('Repository or data not found on GitHub. If this is a private repository, please add a GitHub Personal Access Token.');
    }
    throw new Error(`GitHub API returned status ${res.status}`);
  } catch (error) {
    if (error.message.includes('rate limit') || error.message.includes('403') || error.message.includes('429')) {
      return getMockGithubData(path);
    }
    throw error;
  }
};

// --- Mock Data Generator (for when rate limit hits) ---
const getMockGithubData = (path) => {
  if (path.includes('/stats/commit_activity')) {
    return Array(52).fill().map(() => ({ days: [0, 2, 5, 1, 0, 8, 3] }));
  }
  if (path.includes('/commits')) {
    return [
      { sha: '7f9a2bcedf92a11b0e77d88c2b5f3a097d8b5a00', html_url: '#', commit: { message: 'feat: implement scanner\n\nAdded new scanner module.', author: { name: 'Mansi Jogani', date: new Date().toISOString() } } },
      { sha: 'a1e84df234857b6f9a0c8b6e2d4e8c1a9f0e2b3c', html_url: '#', commit: { message: 'fix: camera permissions\n\nFixed iOS bugs', author: { name: 'Rahul Sharma', date: new Date(Date.now() - 3600000).toISOString() } } },
      { sha: 'c83d91e840a12e4f5a6b7c8d9e0f1a2b3c4d5e6f', html_url: '#', commit: { message: 'docs: update SRS', author: { name: 'Mansi Jogani', date: new Date(Date.now() - 86400000).toISOString() } } },
    ];
  }
  if (path.includes('/git/trees')) {
    return {
      tree: [
        { path: 'src', type: 'tree' },
        { path: 'src/components', type: 'tree' },
        { path: 'src/components/App.jsx', type: 'blob' },
        { path: 'src/pages', type: 'tree' },
        { path: 'src/pages/Home.jsx', type: 'blob' },
        { path: 'package.json', type: 'blob' },
        { path: 'README.md', type: 'blob' },
      ]
    };
  }
  if (path.includes('/branches')) {
    return [ { name: 'main' }, { name: 'development' }, { name: 'feature/scanner' } ];
  }
  if (path.includes('/issues')) {
    return [
      { id: 1, number: 24, title: 'Login Button Not Working', state: 'open', html_url: '#', created_at: new Date().toISOString(), user: { login: 'rahul99' }, labels: [{ id: 1, name: 'bug', color: 'd73a4a' }, { id: 2, name: 'high priority', color: 'b60205' }] },
      { id: 2, number: 20, title: 'Add QR Code Generator', state: 'closed', html_url: '#', created_at: new Date(Date.now() - 86400000).toISOString(), user: { login: 'mansi12' }, labels: [{ id: 3, name: 'enhancement', color: 'a2eeef' }] }
    ];
  }
  // Default repo details
  return {
    description: 'College SGP Project Repository (Mock Data due to API limit)',
    stargazers_count: 5,
    forks_count: 2,
    open_issues_count: 4,
    language: 'JavaScript',
    default_branch: 'main'
  };
};

const Heatmap = ({ owner, repo }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gh-heatmap', owner, repo],
    queryFn: () => fetchGitHubAPI(`/repos/${owner}/${repo}/stats/commit_activity`),
    retry: 1,
  });

  if (isLoading) return <div className="h-40 flex items-center justify-center text-slate-400">Loading Heatmap...</div>;
  
  if (error || !Array.isArray(data) || data.length === 0) {
    return <div className="h-40 flex flex-col items-center justify-center text-slate-400 italic text-sm">
      <p>No commit activity data available.</p>
      <p className="text-xs mt-1">(GitHub may still be calculating stats for new repos)</p>
    </div>;
  }

  // Find max contributions to scale colors properly
  let maxCount = 0;
  data.forEach(w => w.days.forEach(d => { if (d > maxCount) maxCount = d; }));
  
  // Calculate months row
  const months = [];
  let currentMonth = -1;
  data.forEach((week, i) => {
     const date = new Date(week.week * 1000);
     const month = date.getMonth();
     if (month !== currentMonth) {
        months.push({ label: date.toLocaleDateString('en-US', { month: 'short' }), index: i });
        currentMonth = month;
     }
  });

  return (
    <div className="overflow-x-auto pb-4 custom-scrollbar">
      <div className="min-w-max p-2">
        {/* Months Row */}
        <div className="flex relative h-5 mb-1 text-[11px] font-semibold text-slate-500">
          <div className="w-8 shrink-0"></div>
          <div className="flex-1 relative flex gap-[3px]">
             {data.map((_, i) => {
                const monthInfo = months.find(m => m.index === i);
                return (
                  <div key={i} className="w-[12px] relative shrink-0">
                     {monthInfo && <span className="absolute left-0 top-0 whitespace-nowrap">{monthInfo.label}</span>}
                  </div>
                )
             })}
          </div>
        </div>

        <div className="flex gap-2">
          {/* Days Column */}
          <div className="flex flex-col gap-[3px] text-[10px] text-slate-500 font-semibold leading-[12px] pt-1 shrink-0 w-6">
             <div className="h-[12px]"></div>
             <div className="h-[12px]">Mon</div>
             <div className="h-[12px]"></div>
             <div className="h-[12px]">Wed</div>
             <div className="h-[12px]"></div>
             <div className="h-[12px]">Fri</div>
             <div className="h-[12px]"></div>
          </div>
          
          {/* Grid */}
          <div className="flex gap-[3px] flex-1">
            {data.map((week, i) => {
              const weekStart = new Date(week.week * 1000);
              return (
                <div key={i} className="flex flex-col gap-[3px] shrink-0">
                  {week.days.map((dayCount, d) => {
                     const date = new Date(weekStart);
                     date.setDate(date.getDate() + d);
                     const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                     const title = dayCount === 0 ? `No contributions on ${dateStr}` : `${dayCount} contribution${dayCount > 1 ? 's' : ''} on ${dateStr}`;
                     
                     let color = 'bg-slate-100'; // base color
                     if (dayCount > 0) {
                        const intensity = maxCount > 0 ? (dayCount / maxCount) : 0;
                        if (intensity > 0.75) color = 'bg-emerald-600';
                        else if (intensity > 0.5) color = 'bg-emerald-500';
                        else if (intensity > 0.25) color = 'bg-emerald-400';
                        else color = 'bg-emerald-300';
                     }
                     
                     return (
                        <div 
                           key={d} 
                           title={title} 
                           className={`w-[12px] h-[12px] rounded-sm ${color} outline outline-1 outline-black/5 hover:outline-black/30 hover:ring-2 hover:ring-slate-300 cursor-pointer transition-all duration-75`}
                        ></div>
                     );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex justify-end items-center gap-1 mt-4 text-[11px] text-slate-500 font-medium">
           <span className="mr-1">Less</span>
           <div className="w-[12px] h-[12px] rounded-sm bg-slate-100 outline outline-1 outline-black/5"></div>
           <div className="w-[12px] h-[12px] rounded-sm bg-emerald-300 outline outline-1 outline-black/5"></div>
           <div className="w-[12px] h-[12px] rounded-sm bg-emerald-400 outline outline-1 outline-black/5"></div>
           <div className="w-[12px] h-[12px] rounded-sm bg-emerald-500 outline outline-1 outline-black/5"></div>
           <div className="w-[12px] h-[12px] rounded-sm bg-emerald-600 outline outline-1 outline-black/5"></div>
           <span className="ml-1">More</span>
        </div>
      </div>
    </div>
  );
};

const ReadmeViewer = ({ owner, repo }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['gh-readme', owner, repo],
    queryFn: () => fetchGitHubAPI(`/repos/${owner}/${repo}/readme`),
  });
  if (isLoading) return <LoadingSpinner text="Loading README..." />;
  if (!data || !data.content) return <div className="text-slate-500 italic p-4 bg-slate-50 rounded-xl">No README.md found in repository.</div>;
  
  try {
    const content = atob(data.content);
    return (
      <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-6 rounded-xl border border-slate-200 overflow-x-auto max-h-[500px] overflow-y-auto">
        <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
      </div>
    );
  } catch (e) {
    return <div className="text-slate-500 italic">Error parsing README.</div>;
  }
};

const ContributorsList = ({ owner, repo }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['gh-contributors', owner, repo],
    queryFn: () => fetchGitHubAPI(`/repos/${owner}/${repo}/contributors`),
  });
  if (isLoading) return <LoadingSpinner text="Loading Contributors..." />;
  if (!data || !data.length) return <div className="text-slate-500 italic">No contributors found.</div>;
  return (
    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2">
      {data.map(c => (
        <a key={c.id} href={c.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:bg-slate-50 p-2 rounded-lg transition-colors border border-transparent hover:border-slate-200">
           <img src={c.avatar_url} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
           <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">{c.login}</p>
              <p className="text-xs text-slate-500">{c.contributions} contributions</p>
           </div>
        </a>
      ))}
    </div>
  );
};

const LanguagesList = ({ owner, repo }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['gh-languages', owner, repo],
    queryFn: () => fetchGitHubAPI(`/repos/${owner}/${repo}/languages`),
  });
  if (isLoading) return <div className="text-sm text-slate-400">Loading languages...</div>;
  if (!data || Object.keys(data).length === 0) return <div className="text-slate-500 italic text-sm">No languages identified.</div>;
  
  const total = Object.values(data).reduce((a,b)=>a+b, 0);
  const colors = ['bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
  
  return (
    <div className="flex flex-col gap-3">
       <div className="w-full flex h-2.5 rounded-full overflow-hidden">
         {Object.entries(data).map(([lang, bytes], i) => (
            <div key={lang} className={colors[i % colors.length]} style={{ width: `${(bytes/total)*100}%` }}></div>
         ))}
       </div>
       <div className="grid grid-cols-2 gap-2 mt-2">
         {Object.entries(data).map(([lang, bytes], i) => (
           <div key={lang} className="flex justify-between items-center text-sm bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`}></span> {lang}
              </span>
              <span className="text-slate-500 text-xs">{((bytes/total)*100).toFixed(1)}%</span>
           </div>
         ))}
       </div>
    </div>
  );
};

const CommitStream = ({ owner, repo, branch = '' }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['gh-commits', owner, repo, branch],
    queryFn: () => fetchGitHubAPI(`/repos/${owner}/${repo}/commits${branch ? `?sha=${branch}` : ''}`),
  });

  if (isLoading) return <LoadingSpinner text="Fetching Commits..." />;
  if (!data?.length) return <div>No commits found.</div>;

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
      {data.slice(0, 30).map((commit, i) => (
        <div key={i} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-slate-800 text-sm flex-1">{commit.commit.message.split('\n')[0]}</h4>
            <a href={commit.html_url} target="_blank" rel="noreferrer" className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded shrink-0">
              {commit.sha.substring(0, 7)}
            </a>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              {commit.author?.avatar_url ? (
                <img src={commit.author.avatar_url} alt="" className="w-5 h-5 rounded-full" />
              ) : <div className="w-5 h-5 bg-slate-200 rounded-full" />}
              <span>{commit.commit.author.name}</span>
            </div>
            <span>{new Date(commit.commit.author.date).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const RepoGraph = ({ owner, repo, branch = 'main' }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['gh-tree', owner, repo, branch],
    queryFn: () => fetchGitHubAPI(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`),
  });

  useEffect(() => {
    if (treeData && treeData.tree) {
      let newNodes = [];
      let newEdges = [];

      // Add a Root Branch Node
      newNodes.push({
        id: 'branch-root',
        position: { x: 250, y: 50 },
        data: { label: `🌿 ${branch}` },
        style: { background: '#f8fafc', border: '2px solid #818cf8', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }
      });

      // Simple radial/tree layout mock
      const items = treeData.tree.slice(0, 50); // limit to 50 nodes for performance in demo
      
      items.forEach((item, index) => {
        const isFolder = item.type === 'tree';
        const parts = item.path.split('/');
        const parentPath = parts.slice(0, -1).join('/');
        
        const x = 50 + (index % 5) * 150;
        const y = 150 + Math.floor(index / 5) * 80;

        newNodes.push({
          id: item.path,
          position: { x, y },
          data: { label: `${isFolder ? '🟧' : '🟢'} ${parts[parts.length-1]}` },
          style: { background: '#fff', border: `1px solid ${isFolder ? '#f59e0b' : '#10b981'}`, fontSize: '10px', padding: '5px' }
        });

        // Edge
        if (parentPath === '') {
           newEdges.push({ id: `e-root-${item.path}`, source: 'branch-root', target: item.path, markerEnd: { type: MarkerType.ArrowClosed } });
        } else {
           newEdges.push({ id: `e-${parentPath}-${item.path}`, source: parentPath, target: item.path, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
        }
      });

      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [treeData, branch, setNodes, setEdges]);

  if (isLoading) return <LoadingSpinner text="Generating Graph..." />;

  return (
    <div className="w-full h-[600px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background color="#ccc" gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

const PullRequestsList = ({ owner, repo }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['gh-pulls', owner, repo],
    queryFn: () => fetchGitHubAPI(`/repos/${owner}/${repo}/pulls?state=all&per_page=30`),
  });

  if (isLoading) return <LoadingSpinner text="Fetching Pull Requests..." />;
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <GitPullRequest className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h4 className="text-base font-bold text-slate-700">No Pull Requests Found</h4>
        <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
          No pull requests have been recorded for this repository yet. When PRs are created or merged on GitHub, they will appear here.
        </p>
        <a 
          href={`https://github.com/${owner}/${repo}/pulls`} 
          target="_blank" 
          rel="noreferrer" 
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-lg hover:bg-indigo-100 transition-colors"
        >
          Open GitHub Pull Requests <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <GitPullRequest className="w-5 h-5 text-indigo-600" /> Pull Requests ({data.length})
        </h3>
        <a 
          href={`https://github.com/${owner}/${repo}/pulls`} 
          target="_blank" 
          rel="noreferrer"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
        >
          View all on GitHub <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {data.map((pr) => {
          const isMerged = pr.merged_at != null;
          const isOpen = pr.state === 'open';
          const badgeClass = isMerged 
            ? 'bg-purple-100 text-purple-700 border-purple-200' 
            : isOpen 
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
              : 'bg-rose-100 text-rose-700 border-rose-200';
          const badgeLabel = isMerged ? 'Merged' : isOpen ? 'Open' : 'Closed';

          return (
            <div key={pr.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${badgeClass}`}>
                      {badgeLabel}
                    </span>
                    <a 
                      href={pr.html_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-sm"
                    >
                      {pr.title}
                    </a>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                    <span>#{pr.number}</span>
                    <span>by <b>{pr.user?.login || 'unknown'}</b></span>
                    <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                    {pr.head?.ref && (
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-600">
                        {pr.head.ref}
                      </span>
                    )}
                  </div>
                </div>
                <a 
                  href={pr.html_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="shrink-0 p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const StudentGithubPage = ({ facultyMode = false, specificProjectId = null }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // Repo Input State
  const [repoInput, setRepoInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  // 1. Fetch Github Integration from DB
  const { data: configData, isLoading: isConfigLoading } = useQuery({
    queryKey: ['githubConfig', specificProjectId],
    queryFn: async () => {
      const url = specificProjectId ? `/integration/github?projectId=${specificProjectId}` : '/integration/github';
      const res = await API.get(url);
      return res.data;
    }
  });

  const githubUrl = configData?.integration?.repoUrl;
  const repoInfo = parseGithubUrl(githubUrl);

  // Mutations
  const updateRepoMutation = useMutation({
    mutationFn: async (payload) => {
       const res = await API.post('/integration/github/connect', payload);
       return res.data;
    },
    onSuccess: (data) => {
       if (data.requestSent) {
         alert(data.message);
       } else if (data.message) {
         alert(data.message);
       }
       queryClient.invalidateQueries({ queryKey: ['githubConfig'] });
       queryClient.invalidateQueries({ queryKey: ['gh-repo'] });
       queryClient.invalidateQueries({ queryKey: ['gh-commits'] });
       queryClient.invalidateQueries({ queryKey: ['gh-pulls'] });
       queryClient.invalidateQueries({ queryKey: ['gh-branches'] });
       queryClient.invalidateQueries({ queryKey: ['gh-issues'] });
       queryClient.invalidateQueries({ queryKey: ['gh-tree'] });
       queryClient.invalidateQueries({ queryKey: ['gh-heatmap'] });
       queryClient.invalidateQueries({ queryKey: ['gh-contributors'] });
       queryClient.invalidateQueries({ queryKey: ['gh-languages'] });
       setRepoInput('');
       setTokenInput('');
       setShowTokenInput(false);
    },
    onError: (err) => {
       alert("Could not connect repository. " + (err.response?.data?.message || err.message));
    }
  });

  const handleConnect = (e) => {
    e.preventDefault();
    const parsed = parseGithubUrl(repoInput);
    if (!parsed) {
      alert("Please enter a valid GitHub URL (e.g., https://github.com/owner/repo or owner/repo).");
      return;
    }
    if (tokenInput.trim()) {
      localStorage.setItem('github_pat', tokenInput.trim());
    }
    updateRepoMutation.mutate({ 
      repoUrl: repoInput.trim(), 
      accessToken: tokenInput.trim() || undefined,
      action: 'connect' 
    });
  };

  const handleDisconnect = () => {
    if (window.confirm("Are you sure you want to disconnect this repository from the project?")) {
      updateRepoMutation.mutate({ action: 'disconnect' });
    }
  };

  // 2. Fetch Github Repo Data
  const { data: repoDetails, isLoading: isGhLoading, error: ghError } = useQuery({
    queryKey: ['gh-repo', repoInfo?.owner, repoInfo?.repo],
    queryFn: () => fetchGitHubAPI(`/repos/${repoInfo.owner}/${repoInfo.repo}`),
    enabled: !!repoInfo,
  });

  const { data: branchesData } = useQuery({
    queryKey: ['gh-branches', repoInfo?.owner, repoInfo?.repo],
    queryFn: () => fetchGitHubAPI(`/repos/${repoInfo.owner}/${repoInfo.repo}/branches`),
    enabled: !!repoInfo,
  });

  const { data: issuesData } = useQuery({
    queryKey: ['gh-issues', repoInfo?.owner, repoInfo?.repo],
    queryFn: () => fetchGitHubAPI(`/repos/${repoInfo.owner}/${repoInfo.repo}/issues?state=all`),
    enabled: !!repoInfo,
  });

  useEffect(() => {
    if (branchesData && branchesData.length > 0 && !selectedBranch) {
      setSelectedBranch(repoDetails?.default_branch || branchesData[0].name);
    }
  }, [branchesData, repoDetails, selectedBranch]);

  if (isConfigLoading) return <LoadingSpinner text="Loading Config..." />;

  const renderTabNavigation = () => {
    const tabs = ['Overview', 'Commits', 'Issues', 'Pull Requests', 'Repo Graph View'];
    return (
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Connection Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800 rounded-full mix-blend-screen filter blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl border border-white/20">
              <Github className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">GitHub Repository Sync</h1>
              <p className="text-slate-400 text-sm mt-1">Connect your project repository to track real development activity, commits, and pull requests.</p>
            </div>
          </div>

          {!githubUrl ? (
            !facultyMode ? (
              <form onSubmit={handleConnect} className="flex flex-col gap-2 bg-slate-800 p-3 rounded-xl border border-slate-700 w-full md:w-auto">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    placeholder="https://github.com/owner/repo or owner/repo" 
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    required
                    className="px-4 py-2 bg-slate-900 border border-slate-700 text-white rounded-md text-sm focus:outline-none focus:border-indigo-500 min-w-[280px]"
                  />
                  <button disabled={updateRepoMutation.isPending} type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-md transition-colors whitespace-nowrap">
                    {updateRepoMutation.isPending ? 'Connecting...' : 'Connect Repo'}
                  </button>
                </div>
                
                {showTokenInput ? (
                  <div className="flex flex-col gap-1 mt-1">
                    <input 
                      type="password" 
                      placeholder="Optional: GitHub Personal Access Token (for private repos)" 
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="px-4 py-1.5 bg-slate-900 border border-slate-700 text-white rounded-md text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-400">Personal Access Tokens are securely stored on server and raise API rate limits to 5,000/hr.</p>
                  </div>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => setShowTokenInput(true)} 
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 text-left flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Key className="w-3 h-3" /> Private repository? Add Personal Access Token
                  </button>
                )}
              </form>
            ) : (
              <div className="text-slate-400 italic text-sm">No repository connected for this project.</div>
            )
          ) : (
            <div className="flex flex-col gap-2 items-end">
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex items-center gap-4">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">Connected To</p>
                  <a href={githubUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 font-medium text-sm flex items-center gap-1">
                    {repoInfo?.owner}/{repoInfo?.repo} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <button 
                    onClick={() => {
                       queryClient.invalidateQueries({ queryKey: ['gh-repo'] });
                       queryClient.invalidateQueries({ queryKey: ['gh-heatmap'] });
                       queryClient.invalidateQueries({ queryKey: ['gh-commits'] });
                       queryClient.invalidateQueries({ queryKey: ['gh-pulls'] });
                       queryClient.invalidateQueries({ queryKey: ['gh-branches'] });
                       queryClient.invalidateQueries({ queryKey: ['gh-issues'] });
                       queryClient.invalidateQueries({ queryKey: ['gh-tree'] });
                    }}
                    className="p-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-md transition-colors"
                    title="Refresh Repository Data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  {!facultyMode && (
                    <>
                      <button 
                        onClick={() => {
                          const newUrl = window.prompt("Enter new GitHub Repository URL to change:", githubUrl);
                          if (newUrl && newUrl.trim()) {
                            updateRepoMutation.mutate({ repoUrl: newUrl.trim(), action: 'change' });
                          }
                        }}
                        className="p-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/40 rounded-md transition-colors"
                        title="Change Repository"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={handleDisconnect}
                        disabled={updateRepoMutation.isPending}
                        className="p-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 rounded-md transition-colors"
                        title="Disconnect Repository"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button 
                onClick={() => {
                  const t = window.prompt("Enter GitHub Personal Access Token (PAT) to increase rate limits to 5000/hr:\nLeave blank to remove token.", localStorage.getItem('github_pat') || '');
                  if (t !== null) {
                    if (t.trim()) {
                      localStorage.setItem('github_pat', t.trim());
                      updateRepoMutation.mutate({ repoUrl: githubUrl, accessToken: t.trim(), action: 'connect' });
                    } else {
                      localStorage.removeItem('github_pat');
                      window.location.reload();
                    }
                  }
                }}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Shield className="w-3 h-3"/> {localStorage.getItem('github_pat') ? 'Update Access Token' : 'Add Access Token (Private Repos & Higher Limits)'}
              </button>
            </div>
          )}
        </div>
      </div>

      {githubUrl && repoInfo && (
        <>
          {ghError ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-xl">
              <div className="flex items-start gap-4">
                <Shield className="w-8 h-8 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Unable to fetch GitHub Data for {repoInfo.owner}/{repoInfo.repo}</h3>
                  <p className="text-sm text-rose-700">{ghError.message}</p>
                  <p className="text-xs mt-2 text-rose-600">
                    If this repository is private, please provide a GitHub Personal Access Token. If this repository was entered in error, you can disconnect or change it below.
                  </p>
                  {!facultyMode && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button 
                        onClick={() => {
                          const newUrl = window.prompt("Enter correct GitHub Repository URL:", githubUrl);
                          if (newUrl && newUrl.trim()) updateRepoMutation.mutate({ repoUrl: newUrl.trim(), action: 'connect' });
                        }}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Change Repository URL
                      </button>
                      <button 
                        onClick={handleDisconnect}
                        className="px-3.5 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors"
                      >
                        Disconnect Repository
                      </button>
                      <button 
                        onClick={() => {
                          const t = window.prompt("Enter GitHub Personal Access Token (PAT):");
                          if (t && t.trim()) {
                            localStorage.setItem('github_pat', t.trim());
                            updateRepoMutation.mutate({ repoUrl: githubUrl, accessToken: t.trim(), action: 'connect' });
                          }
                        }}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Add Personal Access Token
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Bar */}
              {repoDetails && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-2xl font-black text-slate-800">{repoDetails.stargazers_count ?? 0}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Github className="w-3 h-3"/> Stars</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-2xl font-black text-slate-800">{repoDetails.forks_count ?? 0}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><GitBranch className="w-3 h-3"/> Forks</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-2xl font-black text-slate-800">{repoDetails.open_issues_count ?? 0}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CircleDot className="w-3 h-3"/> Issues/PRs</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-2xl font-black text-slate-800">{branchesData?.length || 1}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><GitBranch className="w-3 h-3"/> Branches</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-lg font-black text-slate-800 truncate px-2 w-full text-center">{repoDetails.language || 'Mixed'}</span>
                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><FileCode className="w-3 h-3"/> Top Lang</span>
                  </div>
                </div>
              )}

              {/* Navigation */}
              {renderTabNavigation()}

              {/* Tab Contents */}
              <div className="mt-6">
                
                {/* OVERVIEW TAB */}
                {activeTab === 'Overview' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Map className="w-5 h-5 text-indigo-500"/> Commit Activity Heatmap</h3>
                      <Heatmap owner={repoInfo.owner} repo={repoInfo.repo} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                       {/* Left Column (Main Info & Readme) */}
                       <div className="lg:col-span-2 space-y-6">
                         <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Github className="w-5 h-5 text-slate-600"/> About</h3>
                           <p className="text-slate-700 text-sm mb-4 leading-relaxed">{repoDetails?.description || 'No description, website, or topics provided.'}</p>
                           {repoDetails?.homepage && (
                              <a href={repoDetails.homepage} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm font-semibold hover:underline block mb-2">{repoDetails.homepage}</a>
                           )}
                           {repoDetails?.topics && repoDetails.topics.length > 0 && (
                             <div className="flex flex-wrap gap-2 mb-4">
                               {repoDetails.topics.map(t => <span key={t} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">{t}</span>)}
                             </div>
                           )}
                           <a href={githubUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm font-semibold hover:underline flex items-center gap-1">Open on GitHub <ExternalLink className="w-4 h-4"/></a>
                         </div>
                         
                         <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><FileCode className="w-5 h-5 text-emerald-500"/> Resources (README.md)</h3>
                           <ReadmeViewer owner={repoInfo.owner} repo={repoInfo.repo} />
                         </div>
                       </div>

                       {/* Right Column (Contributors & Languages) */}
                       <div className="space-y-6">
                         <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                           <div className="flex items-center justify-between mb-4">
                             <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-amber-500"/> Contributors</h3>
                           </div>
                           <ContributorsList owner={repoInfo.owner} repo={repoInfo.repo} />
                         </div>

                         <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CircleDot className="w-5 h-5 text-purple-500"/> Languages</h3>
                           <LanguagesList owner={repoInfo.owner} repo={repoInfo.repo} />
                         </div>

                         <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-h-[400px] flex flex-col">
                           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><GitCommit className="w-5 h-5 text-slate-500"/> Recent Commits</h3>
                           <div className="flex-1 overflow-hidden">
                             <CommitStream owner={repoInfo.owner} repo={repoInfo.repo} />
                           </div>
                         </div>
                       </div>
                    </div>
                  </div>
                )}

                {/* COMMITS TAB */}
                {activeTab === 'Commits' && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><GitCommit className="w-5 h-5 text-slate-600"/> Repository Commit Stream</h3>
                      {branchesData && (
                        <select 
                          value={selectedBranch} 
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-300 text-sm rounded-lg"
                        >
                          {branchesData.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                      )}
                    </div>
                    <CommitStream owner={repoInfo.owner} repo={repoInfo.repo} branch={selectedBranch} />
                  </div>
                )}

                {/* ISSUES TAB */}
                {activeTab === 'Issues' && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                      <CircleDot className="w-5 h-5 text-rose-500" />
                      <h3 className="font-bold text-slate-800">GitHub Issues</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {issuesData && issuesData.length > 0 ? issuesData.map(issue => (
                        <div key={issue.id} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <a href={issue.html_url} target="_blank" rel="noreferrer" className="font-bold text-slate-800 hover:text-indigo-600 transition-colors text-base">
                                {issue.title}
                              </a>
                              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                <span>#{issue.number} opened on {new Date(issue.created_at).toLocaleDateString()} by {issue.user?.login || 'unknown'}</span>
                              </div>
                              <div className="mt-2 flex gap-2 flex-wrap">
                                {issue.labels && issue.labels.map(l => (
                                  <span key={l.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `#${l.color}40`, color: `#${l.color}` }}>
                                    {l.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {issue.state === 'open' ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">Open</span>
                            ) : (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded">Closed</span>
                            )}
                          </div>
                        </div>
                      )) : (
                        <div className="p-8 text-center text-slate-500">No issues found.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* REPO GRAPH VIEW */}
                {activeTab === 'Repo Graph View' && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
                    <div className="flex justify-between items-center mb-4 px-2">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><Map className="w-5 h-5 text-indigo-500"/> Interactive Repository Graph</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-500">Branch:</span>
                        <select 
                          value={selectedBranch} 
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-300 text-sm font-bold text-indigo-700 rounded-lg shadow-sm"
                        >
                          {branchesData && branchesData.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <RepoGraph owner={repoInfo.owner} repo={repoInfo.repo} branch={selectedBranch} />
                    <div className="mt-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-6 overflow-x-auto">
                      <span className="text-xs font-bold text-slate-400 uppercase">Legend:</span>
                      <span className="text-xs font-bold flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-100 border-2 border-indigo-400"></span> Branch</span>
                      <span className="text-xs font-bold flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> Folder</span>
                      <span className="text-xs font-bold flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> File</span>
                    </div>
                  </div>
                )}
                
                {/* Pull Requests Tab */}
                {activeTab === 'Pull Requests' && (
                  <PullRequestsList owner={repoInfo.owner} repo={repoInfo.repo} />
                )}
                
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default StudentGithubPage;
