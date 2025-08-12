const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class AdminService {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, 'anon_connect.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.adminCredentials = {
            username: 'admin123',
            email: 'admin@gmail.com',
            password: 'admin321' // Will be hashed
        };
        this.initializeAdmin();
        this.auditLog = [];
    }

    async initializeAdmin() {
        // Create admin tables if they don't exist
        this.db.serialize(() => {
            // Admin users table
            this.db.run(`CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'admin',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_active BOOLEAN DEFAULT 1,
                two_factor_enabled BOOLEAN DEFAULT 0,
                two_factor_secret TEXT
            )`);

            // Admin sessions table
            this.db.run(`CREATE TABLE IF NOT EXISTS admin_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (admin_id) REFERENCES admin_users (id)
            )`);

            // Audit log table
            this.db.run(`CREATE TABLE IF NOT EXISTS admin_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                details TEXT,
                ip_address TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admin_users (id)
            )`);

            // User reports table
            this.db.run(`CREATE TABLE IF NOT EXISTS user_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER,
                reported_user_id INTEGER,
                chat_id TEXT,
                message_id TEXT,
                reason TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                reviewed_by INTEGER,
                reviewed_at DATETIME,
                action_taken TEXT,
                FOREIGN KEY (reporter_id) REFERENCES users (id),
                FOREIGN KEY (reported_user_id) REFERENCES users (id),
                FOREIGN KEY (reviewed_by) REFERENCES admin_users (id)
            )`);

            // System statistics table
            this.db.run(`CREATE TABLE IF NOT EXISTS system_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE UNIQUE NOT NULL,
                total_users INTEGER DEFAULT 0,
                new_users INTEGER DEFAULT 0,
                active_users INTEGER DEFAULT 0,
                total_chats INTEGER DEFAULT 0,
                total_messages INTEGER DEFAULT 0,
                avg_session_duration REAL DEFAULT 0,
                ai_api_calls INTEGER DEFAULT 0,
                ai_api_cost REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });

        // Create default admin user
        await this.createDefaultAdmin();
    }

    async createDefaultAdmin() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT id FROM admin_users WHERE username = ?', [this.adminCredentials.username], 
            async (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    const hashedPassword = await bcrypt.hash(this.adminCredentials.password, 12);
                    this.db.run(`INSERT INTO admin_users (username, email, password_hash, role) 
                                VALUES (?, ?, ?, 'super_admin')`,
                        [this.adminCredentials.username, this.adminCredentials.email, hashedPassword],
                        function(err) {
                            if (err) {
                                console.error('Error creating default admin:', err);
                                reject(err);
                            } else {
                                console.log('Default admin user created successfully');
                                resolve(this.lastID);
                            }
                        }
                    );
                } else {
                    console.log('Default admin user already exists');
                    resolve(row.id);
                }
            });
        });
    }

    // Admin Authentication
    async authenticateAdmin(username, password, ipAddress = null) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM admin_users WHERE username = ? AND is_active = 1', 
            [username], async (err, admin) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!admin) {
                    resolve({ success: false, message: 'Invalid credentials' });
                    return;
                }

                const isValidPassword = await bcrypt.compare(password, admin.password_hash);
                if (!isValidPassword) {
                    resolve({ success: false, message: 'Invalid credentials' });
                    return;
                }

                // Generate admin session token
                const token = jwt.sign(
                    { adminId: admin.id, username: admin.username, role: admin.role },
                    process.env.SECRET_KEY,
                    { expiresIn: '8h' }
                );

                // Store session
                const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
                this.db.run(`INSERT INTO admin_sessions (admin_id, token, ip_address, expires_at) 
                            VALUES (?, ?, ?, ?)`,
                    [admin.id, token, ipAddress, expiresAt.toISOString()]);

                // Update last login
                this.db.run('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

                // Log successful login
                this.logAction(admin.id, 'LOGIN', 'admin_session', null, 'Successful admin login', ipAddress);

                resolve({
                    success: true,
                    token,
                    admin: {
                        id: admin.id,
                        username: admin.username,
                        email: admin.email,
                        role: admin.role
                    }
                });
            });
        });
    }

    async verifyAdminToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            
            return new Promise((resolve, reject) => {
                this.db.get(`SELECT au.*, ases.is_active as session_active 
                            FROM admin_users au 
                            JOIN admin_sessions ases ON au.id = ases.admin_id 
                            WHERE ases.token = ? AND ases.expires_at > CURRENT_TIMESTAMP 
                            AND ases.is_active = 1 AND au.is_active = 1`,
                    [token], (err, admin) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        if (!admin) {
                            resolve(null);
                            return;
                        }

                        resolve({
                            id: admin.id,
                            username: admin.username,
                            email: admin.email,
                            role: admin.role
                        });
                    });
            });
        } catch (error) {
            return null;
        }
    }

    async logoutAdmin(token) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE admin_sessions SET is_active = 0 WHERE token = ?', [token], 
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    // User Management
    async getAllUsers(page = 1, limit = 50, filter = 'all') {
        const offset = (page - 1) * limit;
        let whereClause = '';
        
        switch (filter) {
            case 'active':
                whereClause = 'WHERE is_active = 1';
                break;
            case 'inactive':
                whereClause = 'WHERE is_active = 0';
                break;
            case 'recent':
                whereClause = 'WHERE created_at >= datetime("now", "-7 days")';
                break;
        }

        return new Promise((resolve, reject) => {
            const query = `SELECT id, username, email, anonymous_name, created_at, 
                          last_login, is_active 
                          FROM users ${whereClause} 
                          ORDER BY created_at DESC 
                          LIMIT ? OFFSET ?`;
            
            this.db.all(query, [limit, offset], (err, users) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get total count
                this.db.get(`SELECT COUNT(*) as total FROM users ${whereClause}`, (err, countResult) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve({
                        users,
                        total: countResult.total,
                        page,
                        totalPages: Math.ceil(countResult.total / limit)
                    });
                });
            });
        });
    }

    async banUser(userId, adminId, reason, ipAddress) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE users SET is_active = 0 WHERE id = ?', [userId], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                if (this.changes > 0) {
                    // Log the action
                    this.logAction(adminId, 'BAN_USER', 'user', userId, reason, ipAddress);
                    resolve({ success: true, message: 'User banned successfully' });
                } else {
                    resolve({ success: false, message: 'User not found' });
                }
            }.bind(this));
        });
    }

    async unbanUser(userId, adminId, ipAddress) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE users SET is_active = 1 WHERE id = ?', [userId], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                if (this.changes > 0) {
                    // Log the action
                    this.logAction(adminId, 'UNBAN_USER', 'user', userId, 'User unbanned', ipAddress);
                    resolve({ success: true, message: 'User unbanned successfully' });
                } else {
                    resolve({ success: false, message: 'User not found' });
                }
            }.bind(this));
        });
    }

    async deleteUser(userId, adminId, ipAddress) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                // Delete user's messages
                this.db.run('DELETE FROM messages WHERE sender_id = ?', [userId]);
                
                // Delete user's chats
                this.db.run('DELETE FROM chats WHERE user1_id = ? OR user2_id = ?', [userId, userId]);
                
                // Delete user's refresh tokens
                this.db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
                
                // Delete the user
                this.db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                    }

                    if (this.changes > 0) {
                        this.db.run('COMMIT');
                        // Log the action
                        this.logAction(adminId, 'DELETE_USER', 'user', userId, 'User permanently deleted', ipAddress);
                        resolve({ success: true, message: 'User deleted successfully' });
                    } else {
                        this.db.run('ROLLBACK');
                        resolve({ success: false, message: 'User not found' });
                    }
                }.bind(this));
            });
        });
    }

    // Chat Monitoring
    async getActiveChats() {
        return new Promise((resolve, reject) => {
            const query = `SELECT c.id, c.status, c.created_at, c.expires_at,
                          u1.username as user1_username, u1.anonymous_name as user1_anonymous,
                          u2.username as user2_username, u2.anonymous_name as user2_anonymous,
                          (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
                          FROM chats c
                          JOIN users u1 ON c.user1_id = u1.id
                          JOIN users u2 ON c.user2_id = u2.id
                          WHERE c.status = 'active'
                          ORDER BY c.created_at DESC`;
            
            this.db.all(query, (err, chats) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(chats);
                }
            });
        });
    }

    async getChatHistory(chatId) {
        return new Promise((resolve, reject) => {
            const query = `SELECT m.id, m.content, m.timestamp, u.username, u.anonymous_name
                          FROM messages m
                          JOIN users u ON m.sender_id = u.id
                          WHERE m.chat_id = (SELECT id FROM chats WHERE id = ?)
                          ORDER BY m.timestamp ASC`;
            
            this.db.all(query, [chatId], (err, messages) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(messages);
                }
            });
        });
    }

    async terminateChat(chatId, adminId, reason, ipAddress) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE chats SET status = "terminated" WHERE id = ?', [chatId], 
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                if (this.changes > 0) {
                    // Log the action
                    this.logAction(adminId, 'TERMINATE_CHAT', 'chat', chatId, reason, ipAddress);
                    resolve({ success: true, message: 'Chat terminated successfully' });
                } else {
                    resolve({ success: false, message: 'Chat not found' });
                }
            }.bind(this));
        });
    }

    // System Statistics
    async getSystemStats() {
        return new Promise((resolve, reject) => {
            const queries = {
                totalUsers: 'SELECT COUNT(*) as count FROM users',
                activeUsers: 'SELECT COUNT(*) as count FROM users WHERE is_active = 1',
                newUsersToday: 'SELECT COUNT(*) as count FROM users WHERE date(created_at) = date("now")',
                newUsersWeek: 'SELECT COUNT(*) as count FROM users WHERE created_at >= datetime("now", "-7 days")',
                totalChats: 'SELECT COUNT(*) as count FROM chats',
                activeChats: 'SELECT COUNT(*) as count FROM chats WHERE status = "active"',
                totalMessages: 'SELECT COUNT(*) as count FROM messages',
                messagesToday: 'SELECT COUNT(*) as count FROM messages WHERE date(timestamp) = date("now")'
            };

            const results = {};
            const queryKeys = Object.keys(queries);
            let completed = 0;

            queryKeys.forEach(key => {
                this.db.get(queries[key], (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    results[key] = result.count;
                    completed++;
                    
                    if (completed === queryKeys.length) {
                        resolve(results);
                    }
                });
            });
        });
    }

    async getDailyStats(days = 30) {
        return new Promise((resolve, reject) => {
            const query = `SELECT 
                          date(created_at) as date,
                          COUNT(*) as new_users
                          FROM users 
                          WHERE created_at >= datetime('now', '-${days} days')
                          GROUP BY date(created_at)
                          ORDER BY date ASC`;
            
            this.db.all(query, (err, userStats) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get message stats
                const messageQuery = `SELECT 
                                     date(timestamp) as date,
                                     COUNT(*) as message_count
                                     FROM messages 
                                     WHERE timestamp >= datetime('now', '-${days} days')
                                     GROUP BY date(timestamp)
                                     ORDER BY date ASC`;

                this.db.all(messageQuery, (err, messageStats) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ userStats, messageStats });
                    }
                });
            });
        });
    }

    // Content Moderation
    async getReportedContent(status = 'pending') {
        return new Promise((resolve, reject) => {
            const query = `SELECT ur.*, 
                          u1.username as reporter_username,
                          u2.username as reported_username, u2.anonymous_name as reported_anonymous
                          FROM user_reports ur
                          LEFT JOIN users u1 ON ur.reporter_id = u1.id
                          LEFT JOIN users u2 ON ur.reported_user_id = u2.id
                          WHERE ur.status = ?
                          ORDER BY ur.created_at DESC`;
            
            this.db.all(query, [status], (err, reports) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(reports);
                }
            });
        });
    }

    async reviewReport(reportId, adminId, action, notes, ipAddress) {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE user_reports 
                        SET status = 'reviewed', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, 
                        action_taken = ? 
                        WHERE id = ?`,
                [adminId, `${action}: ${notes}`, reportId], 
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (this.changes > 0) {
                        // Log the action
                        this.logAction(adminId, 'REVIEW_REPORT', 'report', reportId, 
                                     `Action: ${action}, Notes: ${notes}`, ipAddress);
                        resolve({ success: true, message: 'Report reviewed successfully' });
                    } else {
                        resolve({ success: false, message: 'Report not found' });
                    }
                }.bind(this));
        });
    }

    // Audit Logging
    logAction(adminId, action, targetType, targetId, details, ipAddress) {
        this.db.run(`INSERT INTO admin_audit_log 
                    (admin_id, action, target_type, target_id, details, ip_address) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
            [adminId, action, targetType, targetId, details, ipAddress]);
        
        // Also keep in-memory log for real-time display
        this.auditLog.unshift({
            adminId,
            action,
            targetType,
            targetId,
            details,
            ipAddress,
            timestamp: new Date().toISOString()
        });

        // Keep only last 100 entries in memory
        if (this.auditLog.length > 100) {
            this.auditLog = this.auditLog.slice(0, 100);
        }
    }

    async getAuditLog(page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        
        return new Promise((resolve, reject) => {
            const query = `SELECT aal.*, au.username as admin_username
                          FROM admin_audit_log aal
                          LEFT JOIN admin_users au ON aal.admin_id = au.id
                          ORDER BY aal.timestamp DESC
                          LIMIT ? OFFSET ?`;
            
            this.db.all(query, [limit, offset], (err, logs) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Get total count
                this.db.get('SELECT COUNT(*) as total FROM admin_audit_log', (err, countResult) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            logs,
                            total: countResult.total,
                            page,
                            totalPages: Math.ceil(countResult.total / limit)
                        });
                    }
                });
            });
        });
    }

    getRecentAuditLog() {
        return this.auditLog;
    }

    // Export Data
    async exportUserData(format = 'json') {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT id, username, email, anonymous_name, created_at, 
                        last_login, is_active FROM users ORDER BY created_at DESC`, 
                (err, users) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (format === 'csv') {
                        const csv = this.convertToCSV(users);
                        resolve({ data: csv, contentType: 'text/csv' });
                    } else {
                        resolve({ data: JSON.stringify(users, null, 2), contentType: 'application/json' });
                    }
                });
        });
    }

    convertToCSV(data) {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        const csvRows = data.map(row => 
            headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
            }).join(',')
        );
        
        return [csvHeaders, ...csvRows].join('\n');
    }

    // Cleanup old sessions and logs
    cleanup() {
        // Remove expired sessions
        this.db.run('DELETE FROM admin_sessions WHERE expires_at < CURRENT_TIMESTAMP');
        
        // Remove old audit logs (keep 90 days)
        this.db.run('DELETE FROM admin_audit_log WHERE timestamp < datetime("now", "-90 days")');
        
        console.log('Admin service cleanup completed');
    }
}

module.exports = AdminService;
