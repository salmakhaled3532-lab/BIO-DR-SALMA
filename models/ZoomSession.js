const mongoose = require('mongoose');

const zoomSessionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
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
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    zoomMeetingId: {
        type: String,
        required: true
    },
    zoomPassword: {
        type: String
    },
    joinUrl: {
        type: String,
        required: true
    },
    startUrl: {
        type: String,
        required: true
    },
    scheduledTime: {
        type: Date,
        required: true
    },
    duration: {
        type: Number, // in minutes
        required: true,
        default: 60
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    status: {
        type: String,
        enum: ['scheduled', 'started', 'ended', 'cancelled'],
        default: 'scheduled'
    },
    attendees: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: Date,
        leftAt: Date,
        duration: Number // in minutes
    }],
    recordingUrl: {
        type: String
    },
    materials: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material'
    }],
    isRecorded: {
        type: Boolean,
        default: false
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurrencePattern: {
        type: {
            type: String,
            enum: ['daily', 'weekly', 'monthly']
        },
        interval: Number, // every X days/weeks/months
        endDate: Date,
        daysOfWeek: [Number] // 0-6, Sunday-Saturday
    },
    waitingRoom: {
        type: Boolean,
        default: true
    },
    requirePassword: {
        type: Boolean,
        default: true
    },
    allowJoinBeforeHost: {
        type: Boolean,
        default: false
    },
    muteOnEntry: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for efficient queries
zoomSessionSchema.index({ teacher: 1, scheduledTime: 1 });
zoomSessionSchema.index({ course: 1, grade: 1, program: 1 });
zoomSessionSchema.index({ status: 1, scheduledTime: 1 });

module.exports = mongoose.model('ZoomSession', zoomSessionSchema);
