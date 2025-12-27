const fs = require('fs');
const path = require('path');

class ErrorHandler {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        this.ensureLogDirectory();
        this.errorCounts = new Map();
        this.rateLimits = new Map();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    // Centralized logging function
    log(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            metadata,
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };

        // Console output with colors
        const colors = {
            ERROR: '\x1b[31m',   // Red
            WARN: '\x1b[33m',    // Yellow
            INFO: '\x1b[36m',    // Cyan
            DEBUG: '\x1b[32m',   // Green
            RESET: '\x1b[0m'     // Reset
        };

        const color = colors[level.toUpperCase()] || colors.RESET;
        console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.RESET}`);

        if (metadata && Object.keys(metadata).length > 0) {
            console.log(`${color}Metadata:${colors.RESET}`, JSON.stringify(metadata, null, 2));
        }

        // Write to file
        this.writeToFile(level, logEntry);

        // Error tracking
        if (level.toUpperCase() === 'ERROR') {
            this.trackError(message, metadata);
        }
    }

    writeToFile(level, logEntry) {
        const date = new Date().toISOString().split('T')[0];
        const filename = path.join(this.logDir, `${level.toLowerCase()}-${date}.log`);
        
        const logLine = JSON.stringify(logEntry) + '\n';
        
        fs.appendFile(filename, logLine, (err) => {
            if (err) {
                console.error('Failed to write to log file:', err);
            }
        });

        // Also write errors to a combined log
        if (level.toUpperCase() === 'ERROR') {
            const errorFile = path.join(this.logDir, `errors-${date}.log`);
            fs.appendFile(errorFile, logLine, () => {});
        }
    }

    trackError(message, metadata) {
        const errorKey = this.createErrorKey(message, metadata);
        const count = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, count + 1);

        // Alert on repeated errors
        if (count + 1 >= 5) {
            this.log('WARN', `Repeated error detected (${count + 1} times): ${message}`, metadata);
        }

        if (count + 1 >= 10) {
            this.log('ERROR', `Critical: Error occurred ${count + 1} times: ${message}`, {
                ...metadata,
                severity: 'CRITICAL',
                action_required: true
            });
        }
    }

    createErrorKey(message, metadata) {
        // Create a unique key for error tracking
        const endpoint = metadata.endpoint || 'unknown';
        const errorType = metadata.errorType || 'generic';
        return `${endpoint}:${errorType}:${message.substring(0, 100)}`;
    }

    // Express error handler middleware
    expressErrorHandler() {
        return (err, req, res, next) => {
            const metadata = {
                endpoint: `${req.method} ${req.path}`,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                body: req.body,
                params: req.params,
                query: req.query,
                headers: this.sanitizeHeaders(req.headers),
                errorType: err.constructor.name,
                stack: err.stack
            };

            // Different handling based on error type
            if (err.name === 'ValidationError') {
                this.log('WARN', `Validation error: ${err.message}`, metadata);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input data',
                    errors: err.errors || [err.message]
                });
            }

            if (err.name === 'UnauthorizedError' || err.status === 401) {
                this.log('WARN', `Unauthorized access attempt: ${err.message}`, metadata);
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (err.name === 'ForbiddenError' || err.status === 403) {
                this.log('WARN', `Forbidden access attempt: ${err.message}`, metadata);
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            if (err.status === 404) {
                this.log('DEBUG', `Resource not found: ${req.path}`, metadata);
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
                this.log('WARN', `JSON parse error: ${err.message}`, metadata);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid JSON format'
                });
            }

            // Database errors
            if (err.code === 'SQLITE_CONSTRAINT' || err.code === 'SQLITE_BUSY') {
                this.log('ERROR', `Database error: ${err.message}`, metadata);
                return res.status(500).json({
                    success: false,
                    message: 'Database operation failed'
                });
            }

            // Rate limiting errors
            if (err.name === 'TooManyRequestsError') {
                this.log('WARN', `Rate limit exceeded: ${err.message}`, metadata);
                return res.status(429).json({
                    success: false,
                    message: 'Too many requests, please slow down',
                    retryAfter: err.retryAfter
                });
            }

            // Socket.io errors
            if (err.name === 'SocketError') {
                this.log('ERROR', `Socket error: ${err.message}`, metadata);
                // Socket errors don't need HTTP response
                return;
            }

            // Generic server errors
            this.log('ERROR', `Unhandled server error: ${err.message}`, metadata);
            
            // Don't expose internal errors in production
            const isProduction = process.env.NODE_ENV === 'production';
            return res.status(500).json({
                success: false,
                message: isProduction ? 'Internal server error' : err.message,
                ...(isProduction ? {} : { stack: err.stack })
            });
        };
    }

    // Async error wrapper
    asyncWrapper(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    // Request logging middleware
    requestLogger() {
        return (req, res, next) => {
            const start = Date.now();

            // Use finish event instead of overriding res.end to avoid conflicts
            res.on('finish', () => {
                const duration = Date.now() - start;
                const metadata = {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    contentLength: res.get('content-length') || 0
                };

                // Log based on status code
                if (res.statusCode >= 500) {
                    this.log('ERROR', `Server error response`, metadata);
                } else if (res.statusCode >= 400) {
                    this.log('WARN', `Client error response`, metadata);
                } else {
                    this.log('INFO', `Request completed`, metadata);
                }
            });

            next();
        };
    }

    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        
        // Remove sensitive headers
        delete sanitized.authorization;
        delete sanitized.cookie;
        delete sanitized['x-api-key'];
        
        return sanitized;
    }

    // Socket.io error handler
    socketErrorHandler(socket) {
        socket.on('error', (error) => {
            this.log('ERROR', `Socket error for user ${socket.userId}`, {
                socketId: socket.id,
                userId: socket.userId,
                error: error.message,
                stack: error.stack
            });
        });

        socket.on('disconnect', (reason) => {
            if (reason === 'transport error' || reason === 'ping timeout') {
                this.log('WARN', `Socket disconnected: ${reason}`, {
                    socketId: socket.id,
                    userId: socket.userId,
                    reason
                });
            } else {
                this.log('INFO', `Socket disconnected: ${reason}`, {
                    socketId: socket.id,
                    userId: socket.userId,
                    reason
                });
            }
        });
    }

    // Database error handler
    databaseErrorHandler(operation, error, query = null) {
        const metadata = {
            operation,
            errorCode: error.code,
            errorMessage: error.message,
            query: query ? query.substring(0, 200) : null
        };

        if (error.code === 'SQLITE_BUSY') {
            this.log('WARN', 'Database is busy, operation may be retried', metadata);
        } else if (error.code === 'SQLITE_CONSTRAINT') {
            this.log('WARN', 'Database constraint violation', metadata);
        } else if (error.code === 'SQLITE_CORRUPT') {
            this.log('ERROR', 'Database corruption detected!', {
                ...metadata,
                severity: 'CRITICAL',
                action_required: true
            });
        } else {
            this.log('ERROR', `Database operation failed: ${operation}`, metadata);
        }
    }

    // AI service error handler
    aiErrorHandler(service, error, context = {}) {
        const metadata = {
            service,
            errorType: error.constructor.name,
            errorMessage: error.message,
            context,
            timestamp: new Date().toISOString()
        };

        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            this.log('ERROR', 'AI service connection failed', metadata);
        } else if (error.status === 429) {
            this.log('WARN', 'AI service rate limit exceeded', metadata);
        } else if (error.status === 401) {
            this.log('ERROR', 'AI service authentication failed', metadata);
        } else {
            this.log('ERROR', `AI service error in ${service}`, metadata);
        }
    }

    // Performance monitoring
    performanceLogger(operation, duration, metadata = {}) {
        const level = duration > 5000 ? 'WARN' : duration > 1000 ? 'INFO' : 'DEBUG';
        
        this.log(level, `Performance: ${operation} took ${duration}ms`, {
            ...metadata,
            duration,
            operation,
            performance: true
        });
    }

    // Security event logger
    securityLogger(event, severity, metadata = {}) {
        this.log('WARN', `Security event: ${event}`, {
            ...metadata,
            security: true,
            severity,
            timestamp: new Date().toISOString()
        });
    }

    // Health check for logs
    getHealthStatus() {
        const logFiles = fs.readdirSync(this.logDir);
        const recentErrors = Array.from(this.errorCounts.entries())
            .filter(([key, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            logDirectory: this.logDir,
            logFiles: logFiles.length,
            recentErrors: recentErrors.length,
            topErrors: recentErrors,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    // Clean old logs
    cleanOldLogs(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        fs.readdir(this.logDir, (err, files) => {
            if (err) {
                this.log('ERROR', 'Failed to read log directory for cleanup', { error: err.message });
                return;
            }

            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;

                    if (stats.mtime < cutoffDate) {
                        fs.unlink(filePath, (err) => {
                            if (err) {
                                this.log('ERROR', `Failed to delete old log file: ${file}`, { error: err.message });
                            } else {
                                this.log('INFO', `Deleted old log file: ${file}`);
                            }
                        });
                    }
                });
            });
        });
    }

    // Process exit handlers
    setupGracefulShutdown() {
        const shutdown = (signal) => {
            this.log('INFO', `Received ${signal}, shutting down gracefully`);
            
            // Perform cleanup tasks
            this.cleanOldLogs();
            
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.log('ERROR', 'Uncaught exception', {
                error: error.message,
                stack: error.stack,
                severity: 'CRITICAL'
            });
            
            // Give time for logs to write, then exit
            setTimeout(() => process.exit(1), 1000);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.log('ERROR', 'Unhandled promise rejection', {
                reason: reason.toString(),
                promise: promise.toString(),
                severity: 'CRITICAL'
            });
        });
    }
}

module.exports = ErrorHandler;
