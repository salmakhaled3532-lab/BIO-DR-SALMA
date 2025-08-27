const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'video', 'image', 'link', 'quiz', 'assignment'],
        required: true
    },
    fileName: {
        type: String,
        required: function() {
            return this.type !== 'link';
        }
    },
    filePath: {
        type: String,
        required: function() {
            return this.type !== 'link';
        }
    },
    fileSize: {
        type: Number
    },
    url: {
        type: String,
        required: function() {
            return this.type === 'link';
        }
    },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        required: true
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
    tags: [{
        type: String,
        trim: true
    }],
    isPublic: {
        type: Boolean,
        default: false
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    },
    dueDate: {
        type: Date
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    }
}, {
    timestamps: true
});

// Index for search functionality
materialSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Material', materialSchema);
