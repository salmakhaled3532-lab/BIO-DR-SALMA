const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const exphbs = require('express-handlebars');
require('dotenv').config();

const DatabaseManager = require('./database/init');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database
const dbManager = new DatabaseManager();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"]
        }
    }
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './database'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Handlebars setup for admin dashboard
app.engine('handlebars', exphbs.engine({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        formatDate: (date) => new Date(date).toLocaleDateString(),
        formatDateTime: (date) => new Date(date).toLocaleString(),
        eq: (a, b) => a === b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        json: (obj) => JSON.stringify(obj),
        truncate: (str, len) => str && str.length > len ? str.substring(0, len) + '...' : str
    }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads', req.user?.id?.toString() || 'temp');
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

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        const user = await dbManager.get(
            'SELECT id, name, email, role, grade, program, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Invalid or inactive user' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Role-based middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// Activity logging middleware
const logActivity = async (req, res, next) => {
    if (req.user) {
        try {
            await dbManager.run(
                'INSERT INTO activity_logs (user_id, action, entity_type, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    req.user.id,
                    req.method + ' ' + req.path,
                    req.params.id ? 'entity' : 'general',
                    JSON.stringify({ params: req.params, query: req.query }),
                    req.ip,
                    req.get('User-Agent')
                ]
            );
        } catch (error) {
            console.error('Activity logging error:', error);
        }
    }
    next();
};

// ==================== API ROUTES ====================

// Authentication Routes
app.post('/api/auth/register', [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['teacher', 'student', 'admin']).withMessage('Invalid role')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role, grade, program, phone } = req.body;

        // Check if user exists
        const existingUser = await dbManager.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await dbManager.run(
            'INSERT INTO users (name, email, password_hash, role, grade, program, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email, passwordHash, role, grade, program, phone]
        );

        // Generate token
        const token = jwt.sign(
            { userId: result.id },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: result.id, name, email, role, grade, program }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').exists().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const user = await dbManager.get(
            'SELECT id, name, email, password_hash, role, grade, program, is_active FROM users WHERE email = ?',
            [email]
        );

        if (!user || !user.is_active) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await dbManager.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Generate token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                grade: user.grade,
                program: user.program
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// Courses Routes
app.get('/api/courses', authenticateToken, async (req, res) => {
    try {
        const courses = await dbManager.query(
            'SELECT * FROM courses WHERE is_active = 1 ORDER BY name'
        );

        // Get statistics for each course
        for (let course of courses) {
            const [materialCount, sessionCount] = await Promise.all([
                dbManager.get('SELECT COUNT(*) as count FROM materials WHERE course_id = ?', [course.id]),
                dbManager.get('SELECT COUNT(*) as count FROM zoom_sessions WHERE course_id = ?', [course.id])
            ]);
            
            course.material_count = materialCount.count;
            course.session_count = sessionCount.count;
        }

        res.json({ courses });
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Materials Routes
app.get('/api/materials', authenticateToken, logActivity, async (req, res) => {
    try {
        const { course_id, type, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT m.*, c.name as course_name, u.name as owner_name,
                   f.name as folder_name, f.path as folder_path
            FROM materials m
            LEFT JOIN courses c ON m.course_id = c.id
            LEFT JOIN users u ON m.owner_id = u.id
            LEFT JOIN folders f ON m.folder_id = f.id
            WHERE 1=1
        `;
        
        const params = [];

        // Access control
        if (req.user.role === 'student') {
            query += ` AND (m.is_public = 1 OR m.owner_id = ?)`;
            params.push(req.user.id);
        } else if (req.user.role === 'teacher') {
            query += ` AND m.owner_id = ?`;
            params.push(req.user.id);
        }

        if (course_id) {
            query += ` AND m.course_id = ?`;
            params.push(course_id);
        }

        if (type) {
            query += ` AND m.type = ?`;
            params.push(type);
        }

        if (search) {
            query += ` AND (m.title LIKE ? OR m.description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const materials = await dbManager.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM materials m WHERE 1=1`;
        const countParams = [];

        if (req.user.role === 'student') {
            countQuery += ` AND (m.is_public = 1 OR m.owner_id = ?)`;
            countParams.push(req.user.id);
        } else if (req.user.role === 'teacher') {
            countQuery += ` AND m.owner_id = ?`;
            countParams.push(req.user.id);
        }

        if (course_id) {
            countQuery += ` AND m.course_id = ?`;
            countParams.push(course_id);
        }

        if (type) {
            countQuery += ` AND m.type = ?`;
            countParams.push(type);
        }

        if (search) {
            countQuery += ` AND (m.title LIKE ? OR m.description LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const totalResult = await dbManager.get(countQuery, countParams);

        res.json({
            materials,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(totalResult.total / limit),
                total: totalResult.total
            }
        });
    } catch (error) {
        console.error('Get materials error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload material
app.post('/api/materials', authenticateToken, requireRole(['teacher', 'admin']), upload.single('file'), [
    body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
    body('course_id').isInt().withMessage('Valid course ID is required'),
    body('type').isIn(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'video', 'image', 'link', 'quiz', 'assignment']).withMessage('Invalid type')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, course_id, folder_id, type, url, grade, program, tags, is_public, priority } = req.body;

        const materialData = {
            title,
            description,
            course_id: parseInt(course_id),
            folder_id: folder_id ? parseInt(folder_id) : null,
            owner_id: req.user.id,
            type,
            grade,
            program,
            tags,
            is_public: is_public === 'true' ? 1 : 0,
            priority: priority || 'medium'
        };

        if (type === 'link') {
            materialData.url = url;
        } else if (req.file) {
            materialData.file_name = req.file.originalname;
            materialData.file_path = req.file.path;
            materialData.file_size = req.file.size;
        } else {
            return res.status(400).json({ error: 'File is required for this material type' });
        }

        const result = await dbManager.run(
            `INSERT INTO materials (title, description, type, file_name, file_path, file_size, url, 
             folder_id, course_id, owner_id, grade, program, tags, is_public, priority) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                materialData.title, materialData.description, materialData.type,
                materialData.file_name, materialData.file_path, materialData.file_size,
                materialData.url, materialData.folder_id, materialData.course_id,
                materialData.owner_id, materialData.grade, materialData.program,
                materialData.tags, materialData.is_public, materialData.priority
            ]
        );

        res.status(201).json({
            message: 'Material uploaded successfully',
            material: { id: result.id, ...materialData }
        });
    } catch (error) {
        console.error('Upload material error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== ADMIN DASHBOARD ROUTES ====================

// Dashboard home
app.get('/admin', async (req, res) => {
    try {
        const stats = await dbManager.getStats();
        
        // Get recent activities
        const recentActivities = await dbManager.query(
            `SELECT al.*, u.name as user_name 
             FROM activity_logs al 
             LEFT JOIN users u ON al.user_id = u.id 
             ORDER BY al.created_at DESC LIMIT 10`
        );

        // Get course statistics
        const courseStats = await dbManager.query(
            `SELECT c.name, c.color,
                    COUNT(DISTINCT m.id) as material_count,
                    COUNT(DISTINCT zs.id) as session_count
             FROM courses c
             LEFT JOIN materials m ON c.id = m.course_id
             LEFT JOIN zoom_sessions zs ON c.id = zs.course_id
             WHERE c.is_active = 1
             GROUP BY c.id, c.name, c.color`
        );

        res.render('admin/dashboard', {
            title: 'Admin Dashboard - Dr. Salma Biology Platform',
            stats,
            recentActivities,
            courseStats,
            layout: 'admin'
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { error: 'Server error' });
    }
});

// Users management
app.get('/admin/users', async (req, res) => {
    try {
        const { role, grade, program, search } = req.query;
        
        let query = 'SELECT * FROM users WHERE 1=1';
        const params = [];

        if (role) {
            query += ' AND role = ?';
            params.push(role);
        }

        if (grade) {
            query += ' AND grade = ?';
            params.push(grade);
        }

        if (program) {
            query += ' AND program = ?';
            params.push(program);
        }

        if (search) {
            query += ' AND (name LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY created_at DESC';

        const users = await dbManager.query(query, params);

        res.render('admin/users', {
            title: 'User Management',
            users,
            filters: { role, grade, program, search },
            layout: 'admin'
        });
    } catch (error) {
        console.error('Users page error:', error);
        res.status(500).render('error', { error: 'Server error' });
    }
});

// Materials management
app.get('/admin/materials', async (req, res) => {
    try {
        const materials = await dbManager.query(
            `SELECT m.*, c.name as course_name, u.name as owner_name
             FROM materials m
             LEFT JOIN courses c ON m.course_id = c.id
             LEFT JOIN users u ON m.owner_id = u.id
             ORDER BY m.created_at DESC`
        );

        const courses = await dbManager.query('SELECT * FROM courses WHERE is_active = 1');

        res.render('admin/materials', {
            title: 'Materials Management',
            materials,
            courses,
            layout: 'admin'
        });
    } catch (error) {
        console.error('Materials page error:', error);
        res.status(500).render('error', { error: 'Server error' });
    }
});

// Initialize database and start server
async function startServer() {
    try {
        await dbManager.initialize();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
            console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
            console.log(`🗄️ Database: SQLite (${dbManager.dbPath})`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await dbManager.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await dbManager.close();
    process.exit(0);
});

startServer();
