const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Material = require('../models/Material');
const Folder = require('../models/Folder');
const { auth, isTeacher } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads', req.user.id.toString());
        try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|mp4|avi|mov|xlsx|xls|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// @route   GET /api/materials
// @desc    Get all materials with filtering
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { course, grade, program, type, folder, search, page = 1, limit = 20 } = req.query;
        
        let query = {};
        
        // Access control
        if (req.user.role === 'student') {
            query.$or = [
                { isPublic: true },
                { 'sharedWith.user': req.user._id }
            ];
            
            // Students can only see materials for their grade/program
            query.$and = [
                {
                    $or: [
                        { grade: req.user.studentInfo.grade },
                        { program: req.user.studentInfo.program },
                        { program: 'Both' }
                    ]
                }
            ];
        } else {
            query.owner = req.user._id;
        }
        
        if (course) query.course = course;
        if (grade) query.grade = grade;
        if (program) query.program = program;
        if (type) query.type = type;
        if (folder) query.folder = folder;
        
        // Search functionality
        if (search) {
            query.$text = { $search: search };
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [materials, total] = await Promise.all([
            Material.find(query)
                .populate('owner', 'name email')
                .populate('folder', 'name path color')
                .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
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
        console.error('Get materials error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/materials/:id
// @desc    Get specific material
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const material = await Material.findById(req.params.id)
            .populate('owner', 'name email')
            .populate('folder', 'name path color');
        
        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        // Check access permissions
        if (req.user.role === 'student') {
            const hasAccess = material.isPublic || 
                            material.sharedWith.some(share => 
                                share.user.toString() === req.user._id.toString()
                            );
            
            if (!hasAccess) {
                return res.status(403).json({ message: 'Access denied' });
            }
        } else if (material.owner._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Increment view count
        material.viewCount += 1;
        await material.save();

        res.json({ material });
    } catch (error) {
        console.error('Get material error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/materials
// @desc    Create new material
// @access  Private (Teacher only)
router.post('/', auth, isTeacher, upload.single('file'), [
    body('title').trim().isLength({ min: 1 }).withMessage('Material title is required'),
    body('type').isIn(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'video', 'image', 'link', 'quiz', 'assignment']).withMessage('Invalid material type'),
    body('course').isIn(['Biochemistry', 'Cell Biology', 'Animal Behavior', 'Evolution', 'Photosynthesis', 'Cell Division', 'Cell Respiration', 'General Biology']).withMessage('Invalid course'),
    body('grade').isIn(['9', '10', '11', '12']).withMessage('Invalid grade'),
    body('program').isIn(['EST', 'ACT', 'Both']).withMessage('Invalid program')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, type, url, folder, course, grade, program, tags, dueDate, priority, isPublic } = req.body;

        // Validate folder if provided
        if (folder) {
            const folderDoc = await Folder.findOne({ _id: folder, owner: req.user._id });
            if (!folderDoc) {
                return res.status(400).json({ message: 'Invalid folder' });
            }
        }

        const materialData = {
            title,
            description,
            type,
            folder: folder || null,
            owner: req.user._id,
            course,
            grade,
            program,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            dueDate: dueDate ? new Date(dueDate) : null,
            priority: priority || 'medium',
            isPublic: isPublic === 'true'
        };

        if (type === 'link') {
            if (!url) {
                return res.status(400).json({ message: 'URL is required for link type' });
            }
            materialData.url = url;
        } else if (req.file) {
            materialData.fileName = req.file.originalname;
            materialData.filePath = req.file.path;
            materialData.fileSize = req.file.size;
        } else {
            return res.status(400).json({ message: 'File is required for this material type' });
        }

        const material = new Material(materialData);
        await material.save();
        await material.populate('owner', 'name email');
        await material.populate('folder', 'name path color');

        res.status(201).json({
            message: 'Material created successfully',
            material
        });
    } catch (error) {
        console.error('Create material error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/materials/:id
// @desc    Update material
// @access  Private (Teacher only)
router.put('/:id', auth, isTeacher, [
    body('title').optional().trim().isLength({ min: 1 }).withMessage('Material title cannot be empty')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const material = await Material.findOne({ _id: req.params.id, owner: req.user._id });
        
        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        const { title, description, url, tags, dueDate, priority, isPublic } = req.body;

        if (title) material.title = title;
        if (description !== undefined) material.description = description;
        if (url && material.type === 'link') material.url = url;
        if (tags) material.tags = tags.split(',').map(tag => tag.trim());
        if (dueDate) material.dueDate = new Date(dueDate);
        if (priority) material.priority = priority;
        if (isPublic !== undefined) material.isPublic = isPublic;

        await material.save();
        await material.populate('owner', 'name email');
        await material.populate('folder', 'name path color');

        res.json({
            message: 'Material updated successfully',
            material
        });
    } catch (error) {
        console.error('Update material error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/materials/:id
// @desc    Delete material
// @access  Private (Teacher only)
router.delete('/:id', auth, isTeacher, async (req, res) => {
    try {
        const material = await Material.findOne({ _id: req.params.id, owner: req.user._id });
        
        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        // Delete file if it exists
        if (material.filePath) {
            try {
                await fs.unlink(material.filePath);
            } catch (error) {
                console.error('Error deleting file:', error);
            }
        }

        await Material.findByIdAndDelete(material._id);

        res.json({ message: 'Material deleted successfully' });
    } catch (error) {
        console.error('Delete material error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/materials/:id/download
// @desc    Download material file
// @access  Private
router.get('/:id/download', auth, async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);
        
        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        // Check access permissions
        if (req.user.role === 'student') {
            const hasAccess = material.isPublic || 
                            material.sharedWith.some(share => 
                                share.user.toString() === req.user._id.toString()
                            );
            
            if (!hasAccess) {
                return res.status(403).json({ message: 'Access denied' });
            }
        } else if (material.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (!material.filePath) {
            return res.status(400).json({ message: 'No file available for download' });
        }

        // Check if file exists
        try {
            await fs.access(material.filePath);
        } catch (error) {
            return res.status(404).json({ message: 'File not found on server' });
        }

        // Increment download count
        material.downloadCount += 1;
        await material.save();

        // Send file
        res.download(material.filePath, material.fileName);
    } catch (error) {
        console.error('Download material error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/materials/:id/share
// @desc    Share material with students
// @access  Private (Teacher only)
router.post('/:id/share', auth, isTeacher, [
    body('studentIds').isArray({ min: 1 }).withMessage('At least one student ID is required'),
    body('permission').isIn(['read', 'write']).withMessage('Invalid permission level')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const material = await Material.findOne({ _id: req.params.id, owner: req.user._id });
        
        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        const { studentIds, permission } = req.body;

        // Add students to shared list
        for (const studentId of studentIds) {
            const existingShare = material.sharedWith.find(
                share => share.user.toString() === studentId
            );

            if (!existingShare) {
                material.sharedWith.push({
                    user: studentId,
                    permission
                });
            } else {
                existingShare.permission = permission;
            }
        }

        await material.save();

        res.json({
            message: 'Material shared successfully',
            sharedWith: material.sharedWith
        });
    } catch (error) {
        console.error('Share material error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/materials/analytics/overview
// @desc    Get materials analytics overview
// @access  Private (Teacher only)
router.get('/analytics/overview', auth, isTeacher, async (req, res) => {
    try {
        const { course, grade, program } = req.query;
        
        let query = { owner: req.user._id };
        if (course) query.course = course;
        if (grade) query.grade = grade;
        if (program) query.program = program;

        // Materials by type
        const materialsByType = await Material.aggregate([
            { $match: query },
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);

        // Materials by course
        const materialsByCourse = await Material.aggregate([
            { $match: query },
            { $group: { _id: '$course', count: { $sum: 1 } } }
        ]);

        // Most viewed materials
        const mostViewed = await Material.find(query)
            .sort({ viewCount: -1 })
            .limit(10)
            .select('title type viewCount downloadCount course');

        // Most downloaded materials
        const mostDownloaded = await Material.find(query)
            .sort({ downloadCount: -1 })
            .limit(10)
            .select('title type viewCount downloadCount course');

        // Total statistics
        const totalMaterials = await Material.countDocuments(query);
        const totalViews = await Material.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$viewCount' } } }
        ]);
        const totalDownloads = await Material.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$downloadCount' } } }
        ]);

        const analytics = {
            totalMaterials,
            totalViews: totalViews[0]?.total || 0,
            totalDownloads: totalDownloads[0]?.total || 0,
            materialsByType,
            materialsByCourse,
            mostViewed,
            mostDownloaded
        };

        res.json({ analytics });
    } catch (error) {
        console.error('Get materials analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
