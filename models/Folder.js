const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    parentFolder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: String,
        enum: ['Biochemistry', 'Cell Biology', 'Animal Behavior', 'Evolution', 'Photosynthesis', 'Cell Division', 'Cell Respiration', 'General Biology'],
        required: true
    },
    grade: {
        type: String,
        enum: ['9', '10', '11', '12'],
        required: true
    },
    program: {
        type: String,
        enum: ['EST', 'ACT', 'Both'],
        required: true
    },
    color: {
        type: String,
        default: '#2c5aa0'
    },
    icon: {
        type: String,
        default: 'folder'
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    sharedWith: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        permission: {
            type: String,
            enum: ['read', 'write', 'admin'],
            default: 'read'
        }
    }],
    tags: [{
        type: String,
        trim: true
    }],
    path: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Create path before saving
folderSchema.pre('save', async function(next) {
    if (this.parentFolder) {
        const parent = await this.constructor.findById(this.parentFolder);
        this.path = `${parent.path}/${this.name}`;
    } else {
        this.path = this.name;
    }
    next();
});

// Virtual for subfolders
folderSchema.virtual('subfolders', {
    ref: 'Folder',
    localField: '_id',
    foreignField: 'parentFolder'
});

// Virtual for materials
folderSchema.virtual('materials', {
    ref: 'Material',
    localField: '_id',
    foreignField: 'folder'
});

folderSchema.set('toJSON', { virtuals: true });
folderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Folder', folderSchema);
