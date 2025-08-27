const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Simple MIME type mapping
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // Default to index.html
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    // Admin dashboard route
    if (pathname === '/admin') {
        pathname = '/test-frontend.html';
    }
    
    const filePath = path.join(__dirname, pathname);
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <h1>404 - File Not Found</h1>
                    <p>The requested file ${pathname} was not found.</p>
                    <p><a href="/">Go to Homepage</a></p>
                    <p><a href="/admin">Go to Admin Test</a></p>
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
    console.log('🚀 Dr. Salma Biology Platform Server Running!');
    console.log(`📱 Website: http://localhost:${PORT}`);
    console.log(`⚙️  Admin Test: http://localhost:${PORT}/admin`);
    console.log(`📁 Files: Serving from ${__dirname}`);
    console.log('\n✅ Your project is now running!');
});
