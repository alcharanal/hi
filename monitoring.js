const os = require('os');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class MonitoringService {
    constructor() {
        this.dbPath = path.join(__dirname, 'anon_connect.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.metrics = {
            system: {},
            database: {},
            websocket: {},
            ai: {},
            errors: [],
            performance: {}
        };
        this.startTime = new Date();
        this.errorCount = 0;
        this.alertThresholds = {
            cpuUsage: 80,
            memoryUsage: 85,
            diskUsage: 90,
            responseTime: 2000,
            errorRate: 10
        };
        
        this.initializeMonitoring();
    }

    initializeMonitoring() {
        // Create monitoring tables
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS system_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                cpu_usage REAL,
                memory_usage REAL,
                disk_usage REAL,
                active_connections INTEGER,
                response_time REAL,
                error_count INTEGER
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS error_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                stack_trace TEXT,
                user_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                request_url TEXT,
                resolved BOOLEAN DEFAULT 0
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS performance_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL,
                response_time REAL NOT NULL,
                status_code INTEGER NOT NULL,
                user_id INTEGER,
                ip_address TEXT
            )`);
        });

        // Start periodic monitoring
        this.startPeriodicMonitoring();
    }

    startPeriodicMonitoring() {
        // Collect system metrics every 30 seconds
        setInterval(() => {
            this.collectSystemMetrics();
        }, 30000);

        // Store metrics to database every 5 minutes
        setInterval(() => {
            this.storeMetrics();
        }, 5 * 60 * 1000);

        // Cleanup old metrics every hour
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 60 * 60 * 1000);
    }

    // System Metrics Collection
    collectSystemMetrics() {
        try {
            // CPU Usage
            const cpus = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;

            cpus.forEach(cpu => {
                for (let type in cpu.times) {
                    totalTick += cpu.times[type];
                }
                totalIdle += cpu.times.idle;
            });

            const idle = totalIdle / cpus.length;
            const total = totalTick / cpus.length;
            const cpuUsage = 100 - ~~(100 * idle / total);

            // Memory Usage
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsage = (usedMemory / totalMemory) * 100;

            // Disk Usage
            const diskUsage = this.getDiskUsage();

            // Load Average
            const loadAverage = os.loadavg();

            // Network Interfaces
            const networkInterfaces = os.networkInterfaces();

            this.metrics.system = {
                cpuUsage: cpuUsage.toFixed(2),
                memoryUsage: memoryUsage.toFixed(2),
                diskUsage: diskUsage.toFixed(2),
                totalMemory: this.formatBytes(totalMemory),
                usedMemory: this.formatBytes(usedMemory),
                freeMemory: this.formatBytes(freeMemory),
                loadAverage: loadAverage.map(avg => avg.toFixed(2)),
                uptime: this.formatUptime(os.uptime()),
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            };

            // Check for alerts
            this.checkAlerts();

        } catch (error) {
            this.logError('ERROR', 'Failed to collect system metrics', error);
        }
    }

    getDiskUsage() {
        try {
            const stats = fs.statSync(process.cwd());
            // This is a simplified disk usage calculation
            // In production, you might want to use a more robust solution
            return Math.random() * 30 + 20; // Mock data for now
        } catch (error) {
            return 0;
        }
    }

    // Database Metrics
    async collectDatabaseMetrics() {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            this.db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
                if (err) {
                    this.metrics.database = {
                        status: 'error',
                        error: err.message,
                        responseTime: Date.now() - startTime
                    };
                    reject(err);
                    return;
                }

                const responseTime = Date.now() - startTime;
                
                // Get database file size
                const dbPath = this.dbPath;
                let dbSize = 0;
                try {
                    const stats = fs.statSync(dbPath);
                    dbSize = stats.size;
                } catch (error) {
                    console.error('Error getting database size:', error);
                }

                this.metrics.database = {
                    status: 'healthy',
                    responseTime,
                    userCount: result.count,
                    size: this.formatBytes(dbSize),
                    sizeBytes: dbSize,
                    timestamp: new Date().toISOString()
                };

                resolve(this.metrics.database);
            });
        });
    }

    // WebSocket Metrics
    updateWebSocketMetrics(connectionManager) {
        if (!connectionManager) return;

        const stats = connectionManager.getStats();
        
        this.metrics.websocket = {
            connectedUsers: stats.connectedUsers || 0,
            activeRooms: stats.activeRooms || 0,
            waitingQueue: stats.waitingQueue || 0,
            totalMessages: stats.totalMessages || 0,
            aiAnalyses: stats.aiAnalyses || 0,
            aiTokens: stats.aiTokens || 0,
            aiCost: stats.aiCost || 0,
            timestamp: new Date().toISOString()
        };
    }

    // AI Metrics
    updateAIMetrics(aiService) {
        if (!aiService) return;

        const usage = aiService.getAPIUsageStats();
        
        this.metrics.ai = {
            totalCalls: usage.calls || 0,
            totalTokens: usage.tokens || 0,
            totalCost: usage.cost || 0,
            averageCostPerCall: usage.calls > 0 ? (usage.cost / usage.calls).toFixed(4) : 0,
            timestamp: new Date().toISOString()
        };
    }

    // Error Logging
    logError(level, message, error = null, context = {}) {
        const errorLog = {
            level,
            message,
            stack_trace: error ? error.stack : null,
            user_id: context.userId || null,
            ip_address: context.ipAddress || null,
            user_agent: context.userAgent || null,
            request_url: context.requestUrl || null,
            timestamp: new Date().toISOString()
        };

        // Add to in-memory errors array
        this.metrics.errors.unshift(errorLog);
        
        // Keep only last 100 errors in memory
        if (this.metrics.errors.length > 100) {
            this.metrics.errors = this.metrics.errors.slice(0, 100);
        }

        // Store in database
        this.db.run(`INSERT INTO error_logs 
                    (level, message, stack_trace, user_id, ip_address, user_agent, request_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [level, message, errorLog.stack_trace, errorLog.user_id, 
             errorLog.ip_address, errorLog.user_agent, errorLog.request_url]);

        // Increment error count
        this.errorCount++;

        console.error(`[${level}] ${message}`, error);
    }

    // Performance Tracking
    trackPerformance(endpoint, method, responseTime, statusCode, context = {}) {
        const performanceMetric = {
            endpoint,
            method,
            responseTime,
            statusCode,
            timestamp: new Date().toISOString(),
            user_id: context.userId || null,
            ip_address: context.ipAddress || null
        };

        // Store in database
        this.db.run(`INSERT INTO performance_metrics 
                    (endpoint, method, response_time, status_code, user_id, ip_address)
                    VALUES (?, ?, ?, ?, ?, ?)`,
            [endpoint, method, responseTime, statusCode, 
             performanceMetric.user_id, performanceMetric.ip_address]);

        // Update performance metrics
        if (!this.metrics.performance[endpoint]) {
            this.metrics.performance[endpoint] = {
                totalRequests: 0,
                averageResponseTime: 0,
                errorRate: 0,
                lastRequest: null
            };
        }

        const endpointMetrics = this.metrics.performance[endpoint];
        endpointMetrics.totalRequests++;
        endpointMetrics.averageResponseTime = (
            (endpointMetrics.averageResponseTime * (endpointMetrics.totalRequests - 1) + responseTime) / 
            endpointMetrics.totalRequests
        );
        
        if (statusCode >= 400) {
            endpointMetrics.errorRate = (endpointMetrics.errorRate + 1) / endpointMetrics.totalRequests;
        }
        
        endpointMetrics.lastRequest = performanceMetric.timestamp;
    }

    // Health Checks
    async performHealthCheck() {
        const healthStatus = {
            overall: 'healthy',
            checks: {
                database: { status: 'unknown', responseTime: 0 },
                system: { status: 'unknown' },
                memory: { status: 'unknown' },
                disk: { status: 'unknown' },
                errors: { status: 'unknown', recentCount: 0 }
            },
            timestamp: new Date().toISOString(),
            uptime: this.formatUptime(process.uptime())
        };

        try {
            // Database health check
            const dbMetrics = await this.collectDatabaseMetrics();
            healthStatus.checks.database = {
                status: dbMetrics.responseTime < 1000 ? 'healthy' : 'warning',
                responseTime: dbMetrics.responseTime
            };

            // System health checks
            healthStatus.checks.system = {
                status: this.metrics.system.cpuUsage < this.alertThresholds.cpuUsage ? 'healthy' : 'warning'
            };

            healthStatus.checks.memory = {
                status: this.metrics.system.memoryUsage < this.alertThresholds.memoryUsage ? 'healthy' : 'warning'
            };

            healthStatus.checks.disk = {
                status: this.metrics.system.diskUsage < this.alertThresholds.diskUsage ? 'healthy' : 'warning'
            };

            // Error rate check
            const recentErrors = this.metrics.errors.filter(error => 
                new Date(error.timestamp) > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
            );
            
            healthStatus.checks.errors = {
                status: recentErrors.length < this.alertThresholds.errorRate ? 'healthy' : 'critical',
                recentCount: recentErrors.length
            };

            // Determine overall status
            const statuses = Object.values(healthStatus.checks).map(check => check.status);
            if (statuses.includes('critical')) {
                healthStatus.overall = 'critical';
            } else if (statuses.includes('warning')) {
                healthStatus.overall = 'warning';
            } else {
                healthStatus.overall = 'healthy';
            }

        } catch (error) {
            healthStatus.overall = 'critical';
            this.logError('ERROR', 'Health check failed', error);
        }

        return healthStatus;
    }

    // Alerting
    checkAlerts() {
        const alerts = [];

        if (this.metrics.system.cpuUsage > this.alertThresholds.cpuUsage) {
            alerts.push({
                type: 'high_cpu',
                severity: 'warning',
                message: `High CPU usage: ${this.metrics.system.cpuUsage}%`,
                threshold: this.alertThresholds.cpuUsage
            });
        }

        if (this.metrics.system.memoryUsage > this.alertThresholds.memoryUsage) {
            alerts.push({
                type: 'high_memory',
                severity: 'warning',
                message: `High memory usage: ${this.metrics.system.memoryUsage}%`,
                threshold: this.alertThresholds.memoryUsage
            });
        }

        if (this.metrics.system.diskUsage > this.alertThresholds.diskUsage) {
            alerts.push({
                type: 'high_disk',
                severity: 'critical',
                message: `High disk usage: ${this.metrics.system.diskUsage}%`,
                threshold: this.alertThresholds.diskUsage
            });
        }

        // Check recent error rate
        const recentErrors = this.metrics.errors.filter(error => 
            new Date(error.timestamp) > new Date(Date.now() - 5 * 60 * 1000)
        );
        
        if (recentErrors.length > this.alertThresholds.errorRate) {
            alerts.push({
                type: 'high_error_rate',
                severity: 'critical',
                message: `High error rate: ${recentErrors.length} errors in the last 5 minutes`,
                threshold: this.alertThresholds.errorRate
            });
        }

        if (alerts.length > 0) {
            this.handleAlerts(alerts);
        }
    }

    handleAlerts(alerts) {
        alerts.forEach(alert => {
            console.warn(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
            
            // In production, you might want to:
            // - Send email notifications
            // - Post to Slack/Discord
            // - Create incident tickets
            // - Send push notifications
        });
    }

    // Data Storage
    storeMetrics() {
        const metrics = this.metrics.system;
        
        this.db.run(`INSERT INTO system_metrics 
                    (cpu_usage, memory_usage, disk_usage, active_connections, error_count)
                    VALUES (?, ?, ?, ?, ?)`,
            [metrics.cpuUsage, metrics.memoryUsage, metrics.diskUsage, 
             this.metrics.websocket.connectedUsers || 0, this.errorCount]);
    }

    // Analytics
    async getMetricsHistory(hours = 24) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM system_metrics 
                          WHERE timestamp >= datetime('now', '-${hours} hours')
                          ORDER BY timestamp ASC`;
            
            this.db.all(query, (err, metrics) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metrics);
                }
            });
        });
    }

    async getPerformanceStats(endpoint = null, hours = 24) {
        return new Promise((resolve, reject) => {
            let query = `SELECT endpoint, method, AVG(response_time) as avg_response_time,
                        COUNT(*) as total_requests,
                        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
                        FROM performance_metrics 
                        WHERE timestamp >= datetime('now', '-${hours} hours')`;
            
            const params = [];
            if (endpoint) {
                query += ' AND endpoint = ?';
                params.push(endpoint);
            }
            
            query += ' GROUP BY endpoint, method ORDER BY total_requests DESC';
            
            this.db.all(query, params, (err, stats) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stats);
                }
            });
        });
    }

    async getErrorAnalytics(hours = 24) {
        return new Promise((resolve, reject) => {
            const query = `SELECT level, COUNT(*) as count, 
                          GROUP_CONCAT(DISTINCT message) as messages
                          FROM error_logs 
                          WHERE timestamp >= datetime('now', '-${hours} hours')
                          GROUP BY level
                          ORDER BY count DESC`;
            
            this.db.all(query, (err, errors) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(errors);
                }
            });
        });
    }

    // Cleanup
    cleanupOldMetrics() {
        // Keep metrics for 30 days
        this.db.run('DELETE FROM system_metrics WHERE timestamp < datetime("now", "-30 days")');
        this.db.run('DELETE FROM performance_metrics WHERE timestamp < datetime("now", "-30 days")');
        this.db.run('DELETE FROM error_logs WHERE timestamp < datetime("now", "-30 days")');
        
        console.log('Old metrics cleaned up');
    }

    // Utility Methods
    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Public API
    getMetrics() {
        return this.metrics;
    }

    getRecentErrors(limit = 10) {
        return this.metrics.errors.slice(0, limit);
    }

    getSystemStatus() {
        return {
            status: this.metrics.system.cpuUsage < 80 && 
                   this.metrics.system.memoryUsage < 85 ? 'healthy' : 'warning',
            uptime: this.formatUptime(process.uptime()),
            startTime: this.startTime,
            metrics: this.metrics
        };
    }
}

module.exports = MonitoringService;
