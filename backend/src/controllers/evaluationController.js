import EvaluationCriteria from '../models/EvaluationCriteria.js';
import ReviewSchedule from '../models/ReviewSchedule.js';
import StudentMark from '../models/StudentMark.js';
import Project from '../models/Project.js';
import GroupMember from '../models/GroupMember.js';
import ProjectGroup from '../models/ProjectGroup.js';

// Helper to calculate Letter Grade from percentage score (0-100)
const computeLetterGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'F';
};

import { resolveAndVerifyProjectId } from '../utils/projectAccess.js';

// ================= EVALUATION CRITERIA (FR-1601) =================
export const getCriteria = async (req, res, next) => {
  try {
    let criteria = await EvaluationCriteria.find().sort({ createdAt: 1 });

    if (criteria.length === 0) {
      // Seed default institutional evaluation rubrics summing to 100%
      criteria = await EvaluationCriteria.insertMany([
        { name: 'Proposal & SRS Documentation', weightagePercentage: 20, maxMarks: 100, description: 'Problem statement definition and SRS requirements spec.' },
        { name: 'System Architecture & Design', weightagePercentage: 25, maxMarks: 100, description: 'Database schema, API endpoints, and component design.' },
        { name: 'Implementation & Code Quality', weightagePercentage: 35, maxMarks: 100, description: 'Working prototype, clean code, tests, and Git commits.' },
        { name: 'Presentation & Viva Voce', weightagePercentage: 20, maxMarks: 100, description: 'Demonstration and Q&A defense before faculty panel.' },
      ]);
    }

    res.status(200).json({ success: true, criteria });
  } catch (error) {
    next(error);
  }
};

export const createCriteria = async (req, res, next) => {
  try {
    const { name, weightagePercentage, maxMarks, description } = req.body;
    const item = await EvaluationCriteria.create({
      name,
      weightagePercentage,
      maxMarks: maxMarks || 100,
      description: description || '',
    });

    res.status(201).json({ success: true, criteria: item });
  } catch (error) {
    next(error);
  }
};

export const updateCriteria = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, weightagePercentage, maxMarks, description } = req.body;

    const criteria = await EvaluationCriteria.findByIdAndUpdate(
      id,
      { name, weightagePercentage, maxMarks, description },
      { new: true }
    );

    if (!criteria) return res.status(404).json({ success: false, message: 'Criteria not found.' });

    res.status(200).json({ success: true, criteria });
  } catch (error) {
    next(error);
  }
};

export const deleteCriteria = async (req, res, next) => {
  try {
    const { id } = req.params;
    await EvaluationCriteria.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Criteria deleted.' });
  } catch (error) {
    next(error);
  }
};

// ================= REVIEW SCHEDULES (FR-1602) =================
export const getReviewSchedules = async (req, res, next) => {
  try {
    let reviews = await ReviewSchedule.find().sort({ scheduledDate: 1 });

    if (reviews.length === 0) {
      reviews = await ReviewSchedule.insertMany([
        { reviewName: 'SGP Review 1: Proposal & Topic Approval', stage: 'REVIEW_1', scheduledDate: new Date(Date.now() + 10 * 86400000), venue: 'Lab 4 / Online Zoom' },
        { reviewName: 'SGP Review 2: Mid-Term Code & Progress Review', stage: 'REVIEW_2', scheduledDate: new Date(Date.now() + 30 * 86400000), venue: 'Main Seminar Hall' },
        { reviewName: 'SGP Final Viva Presentation & Evaluation', stage: 'FINAL_VIVA', scheduledDate: new Date(Date.now() + 60 * 86400000), venue: 'Auditorium Block B' },
      ]);
    }

    res.status(200).json({ success: true, reviews });
  } catch (error) {
    next(error);
  }
};

export const createReviewSchedule = async (req, res, next) => {
  try {
    const { reviewName, stage, scheduledDate, venue, description, attachmentUrl } = req.body;
    const review = await ReviewSchedule.create({
      reviewName,
      stage,
      scheduledDate,
      venue: venue || 'Main Seminar Hall',
      description: description || '',
      attachmentUrl: attachmentUrl || '',
    });

    res.status(201).json({ success: true, review });
  } catch (error) {
    next(error);
  }
};

export const updateReviewSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewName, stage, scheduledDate, venue, description, attachmentUrl } = req.body;

    const review = await ReviewSchedule.findByIdAndUpdate(
      id,
      { reviewName, stage, scheduledDate, venue, description, attachmentUrl },
      { new: true }
    );

    if (!review) return res.status(404).json({ success: false, message: 'Review schedule not found.' });

    res.status(200).json({ success: true, review });
  } catch (error) {
    next(error);
  }
};

export const deleteReviewSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    await ReviewSchedule.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Review schedule deleted.' });
  } catch (error) {
    next(error);
  }
};

// ================= STUDENT MARKING ENGINE (FR-1603 & FR-1604) =================
export const submitStudentMarks = async (req, res, next) => {
  try {
    const evaluator = req.user;
    let { projectId, studentId, reviewStage, criteriaScores, feedback } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID is required.' });
    }

    if (!studentId) {
      // Auto-resolve leader or first member of project group if not provided
      const project = await Project.findById(projectId).populate('groupId');
      if (project && project.groupId) {
        studentId = project.groupId.leaderId;
      }
    }

    if (!studentId || !criteriaScores || criteriaScores.length === 0) {
      return res.status(400).json({ success: false, message: 'Student ID and criteria scores are required.' });
    }

    // Calculate total weighted marks
    let totalWeightedScore = 0;
    const formattedScores = criteriaScores.map((cs) => {
      const marks = Number(cs.marksObtained);
      const max = Number(cs.maxMarks || 100);
      const weight = Number(cs.weightagePercentage || 25);
      totalWeightedScore += (marks / max) * weight;

      return {
        criteriaId: cs.criteriaId,
        criteriaName: cs.criteriaName,
        weightagePercentage: weight,
        marksObtained: marks,
        maxMarks: max,
      };
    });

    const finalMarks = Math.round(totalWeightedScore * 10) / 10;
    const grade = computeLetterGrade(finalMarks);

    const markRecord = await StudentMark.findOneAndUpdate(
      { projectId, studentId, reviewStage: reviewStage || 'REVIEW_1', evaluatorId: evaluator._id },
      {
        criteriaScores: formattedScores,
        totalMarksObtained: finalMarks,
        grade,
        feedback: feedback || '',
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, markRecord });
  } catch (error) {
    next(error);
  }
};

export const getStudentMarks = async (req, res, next) => {
  try {
    const user = req.user;
    const query = {};

    if (user.role === 'STUDENT') {
      const projectId = await resolveAndVerifyProjectId(req);
      if (!projectId) return res.status(200).json({ success: true, markRecords: [] });
      query.projectId = projectId;
      query.studentId = user._id;
    } else if (user.role === 'FACULTY') {
      const userGroups = await ProjectGroup.find({ facultyId: user._id }).select('_id');
      const groupIds = userGroups.map(g => g._id);
      const projects = await Project.find({ groupId: { $in: groupIds } }).select('_id');
      const projectIds = projects.map(p => p._id);
      query.projectId = { $in: projectIds };
    } else if (req.query.projectId) {
      query.projectId = req.query.projectId;
    }

    const markRecords = await StudentMark.find(query)
      .populate('studentId', 'name enrollmentNumber email')
      .populate('evaluatorId', 'name designation email')
      .populate({
        path: 'projectId',
        select: 'title projectKey groupId',
        populate: { path: 'groupId', select: 'code name' }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, markRecords });
  } catch (error) {
    next(error);
  }
};
