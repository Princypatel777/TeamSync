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

    // 7. Student 1 Account
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

    // 8. Student 2 Account
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

    console.log('\n[Seed Success]: Database populated with initial structure and test accounts!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
