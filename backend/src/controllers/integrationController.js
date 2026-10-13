import GithubIntegration from '../models/GithubIntegration.js';
import Release from '../models/Release.js';
import Milestone from '../models/Milestone.js';
import Task from '../models/Task.js';
import Sprint from '../models/Sprint.js';
import Project from '../models/Project.js';
import GroupMember from '../models/GroupMember.js';
import Notification from '../models/Notification.js';
import { notifyProjectMembers } from '../utils/notificationUtils.js';

import { resolveAndVerifyProjectId } from '../utils/projectAccess.js';

// ================= GITHUB INTEGRATION (FR-1201 & FR-1202) =================
export const getGithubConfig = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, integration: null });

    const integration = await GithubIntegration.findOne({ projectId });
    if (!integration || !integration.isConnected || !integration.repoUrl) {
      return res.status(200).json({ success: true, integration: null });
    }

    res.status(200).json({ success: true, integration });
  } catch (error) {
    next(error);
  }
};

export const connectGithubRepo = async (req, res, next) => {
  try {
    const user = req.user;
    const { repoUrl, action, accessToken, projectId: bodyProjectId } = req.body;
    
    let projectId;
    if (user.role === 'STUDENT') {
      projectId = await resolveAndVerifyProjectId(req);
    } else {
      projectId = bodyProjectId || (await resolveAndVerifyProjectId(req));
    }
    
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project required.' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const existingIntegration = await GithubIntegration.findOne({ projectId });

    // 1. Handle Disconnect
    if (action === 'disconnect') {
      if (existingIntegration) {
        existingIntegration.isConnected = false;
        existingIntegration.repoUrl = '';
        existingIntegration.repoName = '';
        existingIntegration.owner = '';
        existingIntegration.accessToken = '';
        existingIntegration.lastSyncedAt = null;
        await existingIntegration.save();
      }
      await Project.findByIdAndUpdate(projectId, { githubRepositoryUrl: '' });
      return res.status(200).json({ success: true, message: 'Repository disconnected successfully.' });
    }

    // 2. Validate URL input
    if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.trim()) {
      return res.status(400).json({ success: false, message: 'GitHub repository URL is required.' });
    }

    const cleaned = repoUrl.trim().replace(/\/+$/, '');
    let owner = '';
    let repoName = '';

    const ghRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i;
    const match = cleaned.match(ghRegex);

    if (match) {
      owner = match[1];
      repoName = match[2].replace(/\.git$/i, '');
    } else {
      const simpleMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
      if (simpleMatch) {
        owner = simpleMatch[1];
        repoName = simpleMatch[2].replace(/\.git$/i, '');
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid GitHub repository format. Use https://github.com/owner/repo or owner/repo'
        });
      }
    }

    const canonicalUrl = `https://github.com/${owner}/${repoName}`;

    // 3. Verify repository existence via GitHub API
    let defaultBranch = 'main';
    const effectiveToken = accessToken?.trim() || existingIntegration?.accessToken;
    const ghHeaders = {
      'User-Agent': 'TeamSync-Academic-Platform',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (effectiveToken) {
      ghHeaders['Authorization'] = `token ${effectiveToken}`;
    }

    try {
      const ghCheckRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        headers: ghHeaders,
      });

      if (ghCheckRes.status === 404) {
        return res.status(404).json({
          success: false,
          message: `Repository "${owner}/${repoName}" was not found on GitHub. If this is a private repository, please provide a GitHub Personal Access Token.`
        });
      } else if (ghCheckRes.ok) {
        const ghRepoData = await ghCheckRes.json();
        defaultBranch = ghRepoData.default_branch || 'main';
      }
    } catch (netErr) {
      console.warn('GitHub API check warning (proceeding):', netErr.message);
    }

    // 4. Check if student is requesting to change an ALREADY established active repository
    const isChangingEstablishedRepo = existingIntegration && 
      existingIntegration.isConnected && 
      existingIntegration.repoUrl && 
      existingIntegration.repoUrl !== canonicalUrl;

    if (isChangingEstablishedRepo && user.role === 'STUDENT' && project.facultyGuideId) {
      await Notification.create({
        userId: project.facultyGuideId,
        title: 'GitHub Repo Change Request',
        message: `Group ${project.projectKey || 'project'} requested to change GitHub repository from ${existingIntegration.repoUrl} to ${canonicalUrl}.`,
        type: 'WARNING',
        linkUrl: `/faculty/group/${project.groupId}`,
        actionType: 'GITHUB_REPO_CHANGE',
        actionPayload: { projectId, groupId: project.groupId, repoUrl: canonicalUrl, action: 'change' },
        actionStatus: 'PENDING'
      });

      return res.status(200).json({
        success: true,
        requestSent: true,
        message: 'Change request submitted to your faculty guide for approval.'
      });
    }

    // 5. Connect or update repository directly
    const integrationUpdate = {
      projectId,
      repoUrl: canonicalUrl,
      repoName,
      owner,
      defaultBranch,
      isConnected: true,
      lastSyncedAt: new Date(),
    };
    if (accessToken) {
      integrationUpdate.accessToken = accessToken.trim();
    }

    const integration = await GithubIntegration.findOneAndUpdate(
      { projectId },
      { $set: integrationUpdate },
      { upsert: true, new: true }
    );

    // Sync to Project model
    await Project.findByIdAndUpdate(projectId, { githubRepositoryUrl: canonicalUrl });

    // Notify project members
    try {
      await notifyProjectMembers(
        projectId,
        req.user,
        'GITHUB',
        'GitHub Repository Connected',
        `${req.user.name} connected repository ${owner}/${repoName}`
      );
    } catch (err) {
      // Non-fatal
    }

    res.status(200).json({
      success: true,
      message: `Repository ${owner}/${repoName} connected successfully!`,
      integration,
    });
  } catch (error) {
    next(error);
  }
};

export const getGithubCommits = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, commits: [] });

    const integration = await GithubIntegration.findOne({ projectId }).select('+accessToken');
    if (!integration || !integration.isConnected || !integration.repoUrl) {
      return res.status(200).json({ success: true, commits: [] });
    }

    const { owner, repoName, defaultBranch, accessToken } = integration;
    const branch = req.query.branch || defaultBranch || 'main';

    const headers = {
      'User-Agent': 'TeamSync-Academic-Platform',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (accessToken) headers['Authorization'] = `token ${accessToken}`;

    try {
      const ghRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/commits?sha=${encodeURIComponent(branch)}&per_page=30`,
        { headers }
      );

      if (ghRes.ok) {
        const ghCommits = await ghRes.json();
        const commits = ghCommits.map((c) => ({
          hash: c.sha ? c.sha.substring(0, 7) : '',
          sha: c.sha,
          author: c.commit?.author?.name || c.author?.login || 'Unknown',
          message: c.commit?.message || '',
          timestamp: c.commit?.author?.date || new Date().toISOString(),
          branch,
          url: c.html_url || `https://github.com/${owner}/${repoName}/commit/${c.sha}`,
          avatarUrl: c.author?.avatar_url || '',
        }));
        return res.status(200).json({ success: true, commits, isLive: true });
      }
    } catch (apiErr) {
      console.warn('GitHub Commits API error:', apiErr.message);
    }

    res.status(200).json({ success: true, commits: [], isLive: false });
  } catch (error) {
    next(error);
  }
};

export const getGithubPullRequests = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, pullRequests: [] });

    const integration = await GithubIntegration.findOne({ projectId }).select('+accessToken');
    if (!integration || !integration.isConnected || !integration.repoUrl) {
      return res.status(200).json({ success: true, pullRequests: [] });
    }

    const { owner, repoName, accessToken } = integration;
    const headers = {
      'User-Agent': 'TeamSync-Academic-Platform',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (accessToken) headers['Authorization'] = `token ${accessToken}`;

    try {
      const ghRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/pulls?state=all&per_page=30`,
        { headers }
      );

      if (ghRes.ok) {
        const ghPulls = await ghRes.json();
        const pullRequests = ghPulls.map((pr) => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          author: pr.user?.login || 'Unknown',
          avatarUrl: pr.user?.avatar_url || '',
          status: pr.state === 'closed' ? (pr.merged_at ? 'MERGED' : 'CLOSED') : 'OPEN',
          state: pr.state,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          mergedAt: pr.merged_at,
          url: pr.html_url,
          body: pr.body || '',
        }));
        return res.status(200).json({ success: true, pullRequests, isLive: true });
      }
    } catch (apiErr) {
      console.warn('GitHub Pulls API error:', apiErr.message);
    }

    res.status(200).json({ success: true, pullRequests: [], isLive: false });
  } catch (error) {
    next(error);
  }
};

export const getGithubProxy = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project required.' });

    const integration = await GithubIntegration.findOne({ projectId }).select('+accessToken');
    if (!integration || !integration.isConnected) {
      return res.status(400).json({ success: false, message: 'No repository connected.' });
    }

    const { apiPath } = req.query;
    if (!apiPath || typeof apiPath !== 'string') {
      return res.status(400).json({ success: false, message: 'apiPath query parameter is required.' });
    }

    const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const headers = {
      'User-Agent': 'TeamSync-Academic-Platform',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (integration.accessToken) {
      headers['Authorization'] = `token ${integration.accessToken}`;
    }

    const ghRes = await fetch(`https://api.github.com${cleanPath}`, { headers });
    const data = await ghRes.json();
    return res.status(ghRes.status).json(data);
  } catch (error) {
    next(error);
  }
};

// ================= RELEASES (FR-1203) =================
export const getReleases = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, releases: [] });

    let releases = await Release.find({ projectId }).sort({ releasedAt: -1 });

    if (releases.length === 0) {
      releases = [
        await Release.create({
          projectId,
          version: 'v1.0.0-alpha',
          title: 'Sprint 1 MVP Build - Smart Campus Gatepass',
          releaseNotes: 'Initial release featuring QR code generation, mobile scanner integration, and task tracking.',
          tag: 'v1.0.0-alpha',
          status: 'RELEASED',
        }),
      ];
    }

    res.status(200).json({ success: true, releases });
  } catch (error) {
    next(error);
  }
};

export const createRelease = async (req, res, next) => {
  try {
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(400).json({ success: false, message: 'Active project required.' });

    const { version, title, releaseNotes, tag, artifactUrl } = req.body;
    const release = await Release.create({
      projectId,
      version,
      title,
      releaseNotes,
      tag: tag || version,
      artifactUrl: artifactUrl || '',
      status: 'RELEASED',
    });

    await notifyProjectMembers(projectId, req.user, 'RELEASE', 'New Release Created', `${req.user.name} created release ${release.version}`);

    res.status(201).json({ success: true, release });
  } catch (error) {
    next(error);
  }
};

export const updateRelease = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const release = await Release.findOneAndUpdate(
      { _id: id, projectId },
      { $set: req.body },
      { new: true }
    );

    if (!release) return res.status(404).json({ success: false, message: 'Release not found or unauthorized.' });

    await notifyProjectMembers(projectId, req.user, 'RELEASE', 'Release Updated', `${req.user.name} updated release ${release.version}`);

    res.status(200).json({ success: true, release });
  } catch (error) {
    next(error);
  }
};

export const deleteRelease = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const projectId = await resolveAndVerifyProjectId(req);

    const release = await Release.findOneAndDelete({ _id: id, projectId });
    if (!release) return res.status(404).json({ success: false, message: 'Release not found or unauthorized.' });

    await notifyProjectMembers(projectId, req.user, 'RELEASE', 'Release Deleted', `${req.user.name} deleted release ${release.version}`);

    res.status(200).json({ success: true, message: 'Release deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ================= UNIFIED PROJECT CALENDAR (FR-1204) =================
export const getCalendarEvents = async (req, res, next) => {
  try {
    const projectId = await resolveAndVerifyProjectId(req);
    if (!projectId) return res.status(200).json({ success: true, events: [] });

    const milestones = await Milestone.find({ projectId });
    const tasks = await Task.find({ projectId, dueDate: { $ne: null } });
    const sprints = await Sprint.find({ projectId });

    const events = [];

    milestones.forEach((m) => {
      events.push({
        id: `milestone-${m._id}`,
        title: `[Milestone] ${m.title}`,
        date: m.deadline,
        type: 'MILESTONE',
        color: '#8b5cf6',
      });
    });

    tasks.forEach((t) => {
      events.push({
        id: `task-${t._id}`,
        title: `[Task Due] ${t.taskKey}: ${t.title}`,
        date: t.dueDate,
        type: 'TASK',
        color: '#3b82f6',
      });
    });

    sprints.forEach((s) => {
      events.push({
        id: `sprint-end-${s._id}`,
        title: `[Sprint Deadline] ${s.name}`,
        date: s.endDate,
        type: 'SPRINT',
        color: '#10b981',
      });
    });

    res.status(200).json({ success: true, events });
  } catch (error) {
    next(error);
  }
};
