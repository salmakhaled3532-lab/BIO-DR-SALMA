# Biology Teaching Platform - Dr. Salma

A comprehensive backend system for managing biology courses, materials, and Zoom sessions for American diploma EST/ACT students.

## Features

### 🔬 Course Management
- **8 Biology Courses**: Biochemistry, Cell Biology, Animal Behavior, Evolution, Photosynthesis, Cell Division, Cell Respiration, General Biology
- **Grade Levels**: 9th, 10th, 11th, 12th grade support
- **Programs**: EST, ACT, or Both programs

### 📁 Folder & Material Management
- Hierarchical folder structure for organizing course materials
- File upload support (PDF, DOC, PPT, videos, images)
- Material sharing with students
- Bulk organization tools
- Search functionality

### 🎥 Zoom Integration
- Create and manage Zoom sessions
- Student attendance tracking
- Session recording management
- Material attachment to sessions

### 👥 Student Management
- Student registration and profiles
- Progress tracking and analytics
- Bulk student invitation
- Grade and program-based access control

### 🔐 Authentication & Security
- JWT-based authentication
- Role-based access control (Teacher/Student)
- Secure file uploads
- Rate limiting

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Folders
- `GET /api/folders` - Get folders
- `POST /api/folders` - Create folder
- `PUT /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder
- `POST /api/folders/:id/materials` - Upload material to folder

### Materials
- `GET /api/materials` - Get materials with filtering
- `POST /api/materials` - Create material
- `PUT /api/materials/:id` - Update material
- `DELETE /api/materials/:id` - Delete material
- `GET /api/materials/:id/download` - Download material
- `POST /api/materials/:id/share` - Share material

### Zoom Sessions
- `GET /api/zoom/sessions` - Get sessions
- `POST /api/zoom/sessions` - Create session
- `PUT /api/zoom/sessions/:id` - Update session
- `DELETE /api/zoom/sessions/:id` - Delete session
- `POST /api/zoom/sessions/:id/join` - Join session

### Students
- `GET /api/students` - Get students (Teacher only)
- `GET /api/students/:id` - Get student details
- `PUT /api/students/:id` - Update student
- `GET /api/students/:id/progress` - Get student progress
- `POST /api/students/bulk-invite` - Bulk invite students

### Courses
- `GET /api/courses` - Get all courses
- `GET /api/courses/:course` - Get course details
- `GET /api/courses/:course/materials` - Get course materials
- `GET /api/courses/:course/sessions` - Get course sessions
- `GET /api/courses/:course/analytics` - Get course analytics

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Zoom API credentials (optional)

### Setup

1. **Install dependencies**
```bash
npm install
```

2. **Environment Configuration**
Create a `.env` file with the following variables:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/bio-teaching-platform

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Zoom API (Optional)
ZOOM_API_KEY=your_zoom_api_key
ZOOM_API_SECRET=your_zoom_api_secret
ZOOM_JWT_TOKEN=your_zoom_jwt_token

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

3. **Start MongoDB**
Make sure MongoDB is running on your system.

4. **Run the application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Database Models

### User
- Authentication and profile information
- Role-based access (teacher/student)
- Student-specific information (grade, program)

### Folder
- Hierarchical folder structure
- Course and grade organization
- Sharing permissions

### Material
- File and link management
- Course categorization
- View/download tracking

### ZoomSession
- Zoom meeting integration
- Attendance tracking
- Material attachments

## File Upload Support

Supported file types:
- **Documents**: PDF, DOC, DOCX, TXT
- **Presentations**: PPT, PPTX
- **Images**: JPEG, JPG, PNG, GIF
- **Videos**: MP4, AVI, MOV
- **Spreadsheets**: XLSX, XLS

Maximum file size: 10MB (configurable)

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Teacher and student role separation
- **File Validation**: Strict file type and size validation
- **Rate Limiting**: API request rate limiting
- **CORS Protection**: Cross-origin request security
- **Helmet Security**: HTTP security headers

## Course Structure

The platform supports Dr. Salma's biology expertise areas:

1. **Biochemistry** - Molecular structures and metabolic pathways
2. **Cell Biology** - Cellular structures and mechanisms
3. **Animal Behavior** - Behavioral biology and physiology
4. **Evolution** - Evolutionary processes and genetics
5. **Photosynthesis** - Plant energy conversion systems
6. **Cell Division** - Mitosis and meiosis mechanisms
7. **Cell Respiration** - Cellular energy metabolism
8. **General Biology** - Foundational biological concepts

## Development

### Project Structure
```
├── models/           # Database models
├── routes/           # API routes
├── middleware/       # Custom middleware
├── uploads/          # File uploads directory
├── server.js         # Main server file
├── package.json      # Dependencies
└── .env             # Environment variables
```

### Adding New Features
1. Create model in `models/` directory
2. Add routes in `routes/` directory
3. Update `server.js` to include new routes
4. Test endpoints with appropriate authentication

## Deployment

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Configure production MongoDB URI
- Set up proper email service
- Configure Zoom API credentials

### Recommended Deployment Platforms
- **Heroku**: Easy deployment with MongoDB Atlas
- **DigitalOcean**: VPS with Docker
- **AWS**: EC2 with RDS/DocumentDB
- **Vercel**: Serverless deployment

## Support

For questions or issues related to the biology teaching platform, contact Dr. Salma or the development team.

## License

This project is licensed under the MIT License.
