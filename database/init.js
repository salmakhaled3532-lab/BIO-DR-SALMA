const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    constructor(dbPath = './database/biology_platform.db') {
        this.dbPath = dbPath;
        this.db = null;
    }

    // Initialize database connection
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    // Execute SQL file
    async executeSqlFile(filePath) {
        return new Promise((resolve, reject) => {
            const sql = fs.readFileSync(filePath, 'utf8');
            
            this.db.exec(sql, (err) => {
                if (err) {
                    console.error(`Error executing ${filePath}:`, err.message);
                    reject(err);
                } else {
                    console.log(`Successfully executed ${filePath}`);
                    resolve();
                }
            });
        });
    }

    // Initialize database with schema and seed data
    async initialize() {
        try {
            await this.connect();
            
            // Create schema
            const schemaPath = path.join(__dirname, 'schema.sql');
            await this.executeSqlFile(schemaPath);
            
            // Insert seed data
            const seedPath = path.join(__dirname, 'seed.sql');
            await this.executeSqlFile(seedPath);
            
            console.log('Database initialized successfully!');
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    // Get database instance
    getDatabase() {
        return this.db;
    }

    // Close database connection
    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                    } else {
                        console.log('Database connection closed');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Run a query
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Run a single query (for INSERT, UPDATE, DELETE)
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }

    // Get a single row
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Backup database
    async backup(backupPath) {
        return new Promise((resolve, reject) => {
            const backup = this.db.backup(backupPath);
            
            backup.step(-1, (err) => {
                if (err) {
                    reject(err);
                } else {
                    backup.finish((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`Database backed up to ${backupPath}`);
                            resolve();
                        }
                    });
                }
            });
        });
    }

    // Get database statistics
    async getStats() {
        try {
            const stats = {};
            
            // Get basic counts
            const userCount = await this.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
            const courseCount = await this.get('SELECT COUNT(*) as count FROM courses WHERE is_active = 1');
            const materialCount = await this.get('SELECT COUNT(*) as count FROM materials');
            const sessionCount = await this.get('SELECT COUNT(*) as count FROM zoom_sessions WHERE date >= date("now", "-30 days")');
            
            stats.totalUsers = userCount.count;
            stats.totalCourses = courseCount.count;
            stats.totalMaterials = materialCount.count;
            stats.totalSessions = sessionCount.count;
            
            // Get student count
            const studentCount = await this.get('SELECT COUNT(*) as count FROM users WHERE role = "student" AND is_active = 1');
            stats.totalStudents = studentCount.count;
            
            return stats;
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                totalUsers: 0,
                totalCourses: 0,
                totalMaterials: 0,
                totalSessions: 0,
                totalStudents: 0
            };
        }
    }

    async getUserById(id) {
        try {
            return await this.get('SELECT * FROM users WHERE id = ?', [id]);
        } catch (error) {
            console.error('Error getting user by ID:', error);
            return null;
        }
    }

    async updateUserStatus(id, isActive) {
        try {
            const result = await this.run('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating user status:', error);
            return false;
        }
    }

    // Clean up old activity logs (keep last 30 days)
    async cleanupLogs() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const result = await this.run(
            'DELETE FROM activity_logs WHERE created_at < ?',
            [thirtyDaysAgo.toISOString()]
        );
        
        console.log(`Cleaned up ${result.changes} old activity logs`);
        return result.changes;
    }

    // Vacuum database to optimize storage
    async vacuum() {
        return new Promise((resolve, reject) => {
            this.db.run('VACUUM', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database vacuumed successfully');
                    resolve();
                }
            });
        });
    }
}

module.exports = DatabaseManager;
