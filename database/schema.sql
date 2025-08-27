-- Biology Teaching Platform Database Schema
-- SQLite Database for Dr. Salma's Website

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table (Teachers and Students)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK(role IN ('teacher', 'student', 'admin')) DEFAULT 'student',
    avatar VARCHAR(255),
    phone VARCHAR(20),
    grade VARCHAR(2) CHECK(grade IN ('9', '10', '11', '12')),
    program VARCHAR(10) CHECK(program IN ('EST', 'ACT', 'Both')),
    enrollment_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#2c5aa0',
    icon VARCHAR(50) DEFAULT 'book',
    grade_level VARCHAR(2) CHECK(grade_level IN ('9', '10', '11', '12')),
    program VARCHAR(10) CHECK(program IN ('EST', 'ACT', 'Both')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Folders table (Hierarchical structure)
CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER,
    course_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    path VARCHAR(500),
    color VARCHAR(7) DEFAULT '#2c5aa0',
    icon VARCHAR(50) DEFAULT 'folder',
    is_public BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Materials table (Files, documents, links)
CREATE TABLE materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20) CHECK(type IN ('pdf', 'doc', 'docx', 'ppt', 'pptx', 'video', 'image', 'link', 'quiz', 'assignment')) NOT NULL,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INTEGER,
    url TEXT,
    folder_id INTEGER,
    course_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    grade VARCHAR(2) CHECK(grade IN ('9', '10', '11', '12')),
    program VARCHAR(10) CHECK(program IN ('EST', 'ACT', 'Both')),
    tags TEXT, -- JSON array of tags
    is_public BOOLEAN DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    due_date DATE,
    priority VARCHAR(10) CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Zoom sessions table
CREATE TABLE zoom_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    course_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    zoom_meeting_id VARCHAR(50) UNIQUE NOT NULL,
    zoom_password VARCHAR(20),
    join_url TEXT NOT NULL,
    start_url TEXT NOT NULL,
    scheduled_time DATETIME NOT NULL,
    duration INTEGER DEFAULT 60, -- minutes
    timezone VARCHAR(50) DEFAULT 'UTC',
    status VARCHAR(20) CHECK(status IN ('scheduled', 'started', 'ended', 'cancelled')) DEFAULT 'scheduled',
    recording_url TEXT,
    is_recorded BOOLEAN DEFAULT 0,
    is_recurring BOOLEAN DEFAULT 0,
    recurrence_pattern TEXT, -- JSON for recurrence settings
    waiting_room BOOLEAN DEFAULT 1,
    require_password BOOLEAN DEFAULT 1,
    allow_join_before_host BOOLEAN DEFAULT 0,
    mute_on_entry BOOLEAN DEFAULT 1,
    grade VARCHAR(2) CHECK(grade IN ('9', '10', '11', '12')),
    program VARCHAR(10) CHECK(program IN ('EST', 'ACT', 'Both')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Session attendees table
CREATE TABLE session_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    joined_at DATETIME,
    left_at DATETIME,
    duration INTEGER, -- minutes attended
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES zoom_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(session_id, student_id)
);

-- Session materials (many-to-many)
CREATE TABLE session_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES zoom_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    UNIQUE(session_id, material_id)
);

-- Material sharing table
CREATE TABLE material_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission VARCHAR(10) CHECK(permission IN ('read', 'write', 'admin')) DEFAULT 'read',
    shared_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(material_id, user_id)
);

-- Folder sharing table
CREATE TABLE folder_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission VARCHAR(10) CHECK(permission IN ('read', 'write', 'admin')) DEFAULT 'read',
    shared_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(folder_id, user_id)
);

-- Student progress tracking
CREATE TABLE student_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    materials_viewed INTEGER DEFAULT 0,
    materials_downloaded INTEGER DEFAULT 0,
    sessions_attended INTEGER DEFAULT 0,
    total_study_time INTEGER DEFAULT 0, -- minutes
    last_activity DATETIME,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(student_id, course_id)
);

-- Assignments table
CREATE TABLE assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    course_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    material_id INTEGER,
    due_date DATETIME NOT NULL,
    max_score INTEGER DEFAULT 100,
    grade VARCHAR(2) CHECK(grade IN ('9', '10', '11', '12')),
    program VARCHAR(10) CHECK(program IN ('EST', 'ACT', 'Both')),
    is_published BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL
);

-- Assignment submissions table
CREATE TABLE assignment_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INTEGER,
    submission_text TEXT,
    score INTEGER,
    feedback TEXT,
    status VARCHAR(20) CHECK(status IN ('submitted', 'graded', 'late', 'missing')) DEFAULT 'submitted',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    graded_at DATETIME,
    graded_by INTEGER,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(assignment_id, student_id)
);

-- Announcements table
CREATE TABLE announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    course_id INTEGER,
    author_id INTEGER NOT NULL,
    grade VARCHAR(2) CHECK(grade IN ('9', '10', '11', '12')),
    program VARCHAR(10) CHECK(program IN ('EST', 'ACT', 'Both')),
    priority VARCHAR(10) CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    is_published BOOLEAN DEFAULT 1,
    publish_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    expire_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity logs table
CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50), -- 'material', 'session', 'assignment', etc.
    entity_id INTEGER,
    details TEXT, -- JSON with additional details
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Website settings table
CREATE TABLE settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    type VARCHAR(20) CHECK(type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_grade_program ON users(grade, program);
CREATE INDEX idx_folders_course_owner ON folders(course_id, owner_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_materials_course ON materials(course_id);
CREATE INDEX idx_materials_folder ON materials(folder_id);
CREATE INDEX idx_materials_owner ON materials(owner_id);
CREATE INDEX idx_materials_type ON materials(type);
CREATE INDEX idx_zoom_sessions_teacher ON zoom_sessions(teacher_id);
CREATE INDEX idx_zoom_sessions_course ON zoom_sessions(course_id);
CREATE INDEX idx_zoom_sessions_scheduled ON zoom_sessions(scheduled_time);
CREATE INDEX idx_session_attendees_session ON session_attendees(session_id);
CREATE INDEX idx_session_attendees_student ON session_attendees(student_id);
CREATE INDEX idx_student_progress_student ON student_progress(student_id);
CREATE INDEX idx_student_progress_course ON student_progress(course_id);
CREATE INDEX idx_assignments_course ON assignments(course_id);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
CREATE INDEX idx_assignment_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_assignment_submissions_student ON assignment_submissions(student_id);
CREATE INDEX idx_announcements_course ON announcements(course_id);
CREATE INDEX idx_announcements_published ON announcements(is_published, publish_date);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_courses_timestamp 
    AFTER UPDATE ON courses
    BEGIN
        UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_folders_timestamp 
    AFTER UPDATE ON folders
    BEGIN
        UPDATE folders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_materials_timestamp 
    AFTER UPDATE ON materials
    BEGIN
        UPDATE materials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_zoom_sessions_timestamp 
    AFTER UPDATE ON zoom_sessions
    BEGIN
        UPDATE zoom_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_student_progress_timestamp 
    AFTER UPDATE ON student_progress
    BEGIN
        UPDATE student_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_assignments_timestamp 
    AFTER UPDATE ON assignments
    BEGIN
        UPDATE assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_announcements_timestamp 
    AFTER UPDATE ON announcements
    BEGIN
        UPDATE announcements SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_settings_timestamp 
    AFTER UPDATE ON settings
    BEGIN
        UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
