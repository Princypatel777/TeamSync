import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';
import StudentProfile from './models/StudentProfile.js';
import FacultyProfile from './models/FacultyProfile.js';
import Department from './models/Department.js';
import AcademicYear from './models/AcademicYear.js';
import SGPCycle from './models/SGPCycle.js';
import ProjectGroup from './models/ProjectGroup.js';
import GroupMember from './models/GroupMember.js';
import Project from './models/Project.js';
import Task from './models/Task.js';
import Bug from './models/Bug.js';
import Milestone from './models/Milestone.js';
import WikiPage from './models/WikiPage.js';
import Feature from './models/Feature.js';
import Review from './models/Review.js';
import ReviewMark from './models/ReviewMark.js';
import StudentMark from './models/StudentMark.js';
import ProposalFeedback from './models/ProposalFeedback.js';
import Notification from './models/Notification.js';
import AuditLog from './models/AuditLog.js';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();
    console.log('[Seed]: Cleaning existing Collections...');

    await User.deleteMany({});
    await StudentProfile.deleteMany({});
    await FacultyProfile.deleteMany({});
    await Department.deleteMany({});
    await AcademicYear.deleteMany({});
    await SGPCycle.deleteMany({});
    await ProjectGroup.deleteMany({});
    await GroupMember.deleteMany({});
    await Project.deleteMany({});
    await Feature.deleteMany({});
    await Task.deleteMany({});
    await Bug.deleteMany({});
    await Milestone.deleteMany({});
    await WikiPage.deleteMany({});
    await Review.deleteMany({});
    await ReviewMark.deleteMany({});
    await StudentMark.deleteMany({});
    await ProposalFeedback.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('[Seed]: Creating seed structure & accounts...');

    // 1. Departments
    const deptIT = await Department.create({
      name: 'Information Technology',
      code: 'IT',
      description: 'Department of Information Technology & Software Engineering',
      isActive: true,
    });
    const deptCSE = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
      description: 'Department of Computer Science & Artificial Intelligence',
      isActive: true,
    });
    console.log('✓ Departments created: IT, CSE');

    // 2. Academic Years
    const acadYear = await AcademicYear.create({
      yearLabel: '2025-2026',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    });
    console.log('✓ Academic Year created: 2025-2026');

    // 3. SGP Cycles
    const sgpCycle = await SGPCycle.create({
      name: 'SGP-V 2026 (Semester 5 Project)',
      departmentId: deptIT._id,
      academicYearId: acadYear._id,
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-05-30'),
      isActive: true,
    });
    console.log('✓ SGP Cycle created: SGP-V 2026');

    // 4. Admin Account
    const adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin@teamsync.edu',
      passwordHash: 'admin123',
      role: 'ADMIN',
      isActive: true,
    });
    console.log(`✓ Admin created: admin@teamsync.edu / admin123`);

    // 5. Coordinator Account
    const coordUser = await User.create({
      name: 'Prof. Hitesh Patel',
      email: 'coordinator@teamsync.edu',
      passwordHash: 'coord123',
      role: 'COORDINATOR',
      isActive: true,
    });
    await FacultyProfile.create({
      userId: coordUser._id,
      departmentId: deptIT._id,
      designation: 'Associate Professor & SGP Coordinator',
      expertise: ['Cloud Computing', 'Software Architecture'],
    });
    console.log(`✓ Coordinator created: coordinator@teamsync.edu / coord123`);

    // 6. Faculty Account
    const facultyUser = await User.create({
      name: 'Dr. Ananya Sharma',
      email: 'faculty@teamsync.edu',
      passwordHash: 'faculty123',
      role: 'FACULTY',
      isActive: true,
    });
    await FacultyProfile.create({
      userId: facultyUser._id,
      departmentId: deptIT._id,
      designation: 'Assistant Professor',
      expertise: ['Artificial Intelligence', 'Data Science'],
    });
    console.log(`✓ Faculty created: faculty@teamsync.edu / faculty123`);

    // 7. Student 1: Rahul Sharma (Leader)
    const student1 = await User.create({
      name: 'Rahul Sharma',
      enrollmentNumber: '24IT001',
      passwordHash: 'student123',
      role: 'STUDENT',
      isActive: true,
    });
    await StudentProfile.create({
      userId: student1._id,
      enrollmentNumber: '24IT001',
      departmentId: deptIT._id,
      semester: 5,
      skills: ['React', 'Node.js', 'MongoDB'],
      interests: ['Web Development', 'AI'],
      bio: 'Enthusiastic full-stack developer passionate about building web apps.',
    });
    console.log(`✓ Student 1 created: 24IT001 / student123`);

    // 8. Student 2: Priya Verma (Member)
    const student2 = await User.create({
      name: 'Priya Verma',
      enrollmentNumber: '24IT002',
      passwordHash: 'student123',
      role: 'STUDENT',
      isActive: true,
    });
    await StudentProfile.create({
      userId: student2._id,
      enrollmentNumber: '24IT002',
      departmentId: deptIT._id,
      semester: 5,
      skills: ['UI/UX Design', 'Tailwind CSS', 'Python'],
      interests: ['Frontend', 'Machine Learning'],
      bio: 'Design enthusiast and frontend builder.',
    });
    console.log(`✓ Student 2 created: 24IT002 / student123`);

    // 9. Student 3: Aarav Patel
    const student3 = await User.create({
      name: 'Aarav Patel',
      enrollmentNumber: '24IT003',
      passwordHash: 'student123',
      role: 'STUDENT',
      isActive: true,
    });
    await StudentProfile.create({
      userId: student3._id,
      enrollmentNumber: '24IT003',
      departmentId: deptIT._id,
      semester: 5,
      skills: ['IoT', 'Embedded C', 'AWS IoT Core'],
      interests: ['Hardware Integrations', 'Robotics'],
      bio: 'IoT systems architect.',
    });
    console.log(`✓ Student 3 created: 24IT003 / student123`);

    // 10. Project Group 1: Team Alpha Innovators
    const group1 = await ProjectGroup.create({
      name: 'Team Alpha Innovators',
      code: 'GRP-2026-IT01',
      departmentId: deptIT._id,
      sgpCycleId: sgpCycle._id,
      leaderId: student1._id,
      guideId: facultyUser._id,
      status: 'ACTIVE',
      groupNumber: 1,
    });

    await GroupMember.create({
      groupId: group1._id,
      userId: student1._id,
      role: 'LEADER',
      status: 'ACCEPTED',
    });
    await GroupMember.create({
      groupId: group1._id,
      userId: student2._id,
      role: 'MEMBER',
      status: 'ACCEPTED',
    });

    // Option 1 Proposal (APPROVED for Development)
    const project1 = await Project.create({
      groupId: group1._id,
      sgpCycleId: sgpCycle._id,
      departmentId: deptIT._id,
      facultyGuideId: facultyUser._id,
      title: 'Smart AI Clinical Decision Support & Medical Imaging Analysis',
      projectKey: 'SACD',
      domain: 'AI / Healthcare',
      techStack: ['Python', 'FastAPI', 'PyTorch', 'React', 'MongoDB'],
      problemStatement: 'Radiology clinics suffer from delayed diagnostics due to high workload and human oversight in pathology imaging.',
      objectives: [
        'Develop deep-learning inference pipeline for MRI and CT scans',
        'Provide automated bounding-box heatmaps for detected anomalies',
        'Deliver a responsive doctor-facing review desk with audit logging',
      ],
      scope: 'Diagnostic support tool for authorized radiologists in institutional hospitals.',
      expectedOutcome: 'A clinically validated web application that reduces radiologist review turnaround by 35%.',
      innovation: 'Multi-modal attention network combining patient vitals with DICOM imaging.',
      status: 'APPROVED',
      submissionCount: 1,
      statusHistory: [
        {
          status: 'SUBMITTED',
          changedBy: student1._id,
          timestamp: new Date(Date.now() - 86400000 * 2),
          feedback: 'Initial proposal submitted by Rahul Sharma for Dr. Ananya Sharma review.',
        },
        {
          status: 'APPROVED',
          changedBy: facultyUser._id,
          timestamp: new Date(Date.now() - 86400000),
          feedback: 'Comprehensive clinical design and strong PyTorch architecture. Approved to begin Sprint 1.',
        },
      ],
    });

    // Option 2 Proposal (REJECTED upon Option 1 Approval)
    await Project.create({
      groupId: group1._id,
      sgpCycleId: sgpCycle._id,
      departmentId: deptIT._id,
      facultyGuideId: facultyUser._id,
      title: 'Decentralized Academic Credential Verification System (Option 2)',
      projectKey: 'DACV',
      domain: 'Blockchain / Web3',
      techStack: ['Solidity', 'Ethereum', 'React', 'Ethers.js'],
      problemStatement: 'Manual university degree verification is slow and susceptible to fraudulent transcripts.',
      objectives: ['Immutable smart-contract issuance of academic transcripts'],
      status: 'REJECTED',
      submissionCount: 0,
      statusHistory: [
        {
          status: 'REJECTED',
          changedBy: facultyUser._id,
          timestamp: new Date(Date.now() - 86400000),
          feedback: 'Option 1 (Smart AI Clinical Decision Support) was selected and approved.',
        },
      ],
    });

    // Features for Project 1
    const feature1 = await Feature.create({
      projectId: project1._id,
      title: 'DICOM Ingestion & Preprocessing Pipeline',
      description: 'Handles 3D CT/MRI DICOM file upload, windowing, and slice normalization.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      createdBy: student1._id,
    });

    const feature2 = await Feature.create({
      projectId: project1._id,
      title: 'Radiologist Web Inspection Console',
      description: 'Interactive heatmap visualization desk for medical specialists.',
      status: 'TO_DO',
      priority: 'MEDIUM',
      createdBy: student1._id,
    });

    // Tasks for Project 1
    await Task.create({
      projectId: project1._id,
      featureId: feature1._id,
      taskKey: 'SACD-1',
      taskNumber: 1,
      reporterId: student1._id,
      title: 'Setup PyTorch DICOM pipeline & model weights loader',
      description: 'Load pre-trained 3D CNN weights and construct inference transform pipeline.',
      status: 'DONE',
      priority: 'HIGH',
      assigneeId: student1._id,
      startDate: new Date(Date.now() - 86400000 * 5),
      dueDate: new Date(Date.now() - 86400000 * 2),
    });

    await Task.create({
      projectId: project1._id,
      featureId: feature1._id,
      taskKey: 'SACD-2',
      taskNumber: 2,
      reporterId: student1._id,
      title: 'Implement FastAPI inference endpoint with JWT validation',
      description: 'Expose /predict endpoint returning bounding boxes and anomaly classification probabilities.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assigneeId: student1._id,
      startDate: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + 86400000 * 3),
    });

    await Task.create({
      projectId: project1._id,
      featureId: feature2._id,
      taskKey: 'SACD-3',
      taskNumber: 3,
      reporterId: student1._id,
      title: 'Design interactive CT/MRI heatmap viewer UI with zoom & pan',
      description: 'Build high-performance canvas component supporting window-level contrast adjustment.',
      status: 'TO_DO',
      priority: 'MEDIUM',
      assigneeId: student2._id,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 86400000 * 6),
    });

    // Bugs for Project 1
    await Bug.create({
      projectId: project1._id,
      bugKey: 'SACD-BUG-1',
      reporterId: student1._id,
      title: 'Inference latency exceeds 3s on multi-slice 3D CT volumes',
      description: 'Batch slicing causes GPU memory spillover on volumes larger than 120 slices.',
      priority: 'HIGH',
      status: 'OPEN',
      featureId: feature1._id,
      assigneeId: student1._id,
      dueDate: new Date(Date.now() + 86400000 * 2),
    });

    await Bug.create({
      projectId: project1._id,
      bugKey: 'SACD-BUG-2',
      reporterId: student1._id,
      title: 'DICOM header tag parsing fails for private hospital vendor metadata',
      description: 'Pydicom raises InvalidDicomError when Siemens private tags are encountered.',
      priority: 'MEDIUM',
      status: 'FIXED',
      featureId: feature1._id,
      assigneeId: student2._id,
      dueDate: new Date(Date.now() - 86400000),
    });

    // Milestones for Project 1
    await Milestone.create({
      projectId: project1._id,
      title: 'Milestone 1: Prototype Validation & Model Inference',
      description: 'Demonstrate functional inference pipeline with baseline accuracy > 88%.',
      startDate: new Date('2026-02-01'),
      targetDate: new Date('2026-03-15'),
      type: 'OFFICIAL',
      expectedProgress: 35,
      progressPercentage: 40,
      requirements: [
        { text: 'DICOM loader pipeline functional', isCompleted: true },
        { text: 'Inference API responding under 2s', isCompleted: false },
        { text: 'Web inspection UI prototype ready', isCompleted: false },
      ],
    });

    // Wiki Page for Project 1
    await WikiPage.create({
      projectId: project1._id,
      title: 'System Architecture & DICOM Processing Specifications',
      slug: 'system-architecture-dicom-processing',
      content: '### System Architecture Overview\n\nThe Smart AI Clinical Decision Support platform comprises three core tiers:\n\n1. **Inference Microservice**: PyTorch 2.0 with CUDA acceleration\n2. **REST API Gateway**: FastAPI with OAuth2 token validation\n3. **Medical Review Desk**: React with Cornerstone.js DICOM viewport',
      category: 'Technical Documentation',
      authorId: student1._id,
    });

    // 11. Project Group 2: NextGen IoT Solutions
    const group2 = await ProjectGroup.create({
      name: 'NextGen IoT Solutions',
      code: 'GRP-2026-IT02',
      departmentId: deptIT._id,
      sgpCycleId: sgpCycle._id,
      leaderId: student3._id,
      guideId: facultyUser._id,
      status: 'ACTIVE',
      groupNumber: 2,
    });

    await GroupMember.create({
      groupId: group2._id,
      userId: student3._id,
      role: 'LEADER',
      status: 'ACCEPTED',
    });

    // Option 1 Proposal for Group 2 (SUBMITTED for Faculty Review)
    await Project.create({
      groupId: group2._id,
      sgpCycleId: sgpCycle._id,
      departmentId: deptIT._id,
      facultyGuideId: facultyUser._id,
      title: 'Autonomous Drone Swarm for Disaster Relief & Reconnaissance',
      projectKey: 'ADSR',
      domain: 'IoT / Robotics',
      techStack: ['Python', 'ROS 2', 'C++', 'Raspberry Pi', 'React'],
      problemStatement: 'Search and rescue operations in disaster zones are hindered by hazardous terrains and loss of standard communication lines.',
      objectives: [
        'Deploy autonomous multi-drone mesh network for survivor location detection',
        'Stream real-time thermal and optical sensory feeds to field command station',
        'Coordinate automated relief supply dropping mechanisms',
      ],
      scope: 'Field-tested autonomous reconnaissance unit for emergency disaster response teams.',
      expectedOutcome: 'High-speed automated aerial mapping with live survivor heat-signature tracking within 10 minutes of disaster onset.',
      innovation: 'Decentralized drone swarm consensus protocol using low-power LoRa mesh network.',
      status: 'SUBMITTED',
      submissionCount: 1,
      statusHistory: [
        {
          status: 'SUBMITTED',
          changedBy: student3._id,
          timestamp: new Date(),
          feedback: 'Initial proposal submitted by Aarav Patel for Dr. Ananya Sharma review.',
        },
      ],
    });

    console.log('✓ Groups 1 & 2 seeded with members, approved project, tasks, bugs, wiki, and proposals!');

    // 12. Review Schedules
    // A) Draft Review Schedule (Ready for Coordinator to send/publish)
    const reviewDraft = await Review.create({
      title: 'Mid-Term Progress & Architecture Review 2026',
      type: 'Development Review',
      department: 'Information Technology',
      reviewDate: new Date('2026-03-25'),
      startTime: '10:00',
      endTime: '16:00',
      maxMarks: 25,
      status: 'DRAFT',
      marksVisibility: 'HIDDEN',
      assignedGroups: [group1._id, group2._id],
      facultyReviewers: [facultyUser._id],
    });

    // B) Published Review Schedule (Live for students and faculty)
    const reviewPublished = await Review.create({
      title: 'SGP-V Project Proposal Defense & SRS Review',
      type: 'Proposal Review',
      department: 'Information Technology',
      reviewDate: new Date('2026-02-15'),
      startTime: '09:30',
      endTime: '17:00',
      maxMarks: 20,
      status: 'PUBLISHED',
      marksVisibility: 'VISIBLE',
      assignedGroups: [group1._id, group2._id],
      facultyReviewers: [facultyUser._id],
    });

    // 13. Pre-seed Faculty Marks for Published Review
    await ReviewMark.create({
      reviewId: reviewPublished._id,
      studentId: student1._id,
      groupId: group1._id,
      facultyId: facultyUser._id,
      marks: 18,
      feedback: 'Excellent presentation, clear architecture diagram and strong technical foundation.',
      status: 'SUBMITTED',
    });

    await ReviewMark.create({
      reviewId: reviewPublished._id,
      studentId: student2._id,
      groupId: group1._id,
      facultyId: facultyUser._id,
      marks: 17,
      feedback: 'Good understanding of frontend requirements and UI mockup design.',
      status: 'SUBMITTED',
    });

    console.log('✓ Review schedules created and marks pre-seeded for student portal!');

    console.log('\n[Seed Success]: Database fully populated with complete institutional hierarchy, test accounts, active groups, proposals, and reviews!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
