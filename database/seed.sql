-- Seed data for Biology Teaching Platform
-- Initial data to populate the database

-- Insert default courses based on Dr. Salma's expertise
INSERT INTO courses (name, code, description, color, icon, grade_level, program) VALUES
('Biochemistry', 'BIOCHEM', 'Advanced study of molecular structures, enzyme kinetics, and metabolic pathways fundamental to life processes.', '#e74c3c', 'flask', '12', 'Both'),
('Cell Biology', 'CELLBIO', 'Comprehensive exploration of cellular structures, organelle functions, and cellular mechanisms.', '#3498db', 'microscope', '11', 'Both'),
('Animal Behavior', 'ANBEHAV', 'Investigation of behavioral patterns, physiological responses, and neurobiological mechanisms in animals.', '#f39c12', 'paw', '10', 'Both'),
('Evolution', 'EVOLUT', 'Study of evolutionary processes, genetic variation, natural selection, and molecular evolution.', '#9b59b6', 'dna', '12', 'Both'),
('Photosynthesis', 'PHOTOS', 'Analysis of photosynthetic processes, chloroplast function, and energy conversion in plants.', '#27ae60', 'leaf', '10', 'Both'),
('Cell Division', 'CELLDIV', 'Detailed examination of mitosis, meiosis, and cellular reproduction mechanisms.', '#e67e22', 'cell', '11', 'Both'),
('Cell Respiration', 'CELLRESP', 'Study of cellular respiration, ATP synthesis, and energy metabolism in biological systems.', '#1abc9c', 'lungs', '11', 'Both'),
('General Biology', 'GENBIO', 'Foundational concepts in biology covering multiple biological disciplines and processes.', '#2c5aa0', 'book', '9', 'Both');

-- Insert default admin user (Dr. Salma Khaled)
-- Username: admin, Password: admin123
INSERT INTO users (name, email, username, password_hash, role, phone, is_active) VALUES
('Dr. Salma Khaled', 'dr.salma.khaled@bioplatform.com', 'admin', 'admin123', 'admin', '+1-555-0123', 1);

-- Insert sample teacher user
INSERT INTO users (name, email, password_hash, role, phone, is_active) VALUES
('Dr. Salma Teacher', 'teacher@bioplatform.com', '$2b$10$example_hash_replace_with_real_hash', 'teacher', '+1-555-0124', 1);

-- Insert sample students
INSERT INTO users (name, email, password_hash, role, grade, program, enrollment_date, is_active) VALUES
('Ahmed Hassan', 'ahmed.hassan@student.com', '$2b$10$example_hash_replace_with_real_hash', 'student', '12', 'EST', '2024-09-01', 1),
('Sara Mohamed', 'sara.mohamed@student.com', '$2b$10$example_hash_replace_with_real_hash', 'student', '11', 'ACT', '2024-09-01', 1),
('Omar Ali', 'omar.ali@student.com', '$2b$10$example_hash_replace_with_real_hash', 'student', '12', 'Both', '2024-09-01', 1),
('Fatima Ibrahim', 'fatima.ibrahim@student.com', '$2b$10$example_hash_replace_with_real_hash', 'student', '10', 'EST', '2024-09-01', 1),
('Youssef Mahmoud', 'youssef.mahmoud@student.com', '$2b$10$example_hash_replace_with_real_hash', 'student', '11', 'ACT', '2024-09-01', 1);

-- Insert sample folders for each course
INSERT INTO folders (name, description, course_id, owner_id, path, color, icon, is_public) VALUES
('Lecture Materials', 'Main folder for lecture presentations and notes', 1, 1, 'Lecture Materials', '#e74c3c', 'presentation', 1),
('Lab Experiments', 'Laboratory experiment guides and results', 1, 1, 'Lab Experiments', '#c0392b', 'flask', 1),
('Assignments', 'Course assignments and homework', 1, 1, 'Assignments', '#8e44ad', 'tasks', 0),
('Cell Structure', 'Materials about cellular components', 2, 1, 'Cell Structure', '#3498db', 'cell', 1),
('Organelles', 'Detailed study of cellular organelles', 2, 1, 'Organelles', '#2980b9', 'microscope', 1),
('Behavioral Studies', 'Animal behavior research and case studies', 3, 1, 'Behavioral Studies', '#f39c12', 'brain', 1),
('Ethology', 'Study of animal behavior in natural environments', 3, 1, 'Ethology', '#e67e22', 'paw', 1),
('Natural Selection', 'Materials on natural selection processes', 4, 1, 'Natural Selection', '#9b59b6', 'chart-line', 1),
('Genetic Variation', 'Studies on genetic diversity and mutations', 4, 1, 'Genetic Variation', '#8e44ad', 'dna', 1),
('Light Reactions', 'Photosynthesis light-dependent reactions', 5, 1, 'Light Reactions', '#27ae60', 'sun', 1),
('Calvin Cycle', 'Carbon fixation and Calvin cycle processes', 5, 1, 'Calvin Cycle', '#229954', 'leaf', 1),
('Mitosis', 'Mitotic cell division materials', 6, 1, 'Mitosis', '#e67e22', 'cell', 1),
('Meiosis', 'Meiotic cell division and gamete formation', 6, 1, 'Meiosis', '#d35400', 'dna', 1),
('Glycolysis', 'Glucose breakdown and energy production', 7, 1, 'Glycolysis', '#1abc9c', 'battery', 1),
('Krebs Cycle', 'Citric acid cycle and ATP synthesis', 7, 1, 'Krebs Cycle', '#16a085', 'recycle', 1),
('Introduction to Biology', 'Basic biological concepts and principles', 8, 1, 'Introduction to Biology', '#2c5aa0', 'book-open', 1);

-- Insert sample materials
INSERT INTO materials (title, description, type, file_name, course_id, folder_id, owner_id, grade, program, tags, is_public, priority) VALUES
('Biochemistry Fundamentals', 'Introduction to biochemical processes and molecular structures', 'pdf', 'biochemistry_fundamentals.pdf', 1, 1, 1, '12', 'Both', '["biochemistry", "molecules", "fundamentals"]', 1, 'high'),
('Enzyme Kinetics Lab', 'Laboratory exercise on enzyme activity and kinetics', 'pdf', 'enzyme_kinetics_lab.pdf', 1, 2, 1, '12', 'Both', '["enzymes", "kinetics", "lab"]', 1, 'medium'),
('Cell Membrane Structure', 'Detailed study of cell membrane composition and function', 'ppt', 'cell_membrane.pptx', 2, 4, 1, '11', 'Both', '["cell", "membrane", "structure"]', 1, 'high'),
('Mitochondria Function', 'PowerPoint on mitochondrial structure and ATP production', 'ppt', 'mitochondria.pptx', 2, 5, 1, '11', 'Both', '["mitochondria", "ATP", "organelles"]', 1, 'high'),
('Animal Communication', 'Study of communication methods in animal species', 'pdf', 'animal_communication.pdf', 3, 6, 1, '10', 'Both', '["communication", "behavior", "animals"]', 1, 'medium'),
('Primate Behavior Study', 'Research on primate social behaviors and hierarchies', 'pdf', 'primate_behavior.pdf', 3, 7, 1, '10', 'Both', '["primates", "social", "behavior"]', 1, 'medium'),
('Darwin\'s Theory', 'Comprehensive overview of evolutionary theory', 'pdf', 'darwin_theory.pdf', 4, 8, 1, '12', 'Both', '["darwin", "evolution", "theory"]', 1, 'high'),
('Genetic Mutations', 'Types and effects of genetic mutations on evolution', 'pdf', 'genetic_mutations.pdf', 4, 9, 1, '12', 'Both', '["mutations", "genetics", "evolution"]', 1, 'high'),
('Photosystem I and II', 'Detailed explanation of photosynthetic light reactions', 'ppt', 'photosystems.pptx', 5, 10, 1, '10', 'Both', '["photosynthesis", "light reactions", "photosystems"]', 1, 'high'),
('Carbon Fixation Process', 'Calvin cycle and carbon dioxide fixation mechanisms', 'pdf', 'calvin_cycle.pdf', 5, 11, 1, '10', 'Both', '["calvin cycle", "carbon fixation", "photosynthesis"]', 1, 'high'),
('Mitotic Phases', 'Step-by-step guide through mitotic cell division', 'ppt', 'mitotic_phases.pptx', 6, 12, 1, '11', 'Both', '["mitosis", "cell division", "phases"]', 1, 'high'),
('Meiosis and Gametes', 'Meiotic division and gamete formation process', 'pdf', 'meiosis_gametes.pdf', 6, 13, 1, '11', 'Both', '["meiosis", "gametes", "reproduction"]', 1, 'high'),
('Cellular Respiration Overview', 'Complete overview of cellular respiration processes', 'pdf', 'cellular_respiration.pdf', 7, 14, 1, '11', 'Both', '["respiration", "ATP", "metabolism"]', 1, 'high'),
('Electron Transport Chain', 'Detailed study of electron transport and ATP synthesis', 'ppt', 'electron_transport.pptx', 7, 15, 1, '11', 'Both', '["electron transport", "ATP", "mitochondria"]', 1, 'high'),
('Biology Basics', 'Fundamental concepts in biology for beginners', 'pdf', 'biology_basics.pdf', 8, 16, 1, '9', 'Both', '["biology", "basics", "fundamentals"]', 1, 'high');

-- Insert sample assignments
INSERT INTO assignments (title, description, course_id, teacher_id, due_date, max_score, grade, program, is_published) VALUES
('Biochemistry Lab Report', 'Complete lab report on enzyme kinetics experiment', 1, 1, '2024-12-15 23:59:59', 100, '12', 'Both', 1),
('Cell Structure Diagram', 'Create detailed diagram of plant and animal cells', 2, 1, '2024-12-10 23:59:59', 50, '11', 'Both', 1),
('Animal Behavior Observation', 'Observe and document animal behavior patterns', 3, 1, '2024-12-20 23:59:59', 75, '10', 'Both', 1),
('Evolution Timeline', 'Create timeline of major evolutionary events', 4, 1, '2024-12-18 23:59:59', 60, '12', 'Both', 1),
('Photosynthesis Experiment', 'Design experiment to measure photosynthetic rate', 5, 1, '2024-12-12 23:59:59', 80, '10', 'Both', 1);

-- Insert sample announcements
INSERT INTO announcements (title, content, course_id, author_id, grade, program, priority, is_published) VALUES
('Welcome to Biochemistry!', 'Welcome to our advanced biochemistry course. Please review the syllabus and prepare for our first lab session.', 1, 1, '12', 'Both', 'high', 1),
('Cell Biology Lab Schedule', 'Lab sessions will be held every Tuesday and Thursday. Please bring your lab notebooks.', 2, 1, '11', 'Both', 'medium', 1),
('Field Trip Announcement', 'We will be visiting the local zoo for animal behavior observation next Friday.', 3, 1, '10', 'Both', 'high', 1),
('Evolution Exam Date', 'The midterm exam for Evolution will be held on December 15th. Study guide available online.', 4, 1, '12', 'Both', 'urgent', 1),
('Photosynthesis Project Due', 'Reminder: Your photosynthesis research projects are due next week.', 5, 1, '10', 'Both', 'medium', 1);

-- Insert sample zoom sessions
INSERT INTO zoom_sessions (title, description, course_id, teacher_id, zoom_meeting_id, zoom_password, join_url, start_url, scheduled_time, duration, grade, program, status) VALUES
('Biochemistry Lecture 1', 'Introduction to biochemical processes and molecular interactions', 1, 1, '123456789', 'bio2024', 'https://zoom.us/j/123456789', 'https://zoom.us/s/123456789', '2024-12-01 10:00:00', 90, '12', 'Both', 'scheduled'),
('Cell Biology Lab Session', 'Virtual microscopy and cell structure identification', 2, 1, '987654321', 'cell2024', 'https://zoom.us/j/987654321', 'https://zoom.us/s/987654321', '2024-12-02 14:00:00', 120, '11', 'Both', 'scheduled'),
('Animal Behavior Discussion', 'Group discussion on recent animal behavior research', 3, 1, '456789123', 'animal24', 'https://zoom.us/j/456789123', 'https://zoom.us/s/456789123', '2024-12-03 11:00:00', 60, '10', 'Both', 'scheduled'),
('Evolution Seminar', 'Advanced topics in evolutionary biology and genetics', 4, 1, '789123456', 'evol2024', 'https://zoom.us/j/789123456', 'https://zoom.us/s/789123456', '2024-12-04 15:00:00', 75, '12', 'Both', 'scheduled'),
('Photosynthesis Workshop', 'Hands-on workshop on photosynthetic processes', 5, 1, '321654987', 'photo24', 'https://zoom.us/j/321654987', 'https://zoom.us/s/321654987', '2024-12-05 13:00:00', 90, '10', 'Both', 'scheduled');

-- Insert default settings
INSERT INTO settings (key, value, description, type) VALUES
('site_name', 'Dr. Salma Biology Platform', 'Website name displayed in header', 'string'),
('site_description', 'Advanced Biology Education for EST/ACT Students', 'Website description for SEO', 'string'),
('contact_email', 'info@drsalma.com', 'Main contact email address', 'string'),
('contact_phone', '+1 (555) 123-4567', 'Main contact phone number', 'string'),
('max_file_size', '10485760', 'Maximum file upload size in bytes (10MB)', 'number'),
('session_timeout', '7200', 'User session timeout in seconds (2 hours)', 'number'),
('enable_zoom', 'true', 'Enable Zoom integration features', 'boolean'),
('enable_notifications', 'true', 'Enable email notifications', 'boolean'),
('default_grade', '12', 'Default grade level for new content', 'string'),
('default_program', 'Both', 'Default program for new content', 'string'),
('theme_color', '#2c5aa0', 'Primary theme color', 'string'),
('items_per_page', '20', 'Default number of items per page', 'number'),
('backup_frequency', '24', 'Database backup frequency in hours', 'number'),
('maintenance_mode', 'false', 'Enable maintenance mode', 'boolean');

-- Initialize student progress for sample students
INSERT INTO student_progress (student_id, course_id, materials_viewed, sessions_attended, progress_percentage) VALUES
(3, 1, 5, 2, 25.50),
(3, 4, 3, 1, 15.75),
(4, 2, 8, 3, 45.25),
(4, 6, 4, 2, 30.00),
(5, 3, 6, 2, 35.80),
(5, 7, 7, 3, 50.25),
(6, 5, 4, 1, 20.00),
(6, 8, 10, 4, 65.75),
(7, 2, 5, 2, 28.50),
(7, 6, 3, 1, 18.25);
