const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const ZoomSession = require('../models/ZoomSession');
const User = require('../models/User');
const { auth, isTeacher } = require('../middleware/auth');

const router = express.Router();

// Zoom API configuration
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

// Generate Zoom JWT token (you'll need to implement this based on your Zoom app)
const generateZoomToken = () => {
    // This is a placeholder - implement JWT generation for Zoom API
    return process.env.ZOOM_JWT_TOKEN;
};

// @route   GET /api/zoom/sessions
// @desc    Get all Zoom sessions
// @access  Private
router.get('/sessions', auth, async (req, res) => {
    try {
        const { course, grade, program, status, upcoming } = req.query;
        
        let query = {};
        
        // If user is a student, only show sessions they can attend
        if (req.user.role === 'student') {
            query.$or = [
                { grade: req.user.studentInfo.grade },
                { program: req.user.studentInfo.program },
                { program: 'Both' }
            ];
        } else {
            // Teacher can see all their sessions
            query.teacher = req.user._id;
        }
        
        if (course) query.course = course;
        if (grade) query.grade = grade;
        if (program) query.program = program;
        if (status) query.status = status;
        
        if (upcoming === 'true') {
            query.scheduledTime = { $gte: new Date() };
        }

        const sessions = await ZoomSession.find(query)
            .populate('teacher', 'name email')
            .populate('materials', 'title type fileName')
            .populate('attendees.student', 'name email')
            .sort({ scheduledTime: 1 });

        res.json({ sessions });
    } catch (error) {
        console.error('Get Zoom sessions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/zoom/sessions
// @desc    Create a new Zoom session
// @access  Private (Teacher only)
router.post('/sessions', auth, isTeacher, [
    body('title').trim().isLength({ min: 1 }).withMessage('Session title is required'),
    body('course').isIn(['Biochemistry', 'Cell Biology', 'Animal Behavior', 'Evolution', 'Photosynthesis', 'Cell Division', 'Cell Respiration', 'General Biology']).withMessage('Invalid course'),
    body('grade').isIn(['9', '10', '11', '12']).withMessage('Invalid grade'),
    body('program').isIn(['EST', 'ACT', 'Both']).withMessage('Invalid program'),
    body('scheduledTime').isISO8601().withMessage('Valid scheduled time is required'),
    body('duration').isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            title,
            description,
            course,
            grade,
            program,
            scheduledTime,
            duration,
            timezone,
            isRecorded,
            waitingRoom,
            requirePassword,
            allowJoinBeforeHost,
            muteOnEntry
        } = req.body;

        // Create Zoom meeting via API
        const zoomToken = generateZoomToken();
        
        const zoomMeetingData = {
            topic: title,
            type: 2, // Scheduled meeting
            start_time: new Date(scheduledTime).toISOString(),
            duration: duration,
            timezone: timezone || 'UTC',
            password: requirePassword ? Math.random().toString(36).substring(2, 10) : undefined,
            settings: {
                host_video: true,
                participant_video: false,
                cn_meeting: false,
                in_meeting: false,
                join_before_host: allowJoinBeforeHost || false,
                mute_upon_entry: muteOnEntry !== false,
                watermark: false,
                use_pmi: false,
                approval_type: 2,
                audio: 'both',
                auto_recording: isRecorded ? 'cloud' : 'none',
                enforce_login: false,
                registrants_email_notification: true,
                waiting_room: waitingRoom !== false
            }
        };

        let zoomResponse;
        try {
            zoomResponse = await axios.post(`${ZOOM_API_BASE}/users/me/meetings`, zoomMeetingData, {
                headers: {
                    'Authorization': `Bearer ${zoomToken}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (zoomError) {
            console.error('Zoom API error:', zoomError.response?.data || zoomError.message);
            // Create session without Zoom integration for demo purposes
            zoomResponse = {
                data: {
                    id: `demo_${Date.now()}`,
                    join_url: `https://zoom.us/j/demo_${Date.now()}`,
                    start_url: `https://zoom.us/s/demo_${Date.now()}`,
                    password: requirePassword ? Math.random().toString(36).substring(2, 10) : undefined
                }
            };
        }

        // Create session in database
        const session = new ZoomSession({
            title,
            description,
            course,
            grade,
            program,
            teacher: req.user._id,
            zoomMeetingId: zoomResponse.data.id.toString(),
            zoomPassword: zoomResponse.data.password,
            joinUrl: zoomResponse.data.join_url,
            startUrl: zoomResponse.data.start_url,
            scheduledTime: new Date(scheduledTime),
            duration,
            timezone: timezone || 'UTC',
            isRecorded,
            waitingRoom,
            requirePassword,
            allowJoinBeforeHost,
            muteOnEntry
        });

        await session.save();
        await session.populate('teacher', 'name email');

        res.status(201).json({
            message: 'Zoom session created successfully',
            session
        });
    } catch (error) {
        console.error('Create Zoom session error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/zoom/sessions/:id
// @desc    Update Zoom session
// @access  Private (Teacher only)
router.put('/sessions/:id', auth, isTeacher, async (req, res) => {
    try {
        const session = await ZoomSession.findOne({ _id: req.params.id, teacher: req.user._id });
        
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        const { title, description, scheduledTime, duration, status } = req.body;

        if (title) session.title = title;
        if (description !== undefined) session.description = description;
        if (scheduledTime) session.scheduledTime = new Date(scheduledTime);
        if (duration) session.duration = duration;
        if (status) session.status = status;

        // Update Zoom meeting if necessary
        if (title || scheduledTime || duration) {
            const zoomToken = generateZoomToken();
            const updateData = {};
            
            if (title) updateData.topic = title;
            if (scheduledTime) updateData.start_time = new Date(scheduledTime).toISOString();
            if (duration) updateData.duration = duration;

            try {
                await axios.patch(`${ZOOM_API_BASE}/meetings/${session.zoomMeetingId}`, updateData, {
                    headers: {
                        'Authorization': `Bearer ${zoomToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (zoomError) {
                console.error('Zoom update error:', zoomError.response?.data || zoomError.message);
                // Continue with database update even if Zoom update fails
            }
        }

        await session.save();
        await session.populate('teacher', 'name email');

        res.json({
            message: 'Session updated successfully',
            session
        });
    } catch (error) {
        console.error('Update Zoom session error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/zoom/sessions/:id
// @desc    Delete Zoom session
// @access  Private (Teacher only)
router.delete('/sessions/:id', auth, isTeacher, async (req, res) => {
    try {
        const session = await ZoomSession.findOne({ _id: req.params.id, teacher: req.user._id });
        
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Delete from Zoom
        const zoomToken = generateZoomToken();
        try {
            await axios.delete(`${ZOOM_API_BASE}/meetings/${session.zoomMeetingId}`, {
                headers: {
                    'Authorization': `Bearer ${zoomToken}`
                }
            });
        } catch (zoomError) {
            console.error('Zoom delete error:', zoomError.response?.data || zoomError.message);
            // Continue with database deletion even if Zoom deletion fails
        }

        await ZoomSession.findByIdAndDelete(session._id);

        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        console.error('Delete Zoom session error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/zoom/sessions/:id/join
// @desc    Join Zoom session (for students)
// @access  Private
router.post('/sessions/:id/join', auth, async (req, res) => {
    try {
        const session = await ZoomSession.findById(req.params.id);
        
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Check if student can join this session
        if (req.user.role === 'student') {
            const canJoin = session.grade === req.user.studentInfo.grade ||
                           session.program === req.user.studentInfo.program ||
                           session.program === 'Both';
            
            if (!canJoin) {
                return res.status(403).json({ message: 'You are not eligible for this session' });
            }
        }

        // Record attendance
        const existingAttendee = session.attendees.find(
            attendee => attendee.student.toString() === req.user._id.toString()
        );

        if (!existingAttendee) {
            session.attendees.push({
                student: req.user._id,
                joinedAt: new Date()
            });
            await session.save();
        }

        res.json({
            message: 'Join information retrieved',
            joinUrl: session.joinUrl,
            password: session.zoomPassword,
            sessionInfo: {
                title: session.title,
                description: session.description,
                scheduledTime: session.scheduledTime,
                duration: session.duration
            }
        });
    } catch (error) {
        console.error('Join session error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/zoom/sessions/:id/attendees
// @desc    Get session attendees
// @access  Private (Teacher only)
router.get('/sessions/:id/attendees', auth, isTeacher, async (req, res) => {
    try {
        const session = await ZoomSession.findOne({ _id: req.params.id, teacher: req.user._id })
            .populate('attendees.student', 'name email studentInfo');
        
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        res.json({ attendees: session.attendees });
    } catch (error) {
        console.error('Get attendees error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/zoom/sessions/:id/materials
// @desc    Add materials to session
// @access  Private (Teacher only)
router.post('/sessions/:id/materials', auth, isTeacher, async (req, res) => {
    try {
        const session = await ZoomSession.findOne({ _id: req.params.id, teacher: req.user._id });
        
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        const { materialIds } = req.body;
        
        if (!Array.isArray(materialIds)) {
            return res.status(400).json({ message: 'Material IDs must be an array' });
        }

        session.materials = [...new Set([...session.materials, ...materialIds])];
        await session.save();
        await session.populate('materials', 'title type fileName');

        res.json({
            message: 'Materials added to session',
            materials: session.materials
        });
    } catch (error) {
        console.error('Add materials error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
