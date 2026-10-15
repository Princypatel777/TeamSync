import Review from '../models/Review.js';
import ReviewMark from '../models/ReviewMark.js';
import Notification from '../models/Notification.js';
import ProjectGroup from '../models/ProjectGroup.js';
import GroupMember from '../models/GroupMember.js';
import Project from '../models/Project.js';

// Helper notification function
const notifyReviewSchedule = async (review) => {
  try {
    const groupIds = review.assignedGroups || [];
    if (groupIds.length === 0) return;

    const members = await GroupMember.find({ groupId: { $in: groupIds }, status: 'ACCEPTED' });
    const formattedDate = review.reviewDate ? new Date(review.reviewDate).toLocaleDateString() : 'Scheduled Date';

    for (const m of members) {
      await Notification.create({
        userId: m.userId,
        title: 'Review Schedule Published',
        message: `${review.title} has been scheduled for ${formattedDate} (${review.startTime || '10:00 AM'} - ${review.endTime || '04:00 PM'}).`,
        type: 'REVIEW',
        linkUrl: '/student/reviews',
      });
    }

    // Also notify assigned faculty guides
    const groups = await ProjectGroup.find({ _id: { $in: groupIds } });
    const guideIds = groups.map((g) => g.guideId).filter(Boolean);
    for (const gId of guideIds) {
      await Notification.create({
        userId: gId,
        title: 'Review Schedule Published',
        message: `${review.title} has been scheduled for ${formattedDate}. Check assigned student groups.`,
        type: 'REVIEW',
        linkUrl: '/faculty/reviews',
      });
    }
  } catch (err) {
    console.warn('[Review Notification Error]:', err.message);
  }
};

export const createReview = async (req, res, next) => {
  try {
    const { title, type, description, department, reviewDate, startTime, endTime, maxMarks, assignedGroups, facultyReviewers, status, marksVisibility, attachmentUrl } = req.body;

    let groupsToAssign = assignedGroups || [];
    if (status === 'PUBLISHED' && groupsToAssign.length === 0) {
      groupsToAssign = await ProjectGroup.find({ status: 'ACTIVE' }).distinct('_id');
      if (groupsToAssign.length === 0) {
        groupsToAssign = await ProjectGroup.find().distinct('_id');
      }
    }

    const review = await Review.create({
      title,
      type,
      description,
      department,
      reviewDate,
      startTime,
      endTime,
      maxMarks,
      attachmentUrl,
      status: status || 'DRAFT',
      marksVisibility: marksVisibility || 'HIDDEN',
      assignedGroups: groupsToAssign,
      facultyReviewers: facultyReviewers || []
    });

    if (status === 'PUBLISHED') {
      await notifyReviewSchedule(review);
    }

    res.status(201).json({ success: true, review });
  } catch (error) {
    next(error);
  }
};

export const getAllReviews = async (req, res, next) => {
  try {
    // Coordinator can see all reviews
    const filter = {};
    if (req.user.role === 'COORDINATOR') {
       // Might filter by department if coordinator is department specific, but assuming global for now
       if (req.user.department) filter.department = req.user.department;
    }
    
    const reviews = await Review.find(filter)
       .populate('assignedGroups', 'name code status')
       .populate('facultyReviewers', 'name email')
       .sort({ reviewDate: 1 });
       
    res.status(200).json({ success: true, reviews });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };

    const existingReview = await Review.findById(id);
    if (!existingReview) return res.status(404).json({ success: false, message: 'Review not found' });

    if (updateData.status === 'PUBLISHED' && (!updateData.assignedGroups || updateData.assignedGroups.length === 0)) {
      if (!existingReview.assignedGroups || existingReview.assignedGroups.length === 0) {
        let activeGroups = await ProjectGroup.find({ status: 'ACTIVE' }).distinct('_id');
        if (activeGroups.length === 0) {
          activeGroups = await ProjectGroup.find().distinct('_id');
        }
        updateData.assignedGroups = activeGroups;
      }
    }

    const review = await Review.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

    if (updateData.status === 'PUBLISHED' && existingReview.status !== 'PUBLISHED') {
      await notifyReviewSchedule(review);
    }

    res.status(200).json({ success: true, review });
  } catch (error) {
    next(error);
  }
};

export const publishReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    let activeGroups = review.assignedGroups || [];
    if (activeGroups.length === 0) {
      activeGroups = await ProjectGroup.find({ status: 'ACTIVE' }).distinct('_id');
      if (activeGroups.length === 0) {
        activeGroups = await ProjectGroup.find().distinct('_id');
      }
      review.assignedGroups = activeGroups;
    }

    review.status = 'PUBLISHED';
    await review.save();

    await notifyReviewSchedule(review);

    res.status(200).json({ success: true, message: 'Review published and scheduled successfully!', review });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Review.findByIdAndDelete(id);
    await ReviewMark.deleteMany({ reviewId: id });
    res.status(200).json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ================= FACULTY: CONDUCT REVIEWS =================

export const getAssignedReviews = async (req, res, next) => {
  try {
    // 1. Fetch all reviews created by Coordinator
    const reviews = await Review.find().sort({ reviewDate: 1 }).lean();

    // 2. Fetch groups using SAME logic as Faculty Dashboard
    const legacyProjects = await Project.find({ facultyGuideId: req.user._id }).lean();
    const legacyGroupIds = legacyProjects.map(p => p.groupId).filter(Boolean);

    let userGroups = await ProjectGroup.find({
      $or: [
        { guideId: req.user._id },
        { coGuideId: req.user._id },
        { _id: { $in: legacyGroupIds } }
      ]
    }).populate('leaderId', 'name enrollmentNumber email');

    const groupIds = userGroups.map(g => g._id);

    // 3. Fetch student members
    const groupMemberships = await GroupMember.find({
      groupId: { $in: groupIds }
    }).populate('userId', 'name enrollmentNumber email');

    const groupMembersMap = {};
    groupMemberships.forEach(gm => {
      if (gm.groupId && gm.userId) {
        const gIdStr = gm.groupId.toString();
        if (!groupMembersMap[gIdStr]) groupMembersMap[gIdStr] = [];
        if (!groupMembersMap[gIdStr].some(m => m._id.toString() === gm.userId._id.toString())) {
          groupMembersMap[gIdStr].push({
            _id: gm.userId._id,
            name: gm.userId.name,
            enrollmentNumber: gm.userId.enrollmentNumber || '',
            role: gm.role || 'MEMBER'
          });
        }
      }
    });

    // 4. Fetch existing review marks for all reviews & groups of this faculty
    const reviewIds = reviews.map(r => r._id);
    const existingMarks = await ReviewMark.find({
      reviewId: { $in: reviewIds },
      groupId: { $in: groupIds }
    }).lean();

    const marksLookup = {};
    for (const m of existingMarks) {
      const key = `${m.reviewId.toString()}_${m.groupId.toString()}`;
      if (!marksLookup[key]) marksLookup[key] = [];
      marksLookup[key].push(m);
    }

    const enrichedGroups = userGroups.map(g => {
      const gIdStr = g._id.toString();
      let members = groupMembersMap[gIdStr] || [];
      
      if (g.leaderId && !members.some(m => m._id.toString() === g.leaderId._id.toString())) {
        members.unshift({
          _id: g.leaderId._id,
          name: g.leaderId.name,
          enrollmentNumber: g.leaderId.enrollmentNumber || '',
          role: 'LEADER'
        });
      }

      return {
        _id: g._id,
        id: g._id,
        name: g.name,
        code: g.code,
        title: g.name,
        leaderId: g.leaderId,
        members: members
      };
    });

    // 5. Map reviews with groups including evaluation indicators
    const resultReviews = reviews.map(r => {
      const rIdStr = r._id.toString();
      const groupsWithEvalStatus = enrichedGroups.map(g => {
        const key = `${rIdStr}_${g._id.toString()}`;
        const groupMarks = marksLookup[key] || [];
        const evaluatedCount = groupMarks.length;
        const totalMembers = g.members.length;
        const isEvaluated = evaluatedCount > 0;
        const averageMarks = evaluatedCount > 0
          ? Math.round((groupMarks.reduce((sum, item) => sum + (item.marks || 0), 0) / evaluatedCount) * 10) / 10
          : null;
        const status = groupMarks.some(item => item.status === 'SUBMITTED') ? 'SUBMITTED' : (evaluatedCount > 0 ? 'DRAFT' : 'PENDING');

        return {
          ...g,
          isEvaluated,
          evaluatedCount,
          totalMembers,
          averageMarks,
          evaluationStatus: status,
          savedMarks: groupMarks
        };
      });

      const totalEvaluatedGroups = groupsWithEvalStatus.filter(g => g.isEvaluated).length;

      return {
        ...r,
        assignedGroups: groupsWithEvalStatus,
        totalAssignedGroups: groupsWithEvalStatus.length,
        evaluatedGroupsCount: totalEvaluatedGroups
      };
    });

    res.status(200).json({ success: true, reviews: resultReviews });
  } catch (error) {
    next(error);
  }
};

export const submitReviewMarks = async (req, res, next) => {
  try {
    const { id } = req.params; // review ID
    const { groupId, studentMarks, isDraft } = req.body; 
    // studentMarks: [{ studentId, marks, feedback }]

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    // Faculty can submit marks if they have assigned groups
    const marksPromises = studentMarks.map(async (sm) => {
      // Validate max marks
      if (sm.marks > review.maxMarks || sm.marks < 0) {
         throw new Error(`Marks for student ${sm.studentId} exceed maximum allowed (${review.maxMarks}) or are invalid.`);
      }

      return ReviewMark.findOneAndUpdate(
        { reviewId: id, studentId: sm.studentId, facultyId: req.user._id },
        { 
          groupId,
          marks: sm.marks, 
          feedback: sm.feedback || '', 
          status: isDraft ? 'DRAFT' : 'SUBMITTED' 
        },
        { upsert: true, new: true }
      ).populate('studentId', 'name enrollmentNumber email');
    });

    const savedMarks = await Promise.all(marksPromises);

    res.status(200).json({
      success: true,
      message: isDraft ? 'Evaluation draft saved successfully' : 'Marks submitted successfully',
      marks: savedMarks
    });
  } catch (error) {
    next(error);
  }
};

export const getReviewMarksById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const filter = { reviewId: id };
    if (req.query.groupId) {
      filter.groupId = req.query.groupId;
    }

    const marks = await ReviewMark.find(filter)
      .populate('studentId', 'name enrollmentNumber email')
      .populate('groupId', 'name code status')
      .populate('facultyId', 'name email')
      .populate('reviewId', 'title type reviewDate maxMarks marksVisibility status')
      .sort({ createdAt: -1 });

    // Group marks by groupId for coordinator view
    const groupMap = {};
    for (const m of marks) {
      const gId = m.groupId?._id ? m.groupId._id.toString() : (m.groupId ? m.groupId.toString() : 'unassigned');
      if (!groupMap[gId]) {
        groupMap[gId] = {
          groupId: gId,
          groupName: m.groupId?.name || 'Group',
          groupCode: m.groupId?.code || 'GRP',
          faculty: m.facultyId ? { name: m.facultyId.name, email: m.facultyId.email } : null,
          status: m.status || 'SUBMITTED',
          students: [],
          totalMarks: 0,
        };
      }
      groupMap[gId].students.push({
        _id: m._id,
        studentId: m.studentId?._id || m.studentId,
        name: m.studentId?.name || 'Student',
        enrollmentNumber: m.studentId?.enrollmentNumber || '',
        email: m.studentId?.email || '',
        marks: m.marks,
        feedback: m.feedback || '',
        status: m.status || 'SUBMITTED',
        maxMarks: review.maxMarks || 20,
      });
      groupMap[gId].totalMarks += m.marks;
    }

    const groups = Object.values(groupMap).map(g => ({
      ...g,
      averageMarks: g.students.length > 0 ? Math.round((g.totalMarks / g.students.length) * 10) / 10 : 0
    }));

    res.status(200).json({
      success: true,
      totalEvaluations: marks.length,
      groups,
      rawMarks: marks,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllReviewMarks = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.reviewId) {
      filter.reviewId = req.query.reviewId;
    }
    if (req.query.groupId) {
      filter.groupId = req.query.groupId;
    }

    const marks = await ReviewMark.find(filter)
      .populate('studentId', 'name enrollmentNumber email')
      .populate('groupId', 'name code status')
      .populate('facultyId', 'name email')
      .populate('reviewId', 'title type reviewDate maxMarks marksVisibility status')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, marks });
  } catch (error) {
    next(error);
  }
};

// ================= STUDENT: VIEW MARKS =================

export const getStudentMarks = async (req, res, next) => {
  try {
    const rawMarks = await ReviewMark.find({ studentId: req.user._id })
      .populate('reviewId', 'title type reviewDate marksVisibility status maxMarks')
      .populate('facultyId', 'name email');

    const formattedMarks = rawMarks
      .filter((m) => m.reviewId)
      .map((m) => {
        const mObj = m.toObject ? m.toObject() : { ...m };
        if (m.reviewId.marksVisibility !== 'VISIBLE') {
          mObj.marks = '---';
          mObj.feedback = 'Marks and feedback will be available once published by the department coordinator.';
        }
        return mObj;
      });

    res.status(200).json({ success: true, marks: formattedMarks });
  } catch (error) {
    next(error);
  }
};

export const getReviewDetailsForStudent = async (req, res, next) => {
  try {
    let targetGroupId = req.query.groupId;
    if (!targetGroupId) {
      const membership = await GroupMember.findOne({ userId: req.user._id, status: 'ACCEPTED' });
      if (membership) targetGroupId = membership.groupId;
    }

    const query = {
      status: { $in: ['PUBLISHED', 'COMPLETED'] }
    };

    if (targetGroupId) {
      query.$or = [
        { assignedGroups: targetGroupId },
        { assignedGroups: { $size: 0 } },
        { assignedGroups: null }
      ];
    }

    const reviews = await Review.find(query).sort({ reviewDate: 1 });
    
    res.status(200).json({ success: true, reviews });
  } catch (error) {
    next(error);
  }
};
