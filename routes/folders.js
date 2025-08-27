const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Folder = require('../models/Folder');
const Material = require('../models/Material');
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
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|mp4|avi|mov/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// @route   GET /api/folders
// @desc    Get all folders for user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { course, grade, program, parentFolder } = req.query;
        
        let query = { owner: req.user._id };
        
        if (course) query.course = course;
        if (grade) query.grade = grade;
        if (program) query.program = program;
        if (parentFolder) {
            query.parentFolder = parentFolder === 'null' ? null : parentFolder;
        }

        const folders = await Folder.find(query)
            .populate('subfolders')
            .populate('materials')
            .sort({ createdAt: -1 });

        res.json({ folders });
    } catch (error) {
        console.error('Get folders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/folders
// @desc    Create a new folder
// @access  Private (Teacher only)
router.post('/', auth, isTeacher, [
    body('name').trim().isLength({ min: 1 }).withMessage('Folder name is required'),
    body('course').isIn(['Biochemistry', 'Cell Biology', 'Animal Behavior', 'Evolution', 'Photosynthesis', 'Cell Division', 'Cell Respiration', 'General Biology']).withMessage('Invalid course'),
    body('grade').isIn(['9', '10', '11', '12']).withMessage('Invalid grade'),
    body('program').isIn(['EST', 'ACT', 'Both']).withMessage('Invalid program')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, parentFolder, course, grade, program, color, icon, isPublic, tags } = req.body;

        // Check if folder with same name exists in same parent
        const existingFolder = await Folder.findOne({
            name,
            parentFolder: parentFolder || null,
            owner: req.user._id
        });

        if (existingFolder) {
            return res.status(400).json({ message: 'Folder with this name already exists in this location' });
        }

        const folder = new Folder({
            name,
            description,
            parentFolder: parentFolder || null,
            owner: req.user._id,
            course,
            grade,
            program,
            color,
            icon,
            isPublic,
            tags
        });

        await folder.save();
        await folder.populate('subfolders materials');

        res.status(201).json({
            message: 'Folder created successfully',
            folder
        });
    } catch (error) {
        console.error('Create folder error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/folders/:id
// @desc    Update folder
// @access  Private (Teacher only)
router.put('/:id', auth, isTeacher, [
    body('name').optional().trim().isLength({ min: 1 }).withMessage('Folder name cannot be empty')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const folder = await Folder.findOne({ _id: req.params.id, owner: req.user._id });
        
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        const { name, description, color, icon, isPublic, tags } = req.body;

        if (name && name !== folder.name) {
            // Check if folder with new name exists in same parent
            const existingFolder = await Folder.findOne({
                name,
                parentFolder: folder.parentFolder,
                owner: req.user._id,
                _id: { $ne: folder._id }
            });

            if (existingFolder) {
                return res.status(400).json({ message: 'Folder with this name already exists in this location' });
            }
            folder.name = name;
        }

        if (description !== undefined) folder.description = description;
        if (color) folder.color = color;
        if (icon) folder.icon = icon;
        if (isPublic !== undefined) folder.isPublic = isPublic;
        if (tags) folder.tags = tags;

        await folder.save();
        await folder.populate('subfolders materials');

        res.json({
            message: 'Folder updated successfully',
            folder
        });
    } catch (error) {
        console.error('Update folder error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/folders/:id
// @desc    Delete folder and all contents
// @access  Private (Teacher only)
router.delete('/:id', auth, isTeacher, async (req, res) => {
    try {
        const folder = await Folder.findOne({ _id: req.params.id, owner: req.user._id });
        
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Recursively delete all subfolders and materials
        await deleteFolder(folder._id);

        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        console.error('Delete folder error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper function to recursively delete folders
async function deleteFolder(folderId) {
    // Find all subfolders
    const subfolders = await Folder.find({ parentFolder: folderId });
    
    // Recursively delete subfolders
    for (const subfolder of subfolders) {
        await deleteFolder(subfolder._id);
    }
    
    // Delete all materials in this folder
    const materials = await Material.find({ folder: folderId });
    for (const material of materials) {
        if (material.filePath) {
            try {
                await fs.unlink(material.filePath);
            } catch (error) {
                console.error('Error deleting file:', error);
            }
        }
    }
    await Material.deleteMany({ folder: folderId });
    
    // Delete the folder itself
    await Folder.findByIdAndDelete(folderId);
}

// @route   POST /api/folders/:id/materials
// @desc    Upload material to folder
// @access  Private (Teacher only)
router.post('/:id/materials', auth, isTeacher, upload.single('file'), [
    body('title').trim().isLength({ min: 1 }).withMessage('Material title is required'),
    body('type').isIn(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'video', 'image', 'link', 'quiz', 'assignment']).withMessage('Invalid material type')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const folder = await Folder.findOne({ _id: req.params.id, owner: req.user._id });
        
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        const { title, description, type, url, tags, dueDate, priority } = req.body;

        const materialData = {
            title,
            description,
            type,
            folder: folder._id,
            owner: req.user._id,
            course: folder.course,
            grade: folder.grade,
            program: folder.program,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            dueDate,
            priority
        };

        if (type === 'link') {
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

        res.status(201).json({
            message: 'Material uploaded successfully',
            material
        });
    } catch (error) {
        console.error('Upload material error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/folders/:id/materials
// @desc    Get all materials in folder
// @access  Private
router.get('/:id/materials', auth, async (req, res) => {
    try {
        const folder = await Folder.findById(req.params.id);
        
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Check access permissions
        if (folder.owner.toString() !== req.user._id.toString() && !folder.isPublic) {
            const hasAccess = folder.sharedWith.some(share => 
                share.user.toString() === req.user._id.toString()
            );
            if (!hasAccess) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const materials = await Material.find({ folder: req.params.id })
            .populate('owner', 'name email')
            .sort({ createdAt: -1 });

        res.json({ materials });
    } catch (error) {
        console.error('Get materials error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
