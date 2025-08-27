const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const ZoomSession = require('../models/ZoomSession');
const Material = require('../models/Material');
const { auth, isTeacher } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/students
// @desc    Get all students (Teacher only)
// @access  Private (Teacher only)
router.get('/', auth, isTeacher, async (req, res) => {
    try {
        const { grade, program, course } = req.query;
        
        let query = { role: 'student' };
        
        if (grade) query['studentInfo.grade'] = grade;
        if (program) query['studentInfo.program'] = program;

        const students = await User.find(query)
            .select('-password')
            .sort({ 'studentInfo.grade': 1, name: 1 });

        // If course filter is applied, get students who have materials in that course
        let filteredStudents = students;
        if (course) {
            const studentsWithCourse = await Material.distinct('owner', { course });
            filteredStudents = students.filter(student => 
                studentsWithCourse.includes(student._id)
            );
        }

        res.json({ 
            students: filteredStudents,
            total: filteredStudents.length 
        });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/students/:id
// @desc    Get student details
// @access  Private (Teacher only)
router.get('/:id', auth, isTeacher, async (req, res) => {
    try {
        const student = await User.findOne({ _id: req.params.id, role: 'student' })
            .select('-password');
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get student's session attendance
        const sessions = await ZoomSession.find({
            'attendees.student': student._id
        }).populate('teacher', 'name');

        // Get student's progress (materials accessed)
        const materialsAccessed = await Material.find({
            $or: [
                { viewCount: { $gt: 0 } },
                { downloadCount: { $gt: 0 } }
            ]
        }).countDocuments();

        const studentData = {
            ...student.toJSON(),
            sessionsAttended: sessions.length,
            materialsAccessed,
            recentSessions: sessions.slice(-5)
        };

        res.json({ student: studentData });
    } catch (error) {
        console.error('Get student details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/students/:id
// @desc    Update student information
// @access  Private (Teacher only)
router.put('/:id', auth, isTeacher, [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('studentInfo.grade').optional().isIn(['9', '10', '11', '12']).withMessage('Invalid grade'),
    body('studentInfo.program').optional().isIn(['EST', 'ACT', 'Both']).withMessage('Invalid program')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const student = await User.findOne({ _id: req.params.id, role: 'student' });
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const { name, email, studentInfo, isActive } = req.body;

        if (name) student.name = name;
        if (email && email !== student.email) {
            // Check if email is already taken
            const existingUser = await User.findOne({ email, _id: { $ne: student._id } });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            student.email = email;
        }
        if (studentInfo) {
            student.studentInfo = { ...student.studentInfo, ...studentInfo };
        }
        if (isActive !== undefined) student.isActive = isActive;

        await student.save();

        res.json({
            message: 'Student updated successfully',
            student: student.toJSON()
        });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/students/:id/progress
// @desc    Get student progress and analytics
// @access  Private (Teacher only)
router.get('/:id/progress', auth, isTeacher, async (req, res) => {
    try {
        const student = await User.findOne({ _id: req.params.id, role: 'student' });
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get sessions attended
        const sessionsAttended = await ZoomSession.find({
            'attendees.student': student._id
        }).populate('teacher', 'name');

        // Get materials by course
        const materialsByCourse = await Material.aggregate([
            {
                $match: {
                    $or: [
                        { grade: student.studentInfo.grade },
                        { program: student.studentInfo.program },
                        { program: 'Both' }
                    ]
                }
            },
            {
                $group: {
                    _id: '$course',
                    totalMaterials: { $sum: 1 },
                    totalViews: { $sum: '$viewCount' },
                    totalDownloads: { $sum: '$downloadCount' }
                }
            }
        ]);

        // Calculate attendance rate
        const totalSessions = await ZoomSession.countDocuments({
            $or: [
                { grade: student.studentInfo.grade },
                { program: student.studentInfo.program },
                { program: 'Both' }
            ],
            scheduledTime: { $lte: new Date() }
        });

        const attendanceRate = totalSessions > 0 ? (sessionsAttended.length / totalSessions) * 100 : 0;

        const progress = {
            student: student.toJSON(),
            sessionsAttended: sessionsAttended.length,
            totalSessions,
            attendanceRate: Math.round(attendanceRate),
            materialsByCourse,
            recentSessions: sessionsAttended.slice(-10),
            enrollmentDuration: Math.floor((new Date() - student.studentInfo.enrollmentDate) / (1000 * 60 * 60 * 24))
        };

        res.json({ progress });
    } catch (error) {
        console.error('Get student progress error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/students/analytics/overview
// @desc    Get students analytics overview
// @access  Private (Teacher only)
router.get('/analytics/overview', auth, isTeacher, async (req, res) => {
    try {
        // Total students by grade
        const studentsByGrade = await User.aggregate([
            { $match: { role: 'student' } },
            { $group: { _id: '$studentInfo.grade', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Total students by program
        const studentsByProgram = await User.aggregate([
            { $match: { role: 'student' } },
            { $group: { _id: '$studentInfo.program', count: { $sum: 1 } } }
        ]);

        // Active vs inactive students
        const activeStudents = await User.countDocuments({ role: 'student', isActive: true });
        const inactiveStudents = await User.countDocuments({ role: 'student', isActive: false });

        // Recent enrollments (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentEnrollments = await User.countDocuments({
            role: 'student',
            'studentInfo.enrollmentDate': { $gte: thirtyDaysAgo }
        });

        // Session attendance analytics
        const totalSessions = await ZoomSession.countDocuments({
            scheduledTime: { $lte: new Date() }
        });

        const sessionsWithAttendees = await ZoomSession.aggregate([
            { $match: { scheduledTime: { $lte: new Date() } } },
            { $project: { attendeeCount: { $size: '$attendees' } } },
            { $group: { _id: null, totalAttendees: { $sum: '$attendeeCount' } } }
        ]);

        const averageAttendance = totalSessions > 0 && sessionsWithAttendees.length > 0 
            ? Math.round(sessionsWithAttendees[0].totalAttendees / totalSessions) 
            : 0;

        const analytics = {
            totalStudents: activeStudents + inactiveStudents,
            activeStudents,
            inactiveStudents,
            recentEnrollments,
            studentsByGrade,
            studentsByProgram,
            sessionAnalytics: {
                totalSessions,
                averageAttendance
            }
        };

        res.json({ analytics });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/students/bulk-invite
// @desc    Bulk invite students via email
// @access  Private (Teacher only)
router.post('/bulk-invite', auth, isTeacher, [
    body('emails').isArray({ min: 1 }).withMessage('At least one email is required'),
    body('emails.*').isEmail().withMessage('All emails must be valid'),
    body('grade').isIn(['9', '10', '11', '12']).withMessage('Invalid grade'),
    body('program').isIn(['EST', 'ACT', 'Both']).withMessage('Invalid program')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { emails, grade, program, message } = req.body;
        const results = {
            successful: [],
            failed: [],
            existing: []
        };

        for (const email of emails) {
            try {
                // Check if user already exists
                const existingUser = await User.findOne({ email });
                if (existingUser) {
                    results.existing.push(email);
                    continue;
                }

                // Create temporary password
                const tempPassword = Math.random().toString(36).substring(2, 10);

                // Create user account
                const user = new User({
                    name: email.split('@')[0], // Use email prefix as temporary name
                    email,
                    password: tempPassword,
                    role: 'student',
                    studentInfo: {
                        grade,
                        program,
                        enrollmentDate: new Date()
                    }
                });

                await user.save();

                // TODO: Send invitation email with temporary password
                // This would require implementing email service

                results.successful.push({
                    email,
                    tempPassword,
                    userId: user._id
                });

            } catch (error) {
                results.failed.push({
                    email,
                    error: error.message
                });
            }
        }

        res.json({
            message: 'Bulk invitation completed',
            results
        });
    } catch (error) {
        console.error('Bulk invite error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
