import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import FacultyProfile from '../models/FacultyProfile.js';
import Department from '../models/Department.js';
import { loginSchema } from '../validators/authValidator.js';
import { logAuditEvent } from '../utils/auditLogger.js';

// Helper to check if an email is a valid college/institutional email
export const isCollegeEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return false;

  const domain = trimmed.split('@')[1];
  if (!domain) return false;

  // Disallow commercial/personal email providers
  const nonCollegeProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com'
  ];
  if (nonCollegeProviders.includes(domain)) {
    return false;
  }

  // Institutional domain patterns: .edu, .edu.in, .ac.in, .ac.uk, teamsync.edu, charusat, college, univ
  const isEduDomain = domain.endsWith('.edu') || 
                      domain.endsWith('.edu.in') || 
                      domain.endsWith('.ac.in') || 
                      domain.endsWith('.ac.uk') || 
                      domain.endsWith('.org.in') ||
                      domain.includes('.edu.') ||
                      domain.includes('charusat') ||
                      domain.includes('teamsync.edu') ||
                      domain.includes('college') ||
                      domain.includes('univ');

  return isEduDomain;
};

// Helper to sign JWT token
const generateToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is missing.');
  }
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      name: user.name,
      enrollmentNumber: user.enrollmentNumber || null,
    },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { loginId, password } = validatedData;

    const trimmedIdentifier = loginId.trim();

    // Query by enrollmentNumber OR email
    const user = await User.findOne({
      $or: [
        { enrollmentNumber: trimmedIdentifier.toUpperCase() },
        { email: trimmedIdentifier.toLowerCase() },
      ],
    }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid enrollment number/email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid enrollment number/email or password.',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate JWT
    const token = generateToken(user);

    // Load associated profile
    let profile = null;
    if (user.role === 'STUDENT') {
      profile = await StudentProfile.findOne({ userId: user._id }).populate('departmentId', 'name code');
    } else if (user.role === 'FACULTY' || user.role === 'COORDINATOR') {
      profile = await FacultyProfile.findOne({ userId: user._id }).populate('departmentId', 'name code');
      if (!profile && user.role === 'FACULTY') {
        profile = await FacultyProfile.create({
          userId: user._id,
          isProfileComplete: false,
        });
      }
    }

    // Audit log
    await logAuditEvent({
      actor: user,
      action: 'USER_LOGIN',
      targetEntity: 'User',
      targetId: user._id,
      details: { role: user.role },
      req,
    });

    const userObj = user.toJSON();
    const isProfileComplete = user.role === 'FACULTY' ? Boolean(profile?.isProfileComplete) : true;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        ...userObj,
        isProfileComplete,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    First-time User Registration
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      collegeId, // Enrollment Number or Faculty ID
      role = 'STUDENT',
      departmentId,
      semester = 5,
    } = req.body;

    if (!firstName?.trim()) {
      return res.status(400).json({ success: false, message: 'First name is required.' });
    }
    if (!lastName?.trim()) {
      return res.status(400).json({ success: false, message: 'Last name is required.' });
    }
    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: 'College email ID is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }
    if (!collegeId?.trim()) {
      return res.status(400).json({ success: false, message: 'College ID / Enrollment Number is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCollegeId = collegeId.trim().toUpperCase();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    // Verify college email domain
    if (!isCollegeEmail(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college email domain. Please use your official institutional email (e.g. @charusat.edu.in, @college.edu, @teamsync.edu). Personal emails (like @gmail.com) are not accepted.'
      });
    }

    // Check if email already registered
    const existingEmail = await User.findOne({ email: trimmedEmail });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: `An account with college email '${trimmedEmail}' already exists. Please sign in instead.`
      });
    }

    // Check if collegeId/enrollmentNumber already registered
    const existingCollegeId = await User.findOne({ enrollmentNumber: trimmedCollegeId });
    if (existingCollegeId) {
      return res.status(400).json({
        success: false,
        message: `An account with College ID '${trimmedCollegeId}' already exists. Please sign in instead.`
      });
    }

    // Create User
    const assignedRole = ['STUDENT', 'FACULTY'].includes(role) ? role : 'STUDENT';
    const newUser = await User.create({
      name: fullName,
      email: trimmedEmail,
      enrollmentNumber: trimmedCollegeId,
      passwordHash: password,
      role: assignedRole,
      isActive: true,
      isProfileComplete: true,
      lastLogin: new Date(),
    });

    // Create corresponding profile
    let profile = null;
    let validDeptId = departmentId || null;
    if (!validDeptId) {
      const defaultDept = await Department.findOne({ isActive: true });
      if (defaultDept) validDeptId = defaultDept._id;
    }

    if (newUser.role === 'STUDENT') {
      profile = await StudentProfile.create({
        userId: newUser._id,
        enrollmentNumber: newUser.enrollmentNumber,
        departmentId: validDeptId,
        semester: Number(semester) || 5,
      });
    } else if (newUser.role === 'FACULTY') {
      profile = await FacultyProfile.create({
        userId: newUser._id,
        departmentId: validDeptId,
        designation: 'Assistant Professor',
        isProfileComplete: true,
      });
    }

    // Audit log
    await logAuditEvent({
      actor: newUser,
      action: 'USER_REGISTERED',
      targetEntity: 'User',
      targetId: newUser._id,
      details: { role: newUser.role, collegeId: trimmedCollegeId },
      req,
    });

    // Generate JWT token
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to TeamSync.',
      token,
      user: {
        ...newUser.toJSON(),
        isProfileComplete: true,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Direct Access with Google Sign-In (College Email Only)
 * @route   POST /api/auth/google
 * @access  Public
 */
export const googleAuth = async (req, res, next) => {
  try {
    const {
      email,
      name,
      collegeId,
      departmentId,
      role = 'STUDENT',
    } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: 'Google account email is required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Verify college email domain requirement
    if (!isCollegeEmail(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Google Sign-In restricted: Only official college email addresses (e.g. @charusat.edu.in, @college.edu, @teamsync.edu) are authorized for access. Personal emails (like @gmail.com) are not allowed.'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email: trimmedEmail }).select('+passwordHash');

    if (user) {
      // Returning user: Log in directly!
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact an administrator.',
        });
      }

      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      const token = generateToken(user);

      let profile = null;
      if (user.role === 'STUDENT') {
        profile = await StudentProfile.findOne({ userId: user._id }).populate('departmentId', 'name code');
      } else if (user.role === 'FACULTY' || user.role === 'COORDINATOR') {
        profile = await FacultyProfile.findOne({ userId: user._id }).populate('departmentId', 'name code');
      }

      await logAuditEvent({
        actor: user,
        action: 'USER_LOGIN_GOOGLE',
        targetEntity: 'User',
        targetId: user._id,
        details: { role: user.role },
        req,
      });

      return res.status(200).json({
        success: true,
        message: 'Google sign-in successful!',
        token,
        user: {
          ...user.toJSON(),
          isProfileComplete: true,
          profile,
        },
      });
    }

    // User does not exist yet: First time Google user!
    // Check if collegeId is provided
    if (!collegeId?.trim()) {
      return res.status(200).json({
        success: true,
        requiresSetup: true,
        email: trimmedEmail,
        name: name || '',
        message: 'Please provide your College ID / Enrollment Number to complete your first-time registration.'
      });
    }

    const trimmedCollegeId = collegeId.trim().toUpperCase();

    // Check if collegeId already taken
    const existingCollegeId = await User.findOne({ enrollmentNumber: trimmedCollegeId });
    if (existingCollegeId) {
      return res.status(400).json({
        success: false,
        message: `College ID '${trimmedCollegeId}' is already associated with an existing account.`
      });
    }

    // Auto-generate strong secure password for OAuth account
    const randomPassword = crypto.randomBytes(16).toString('hex') + 'A1!';

    let validDeptId = departmentId || null;
    if (!validDeptId) {
      const defaultDept = await Department.findOne({ isActive: true });
      if (defaultDept) validDeptId = defaultDept._id;
    }

    const assignedRole = ['STUDENT', 'FACULTY'].includes(role) ? role : 'STUDENT';
    const newUser = await User.create({
      name: name?.trim() || trimmedEmail.split('@')[0],
      email: trimmedEmail,
      enrollmentNumber: trimmedCollegeId,
      passwordHash: randomPassword,
      role: assignedRole,
      isActive: true,
      isProfileComplete: true,
      lastLogin: new Date(),
    });

    let profile = null;
    if (newUser.role === 'STUDENT') {
      profile = await StudentProfile.create({
        userId: newUser._id,
        enrollmentNumber: newUser.enrollmentNumber,
        departmentId: validDeptId,
        semester: 5,
      });
    } else if (newUser.role === 'FACULTY') {
      profile = await FacultyProfile.create({
        userId: newUser._id,
        departmentId: validDeptId,
        designation: 'Assistant Professor',
        isProfileComplete: true,
      });
    }

    await logAuditEvent({
      actor: newUser,
      action: 'USER_REGISTERED_GOOGLE',
      targetEntity: 'User',
      targetId: newUser._id,
      details: { role: newUser.role, collegeId: trimmedCollegeId },
      req,
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created and verified via Google! Welcome to TeamSync.',
      token,
      user: {
        ...newUser.toJSON(),
        isProfileComplete: true,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get public list of active departments for registration
 * @route   GET /api/auth/departments
 * @access  Public
 */
export const getPublicDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find({ isActive: true })
      .select('name code description')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      departments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently logged-in user profile
 * @route   GET /api/auth/me
 * @access  Protected
 */
export const getMe = async (req, res, next) => {
  try {
    const user = req.user;

    let profile = null;
    if (user.role === 'STUDENT') {
      profile = await StudentProfile.findOne({ userId: user._id }).populate('departmentId', 'name code');
    } else if (user.role === 'FACULTY' || user.role === 'COORDINATOR') {
      profile = await FacultyProfile.findOne({ userId: user._id }).populate('departmentId', 'name code');
      if (!profile && user.role === 'FACULTY') {
        profile = await FacultyProfile.create({
          userId: user._id,
          isProfileComplete: false,
        });
      }
    }

    const userObj = user.toJSON();
    const isProfileComplete = user.role === 'FACULTY' ? Boolean(profile?.isProfileComplete) : true;

    return res.status(200).json({
      success: true,
      user: {
        ...userObj,
        isProfileComplete,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Protected
 */
export const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await logAuditEvent({
        actor: req.user,
        action: 'USER_LOGOUT',
        targetEntity: 'User',
        targetId: req.user._id,
        req,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

