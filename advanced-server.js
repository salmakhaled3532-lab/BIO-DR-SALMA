const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const { v4: uuidv4 } = require('crypto').randomUUID || (() => Math.random().toString(36));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// In-memory storage for uploaded files (in production, use a database)
let uploadedFiles = [];

// MIME type mapping
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain'
};

// Allowed file types for upload
const allowedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.mp4', '.avi', '.mov', '.wmv', '.jpg', '.jpeg', '.png', '.gif', '.txt'];

// Helper function to parse multipart form data
function parseMultipartData(data, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from('--' + boundary);
    let start = 0;
    
    while (true) {
        const boundaryIndex = data.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;
        
        const nextBoundaryIndex = data.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
        if (nextBoundaryIndex === -1) break;
        
        const partData = data.slice(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex);
        const headerEndIndex = partData.indexOf('\r\n\r\n');
        
        if (headerEndIndex !== -1) {
            const headers = partData.slice(0, headerEndIndex).toString();
            const content = partData.slice(headerEndIndex + 4);
            
            const nameMatch = headers.match(/name="([^"]+)"/);
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            
            if (nameMatch) {
                parts.push({
                    name: nameMatch[1],
                    filename: filenameMatch ? filenameMatch[1] : null,
                    data: content.slice(0, content.length - 2) // Remove trailing \r\n
                });
            }
        }
        
        start = nextBoundaryIndex;
    }
    
    return parts;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Set CORS headers and CSP
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'");

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
        
        // Upload file endpoint
        if (pathname === '/api/upload' && method === 'POST') {
            let body = Buffer.alloc(0);
            
            req.on('data', chunk => {
                body = Buffer.concat([body, chunk]);
            });
            
            req.on('end', () => {
                try {
                    const contentType = req.headers['content-type'];
                    const boundary = contentType.split('boundary=')[1];
                    
                    if (!boundary) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid content type' }));
                        return;
                    }
                    
                    const parts = parseMultipartData(body, boundary);
                    const filePart = parts.find(part => part.filename);
                    const titlePart = parts.find(part => part.name === 'title');
                    const descriptionPart = parts.find(part => part.name === 'description');
                    const categoryPart = parts.find(part => part.name === 'category');
                    
                    if (!filePart) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'No file uploaded' }));
                        return;
                    }
                    
                    const fileExt = path.extname(filePart.filename).toLowerCase();
                    
                    if (!allowedTypes.includes(fileExt)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'File type not allowed' }));
                        return;
                    }
                    
                    // Generate unique filename
                    const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    const filename = uniqueId + fileExt;
                    const filepath = path.join(uploadsDir, filename);
                    
                    // Save file
                    fs.writeFileSync(filepath, filePart.data);
                    
                    // Store file metadata
                    const fileInfo = {
                        id: uniqueId,
                        originalName: filePart.filename,
                        filename: filename,
                        path: filepath,
                        size: filePart.data.length,
                        type: fileExt.slice(1),
                        mimeType: mimeTypes[fileExt] || 'application/octet-stream',
                        title: titlePart ? titlePart.data.toString() : filePart.filename,
                        description: descriptionPart ? descriptionPart.data.toString() : '',
                        category: categoryPart ? categoryPart.data.toString() : 'general',
                        uploadDate: new Date().toISOString(),
                        downloadCount: 0
                    };
                    
                    uploadedFiles.push(fileInfo);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'File uploaded successfully',
                        file: fileInfo
                    }));
                    
                } catch (error) {
                    console.error('Upload error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Upload failed' }));
                }
            });
            
            return;
        }
        
        // Get all files endpoint
        if (pathname === '/api/files' && method === 'GET') {
            const category = parsedUrl.query.category;
            const search = parsedUrl.query.search;
            
            let filteredFiles = uploadedFiles;
            
            if (category && category !== 'all') {
                filteredFiles = filteredFiles.filter(file => file.category === category);
            }
            
            if (search) {
                filteredFiles = filteredFiles.filter(file => 
                    file.title.toLowerCase().includes(search.toLowerCase()) ||
                    file.description.toLowerCase().includes(search.toLowerCase()) ||
                    file.originalName.toLowerCase().includes(search.toLowerCase())
                );
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                files: filteredFiles.map(file => ({
                    ...file,
                    formattedSize: formatFileSize(file.size),
                    downloadUrl: `/api/download/${file.id}`
                }))
            }));
            return;
        }
        
        // Download file endpoint
        if (pathname.startsWith('/api/download/') && method === 'GET') {
            const fileId = pathname.split('/api/download/')[1];
            const file = uploadedFiles.find(f => f.id === fileId);
            
            if (!file) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found' }));
                return;
            }
            
            if (!fs.existsSync(file.path)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found on disk' }));
                return;
            }
            
            // Increment download count
            file.downloadCount++;
            
            res.writeHead(200, {
                'Content-Type': file.mimeType,
                'Content-Disposition': `attachment; filename="${file.originalName}"`,
                'Content-Length': file.size
            });
            
            const fileStream = fs.createReadStream(file.path);
            fileStream.pipe(res);
            return;
        }
        
        // Delete file endpoint
        if (pathname.startsWith('/api/delete/') && method === 'DELETE') {
            const fileId = pathname.split('/api/delete/')[1];
            const fileIndex = uploadedFiles.findIndex(f => f.id === fileId);
            
            if (fileIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found' }));
                return;
            }
            
            const file = uploadedFiles[fileIndex];
            
            // Delete file from disk
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            
            // Remove from memory
            uploadedFiles.splice(fileIndex, 1);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'File deleted successfully' }));
            return;
        }
        
        // Get file statistics
        if (pathname === '/api/stats' && method === 'GET') {
            const stats = {
                totalFiles: uploadedFiles.length,
                totalSize: uploadedFiles.reduce((sum, file) => sum + file.size, 0),
                fileTypes: {},
                categories: {},
                recentUploads: uploadedFiles.slice(-5).reverse()
            };
            
            uploadedFiles.forEach(file => {
                stats.fileTypes[file.type] = (stats.fileTypes[file.type] || 0) + 1;
                stats.categories[file.category] = (stats.categories[file.category] || 0) + 1;
            });
            
            stats.formattedTotalSize = formatFileSize(stats.totalSize);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, stats }));
            return;
        }
    }
    
    // Static file serving
    let filePath = pathname === '/' ? '/index.html' : pathname;
    
    // Route mappings
    if (pathname === '/upload') {
        filePath = '/upload.html';
    } else if (pathname === '/viewer') {
        filePath = '/viewer.html';
    } else if (pathname === '/login') {
        filePath = '/login.html';
    } else if (pathname === '/register') {
        filePath = '/register.html';
    } else if (pathname === '/exams' || pathname === '/lectures') {
        filePath = '/lectures.html';
    } else if (pathname === '/admin-dashboard') {
        filePath = '/admin-dashboard.html';
    } else if (pathname === '/test-user-creation') {
        filePath = '/test-user-creation.html';
    }
    
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);
    const contentType = mimeTypes[ext] || 'text/plain';
    
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <h1>404 - File Not Found</h1>
                    <p>The requested file ${pathname} was not found.</p>
                    <p><a href="/">Go to Homepage</a> | <a href="/upload">File Upload</a></p>
                `);
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log('🚀 Advanced File Upload Server Running!');
    console.log(`📱 Website: http://localhost:${PORT}`);
    console.log(`📤 File Upload: http://localhost:${PORT}/upload`);
    console.log(`📁 Upload Directory: ${uploadsDir}`);
    console.log('\n✅ Ready for file uploads (Videos, PDFs, Documents)!');
    console.log('📋 Supported formats: PDF, DOC, DOCX, PPT, PPTX, MP4, AVI, MOV, WMV, JPG, PNG, GIF, TXT');
});
