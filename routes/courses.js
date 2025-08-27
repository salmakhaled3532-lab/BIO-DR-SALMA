const express = require('express');
const { body, validationResult } = require('express-validator');
const Folder = require('../models/Folder');
const Material = require('../models/Material');
const ZoomSession = require('../models/ZoomSession');
const User = require('../models/User');
const { auth, isTeacher } = require('../middleware/auth');

const router = express.Router();

// Available courses based on Dr. Salma's expertise
const AVAILABLE_COURSES = [
    'Biochemistry',
    'Cell Biology', 
    'Animal Behavior',
    'Evolution',
    'Photosynthesis',
    'Cell Division',
    'Cell Respiration',
    'General Biology'
];

// @route   GET /api/courses
// @desc    Get all available courses
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { grade, program } = req.query;
        
        // Get course statistics
        const courseStats = await Promise.all(
            AVAILABLE_COURSES.map(async (course) => {
                let query = { course };
                if (grade) query.grade = grade;
                if (program) query.program = program;

                const [folders, materials, sessions, students] = await Promise.all([
                    Folder.countDocuments(query),
                    Material.countDocuments(query),
                    ZoomSession.countDocuments(query),
                    req.user.role === 'teacher' ? 
                        User.countDocuments({ 
                            role: 'student',
                            ...(grade && { 'studentInfo.grade': grade }),
                            ...(program && { 'studentInfo.program': program })
                        }) : 0
                ]);

                return {
                    name: course,
                    folders,
                    materials,
                    sessions,
                    students: req.user.role === 'teacher' ? students : undefined
                };
            })
        );

        res.json({ courses: courseStats });
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/courses/:course
// @desc    Get specific course details
// @access  Private
router.get('/:course', auth, async (req, res) => {
    try {
        const { course } = req.params;
        const { grade, program } = req.query;

        if (!AVAILABLE_COURSES.includes(course)) {
            return res.status(404).json({ message: 'Course not found' });
        }

        let query = { course };
        if (grade) query.grade = grade;
        if (program) query.program = program;

        // For students, only show public content or content they have access to
        if (req.user.role === 'student') {
            query.$or = [
                { isPublic: true },
                { 'sharedWith.user': req.user._id }
            ];
        } else {
            // Teachers see their own content
            query.owner = req.user._id;
        }

        const [folders, materials, upcomingSessions] = await Promise.all([
            Folder.find(query)
                .populate('owner', 'name')
                .sort({ createdAt: -1 })
                .limit(10),
            Material.find(query)
                .populate('owner', 'name')
                .populate('folder', 'name')
                .sort({ createdAt: -1 })
                .limit(20),
            ZoomSession.find({
                course,
                scheduledTime: { $gte: new Date() },
                ...(grade && { grade }),
                ...(program && { program })
            })
                .populate('teacher', 'name')
                .sort({ scheduledTime: 1 })
                .limit(5)
        ]);

        // Get course description based on Dr. Salma's expertise
        const courseDescriptions = {
            'Biochemistry': 'Advanced study of molecular structures, enzyme kinetics, and metabolic pathways fundamental to life processes.',
            'Cell Biology': 'Comprehensive exploration of cellular structures, organelle functions, and cellular mechanisms.',
            'Animal Behavior': 'Investigation of behavioral patterns, physiological responses, and neurobiological mechanisms in animals.',
            'Evolution': 'Study of evolutionary processes, genetic variation, natural selection, and molecular evolution.',
            'Photosynthesis': 'Analysis of photosynthetic processes, chloroplast function, and energy conversion in plants.',
            'Cell Division': 'Detailed examination of mitosis, meiosis, and cellular reproduction mechanisms.',
            'Cell Respiration': 'Study of cellular respiration, ATP synthesis, and energy metabolism in biological systems.',
            'General Biology': 'Foundational concepts in biology covering multiple biological disciplines and processes.'
        };

        const courseData = {
            name: course,
            description: courseDescriptions[course],
            folders,
            materials,
            upcomingSessions,
            stats: {
                totalFolders: folders.length,
                totalMaterials: materials.length,
                upcomingSessionsCount: upcomingSessions.length
            }
        };

        res.json({ course: courseData });
    } catch (error) {
        console.error('Get course details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/courses/:course/materials
// @desc    Get all materials for a course
// @access  Private
router.get('/:course/materials', auth, async (req, res) => {
    try {
        const { course } = req.params;
        const { grade, program, type, page = 1, limit = 20 } = req.query;

        if (!AVAILABLE_COURSES.includes(course)) {
            return res.status(404).json({ message: 'Course not found' });
        }

        let query = { course };
        if (grade) query.grade = grade;
        if (program) query.program = program;
        if (type) query.type = type;

        // Access control
        if (req.user.role === 'student') {
            query.$or = [
                { isPublic: true },
                { 'sharedWith.user': req.user._id }
            ];
        } else {
            query.owner = req.user._id;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [materials, total] = await Promise.all([
            Material.find(query)
                .populate('owner', 'name')
                .populate('folder', 'name path')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Material.countDocuments(query)
        ]);

        res.json({
            materials,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total
            }
        });
    } catch (error) {
        console.error('Get course materials error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/courses/:course/sessions
// @desc    Get all sessions for a course
// @access  Private
router.get('/:course/sessions', auth, async (req, res) => {
    try {
        const { course } = req.params;
        const { grade, program, status, upcoming } = req.query;

        if (!AVAILABLE_COURSES.includes(course)) {
            return res.status(404).json({ message: 'Course not found' });
        }

        let query = { course };
        if (grade) query.grade = grade;
        if (program) query.program = program;
        if (status) query.status = status;

        if (upcoming === 'true') {
            query.scheduledTime = { $gte: new Date() };
        }

        // Access control
        if (req.user.role === 'student') {
            // Students can see sessions for their grade/program
            query.$or = [
                { grade: req.user.studentInfo.grade },
                { program: req.user.studentInfo.program },
                { program: 'Both' }
            ];
        } else {
            query.teacher = req.user._id;
        }

        const sessions = await ZoomSession.find(query)
            .populate('teacher', 'name email')
            .populate('materials', 'title type')
            .sort({ scheduledTime: upcoming === 'true' ? 1 : -1 });

        res.json({ sessions });
    } catch (error) {
        console.error('Get course sessions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/courses/:course/analytics
// @desc    Get course analytics (Teacher only)
// @access  Private (Teacher only)
router.get('/:course/analytics', auth, isTeacher, async (req, res) => {
    try {
        const { course } = req.params;
        const { grade, program } = req.query;

        if (!AVAILABLE_COURSES.includes(course)) {
            return res.status(404).json({ message: 'Course not found' });
        }

        let query = { course, owner: req.user._id };
        if (grade) query.grade = grade;
        if (program) query.program = program;

        // Material analytics
        const materialStats = await Material.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalViews: { $sum: '$viewCount' },
                    totalDownloads: { $sum: '$downloadCount' }
                }
            }
        ]);

        // Session analytics
        const sessionQuery = { course, teacher: req.user._id };
        if (grade) sessionQuery.grade = grade;
        if (program) sessionQuery.program = program;

        const [totalSessions, completedSessions, upcomingSessions] = await Promise.all([
            ZoomSession.countDocuments(sessionQuery),
            ZoomSession.countDocuments({ ...sessionQuery, status: 'ended' }),
            ZoomSession.countDocuments({ 
                ...sessionQuery, 
                scheduledTime: { $gte: new Date() },
                status: 'scheduled'
            })
        ]);

        // Student engagement
        const sessionAttendance = await ZoomSession.aggregate([
            { $match: sessionQuery },
            { $project: { attendeeCount: { $size: '$attendees' } } },
            { $group: { _id: null, totalAttendees: { $sum: '$attendeeCount' }, avgAttendance: { $avg: '$attendeeCount' } } }
        ]);

        // Most popular materials
        const popularMaterials = await Material.find(query)
            .sort({ viewCount: -1, downloadCount: -1 })
            .limit(5)
            .select('title type viewCount downloadCount');

        const analytics = {
            course,
            materialStats,
            sessionStats: {
                total: totalSessions,
                completed: completedSessions,
                upcoming: upcomingSessions,
                attendance: sessionAttendance[0] || { totalAttendees: 0, avgAttendance: 0 }
            },
            popularMaterials,
            totalFolders: await Folder.countDocuments(query),
            totalMaterials: await Material.countDocuments(query)
        };

        res.json({ analytics });
    } catch (error) {
        console.error('Get course analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/courses/:course/bulk-organize
// @desc    Bulk organize materials into folders by type
// @access  Private (Teacher only)
router.post('/:course/bulk-organize', auth, isTeacher, async (req, res) => {
    try {
        const { course } = req.params;
        const { grade, program } = req.body;

        if (!AVAILABLE_COURSES.includes(course)) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Get unorganized materials (not in any folder)
        const unorganizedMaterials = await Material.find({
            course,
            owner: req.user._id,
            folder: { $exists: false }
        });

        if (unorganizedMaterials.length === 0) {
            return res.status(400).json({ message: 'No unorganized materials found' });
        }

        const results = {
            foldersCreated: 0,
            materialsOrganized: 0,
            errors: []
        };

        // Group materials by type
        const materialsByType = unorganizedMaterials.reduce((acc, material) => {
            if (!acc[material.type]) {
                acc[material.type] = [];
            }
            acc[material.type].push(material);
            return acc;
        }, {});

        // Create folders for each type and move materials
        for (const [type, materials] of Object.entries(materialsByType)) {
            try {
                // Create folder for this type
                const folderName = `${course} - ${type.toUpperCase()} Materials`;
                
                let folder = await Folder.findOne({
                    name: folderName,
                    course,
                    owner: req.user._id
                });

                if (!folder) {
                    folder = new Folder({
                        name: folderName,
                        description: `Auto-generated folder for ${type} materials in ${course}`,
                        course,
                        grade: grade || '12',
                        program: program || 'Both',
                        owner: req.user._id,
                        color: getColorByType(type),
                        icon: getIconByType(type)
                    });
                    await folder.save();
                    results.foldersCreated++;
                }

                // Move materials to folder
                await Material.updateMany(
                    { _id: { $in: materials.map(m => m._id) } },
                    { folder: folder._id }
                );

                results.materialsOrganized += materials.length;

            } catch (error) {
                results.errors.push({
                    type,
                    error: error.message
                });
            }
        }

        res.json({
            message: 'Bulk organization completed',
            results
        });
    } catch (error) {
        console.error('Bulk organize error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper functions
function getColorByType(type) {
    const colors = {
        'pdf': '#e74c3c',
        'doc': '#3498db',
        'docx': '#3498db',
        'ppt': '#f39c12',
        'pptx': '#f39c12',
        'video': '#9b59b6',
        'image': '#1abc9c',
        'link': '#34495e',
        'quiz': '#e67e22',
        'assignment': '#27ae60'
    };
    return colors[type] || '#2c5aa0';
}

function getIconByType(type) {
    const icons = {
        'pdf': 'file-pdf',
        'doc': 'file-word',
        'docx': 'file-word',
        'ppt': 'file-powerpoint',
        'pptx': 'file-powerpoint',
        'video': 'file-video',
        'image': 'file-image',
        'link': 'link',
        'quiz': 'question-circle',
        'assignment': 'tasks'
    };
    return icons[type] || 'file';
}

module.exports = router;
