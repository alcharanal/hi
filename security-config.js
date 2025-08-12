const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const validator = require('validator');
const xss = require('xss');

class SecurityConfig {
    constructor() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.setupConfiguration();
    }

    setupConfiguration() {
        // Security headers configuration
        this.helmetConfig = {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: [
                        "'self'", 
                        "'unsafe-inline'", 
                        "https://cdnjs.cloudflare.com",
                        "https://fonts.googleapis.com"
                    ],
                    scriptSrc: [
                        "'self'", 
                        "'unsafe-inline'",
                        "https://cdnjs.cloudflare.com"
                    ],
                    imgSrc: [
                        "'self'", 
                        "data:", 
                        "https:",
                        "blob:"
                    ],
                    connectSrc: [
                        "'self'",
                        "https://api.ipify.org",
                        "wss:",
                        "ws:"
                    ],
                    fontSrc: [
                        "'self'",
                        "https://fonts.gstatic.com",
                        "https://cdnjs.cloudflare.com"
                    ],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"]
                },
                reportOnly: false
            },
            crossOriginEmbedderPolicy: false,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            noSniff: true,
            frameguard: { action: 'deny' },
            xssFilter: true,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
        };

        // Rate limiting configurations
        this.rateLimitConfigs = {
            // General API rate limiting
            general: rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: this.isProduction ? 100 : 1000, // requests per windowMs
                message: {
                    success: false,
                    message: 'Too many requests from this IP, please try again later.',
                    retryAfter: '15 minutes'
                },
                standardHeaders: true,
                legacyHeaders: false,
                skipSuccessfulRequests: false,
                skip: (req) => {
                    // Skip rate limiting for health checks
                    return req.path === '/health';
                }
            }),

            // Strict rate limiting for authentication
            auth: rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: this.isProduction ? 10 : 50, // login attempts per windowMs
                message: {
                    success: false,
                    message: 'Too many authentication attempts, please try again later.',
                    retryAfter: '15 minutes'
                },
                standardHeaders: true,
                legacyHeaders: false,
                skipSuccessfulRequests: true
            }),

            // Admin authentication - very strict
            adminAuth: rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: this.isProduction ? 5 : 20, // admin login attempts per windowMs
                message: {
                    success: false,
                    message: 'Too many admin authentication attempts. Account may be locked.',
                    retryAfter: '15 minutes'
                },
                standardHeaders: true,
                legacyHeaders: false,
                skipSuccessfulRequests: true
            }),

            // Password reset attempts
            passwordReset: rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hour
                max: this.isProduction ? 3 : 10, // password reset attempts per hour
                message: {
                    success: false,
                    message: 'Too many password reset attempts, please try again later.',
                    retryAfter: '1 hour'
                }
            }),

            // Registration attempts
            registration: rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hour
                max: this.isProduction ? 5 : 20, // registrations per hour per IP
                message: {
                    success: false,
                    message: 'Too many registration attempts from this IP.',
                    retryAfter: '1 hour'
                }
            })
        };

        // Speed limiting (slow down) configurations
        this.speedLimitConfigs = {
            general: slowDown({
                windowMs: 15 * 60 * 1000, // 15 minutes
                delayAfter: this.isProduction ? 50 : 200, // allow full speed for first requests
                delayMs: () => 500, // Updated for express-slow-down v2+ compatibility
                maxDelayMs: 10000, // maximum delay of 10 seconds
                skipSuccessfulRequests: false,
                validate: { delayMs: false } // Disable deprecation warning
            })
        };
    }

    // Input validation and sanitization
    validateAndSanitizeInput(input, type = 'general') {
        if (!input || typeof input !== 'string') {
            return { isValid: false, sanitized: '', errors: ['Invalid input type'] };
        }

        const errors = [];
        let sanitized = input.trim();

        switch (type) {
            case 'username':
                // Username validation
                if (sanitized.length < 3 || sanitized.length > 30) {
                    errors.push('Username must be between 3 and 30 characters');
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
                    errors.push('Username can only contain letters, numbers, hyphens, and underscores');
                }
                // Sanitize
                sanitized = validator.escape(sanitized);
                break;

            case 'email':
                // Email validation
                if (!validator.isEmail(sanitized)) {
                    errors.push('Invalid email format');
                }
                // Normalize email
                sanitized = validator.normalizeEmail(sanitized, {
                    all_lowercase: true,
                    gmail_remove_dots: false
                }) || sanitized;
                break;

            case 'password':
                // Password validation (don't sanitize passwords, just validate)
                if (sanitized.length < 8) {
                    errors.push('Password must be at least 8 characters long');
                }
                if (!/(?=.*[a-z])/.test(sanitized)) {
                    errors.push('Password must contain at least one lowercase letter');
                }
                if (!/(?=.*[A-Z])/.test(sanitized)) {
                    errors.push('Password must contain at least one uppercase letter');
                }
                if (!/(?=.*\d)/.test(sanitized)) {
                    errors.push('Password must contain at least one number');
                }
                if (!/(?=.*[@$!%*?&])/.test(sanitized)) {
                    errors.push('Password must contain at least one special character (@$!%*?&)');
                }
                // Don't escape passwords
                break;

            case 'message':
                // Chat message validation and sanitization
                if (sanitized.length > 1000) {
                    errors.push('Message too long (maximum 1000 characters)');
                }
                // Remove potential XSS
                sanitized = xss(sanitized, {
                    whiteList: {}, // No HTML tags allowed
                    stripIgnoreTag: true,
                    stripIgnoreTagBody: ['script']
                });
                break;

            case 'general':
            default:
                // General text sanitization
                sanitized = xss(sanitized, {
                    whiteList: {},
                    stripIgnoreTag: true,
                    stripIgnoreTagBody: ['script']
                });
                sanitized = validator.escape(sanitized);
                break;
        }

        return {
            isValid: errors.length === 0,
            sanitized: sanitized,
            errors: errors
        };
    }

    // SQL injection prevention
    sanitizeForSQL(input) {
        if (typeof input !== 'string') {
            return input;
        }
        
        // Basic SQL injection pattern detection
        const sqlPatterns = [
            /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
            /(--|\|\||;|\/\*|\*\/)/g,
            /(\bor\b.*\b=\b|\band\b.*\b=\b)/gi
        ];

        for (const pattern of sqlPatterns) {
            if (pattern.test(input)) {
                throw new Error('Potentially malicious input detected');
            }
        }

        return input;
    }

    // Generate secure headers middleware
    getSecurityHeaders() {
        return (req, res, next) => {
            // Remove server information
            res.removeHeader('X-Powered-By');
            
            // Add custom security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
            
            if (this.isProduction) {
                res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
            }

            next();
        };
    }

    // IP whitelist/blacklist functionality
    createIPFilter(whitelist = [], blacklist = []) {
        return (req, res, next) => {
            const clientIP = req.ip || req.connection.remoteAddress;
            
            // Check blacklist first
            if (blacklist.length > 0 && blacklist.includes(clientIP)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // Check whitelist if provided
            if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            next();
        };
    }

    // Request logging middleware
    getRequestLogger() {
        return (req, res, next) => {
            const timestamp = new Date().toISOString();
            const ip = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent') || 'Unknown';
            
            // Log security-relevant requests
            if (req.path.includes('/admin') || req.path.includes('/auth')) {
                console.log(`[SECURITY] ${timestamp} - ${req.method} ${req.path} - IP: ${ip} - UA: ${userAgent}`);
            }

            next();
        };
    }

    // CORS configuration
    getCORSOptions() {
        return {
            origin: this.isProduction ? 
                ['https://yourdomain.com', 'https://www.yourdomain.com'] : 
                ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
            credentials: true,
            optionsSuccessStatus: 200,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposedHeaders: ['X-Rate-Limit-Limit', 'X-Rate-Limit-Remaining']
        };
    }

    // Session security configuration
    getSessionConfig() {
        return {
            secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: this.isProduction, // HTTPS only in production
                httpOnly: true, // Prevent XSS
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                sameSite: this.isProduction ? 'strict' : 'lax'
            },
            name: 'sessionId' // Don't use default session name
        };
    }

    // Environment validation
    validateEnvironment() {
        // Set default NODE_ENV if not provided
        if (!process.env.NODE_ENV) {
            process.env.NODE_ENV = 'development';
            console.log('ℹ️  NODE_ENV not set, defaulting to "development"');
        }

        // Set default SECRET_KEY if not provided
        if (!process.env.SECRET_KEY) {
            process.env.SECRET_KEY = 'default-secret-key-change-in-production-' + Date.now();
            console.log('⚠️  SECRET_KEY not set, using default (change for production!)');
        }

        const required = [
            'SECRET_KEY',
            'NODE_ENV'
        ];

        const recommended = [
            'SESSION_SECRET',
            'OPENAI_API_KEY',
            'ADMIN_EMAIL'
        ];

        const missing = required.filter(key => !process.env[key]);
        const missingRecommended = recommended.filter(key => !process.env[key]);

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        if (missingRecommended.length > 0 && this.isProduction) {
            console.warn(`⚠️  Missing recommended environment variables: ${missingRecommended.join(', ')}`);
        }

        // Validate SECRET_KEY strength
        const secretKey = process.env.SECRET_KEY;
        if (secretKey && secretKey.length < 32) {
            console.warn('⚠️  SECRET_KEY should be at least 32 characters long for production use');
        }

        return {
            isValid: missing.length === 0,
            missing,
            missingRecommended
        };
    }

    // Content Security Policy violation reporting
    getCSPReporter() {
        return (req, res, next) => {
            if (req.path === '/csp-report') {
                console.warn('CSP Violation:', req.body);
                return res.status(204).end();
            }
            next();
        };
    }

    // Suspicious activity detection
    detectSuspiciousActivity() {
        const suspiciousPatterns = [
            /admin/i,
            /login/i,
            /password/i,
            /\.php$/,
            /\.asp$/,
            /\.jsp$/,
            /wp-admin/i,
            /phpmyadmin/i,
            /\.env$/,
            /config\.json$/
        ];

        return (req, res, next) => {
            const path = req.path.toLowerCase();
            const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(path));

            if (isSuspicious && !req.path.startsWith('/admin') && !req.path.startsWith('/auth')) {
                console.warn(`[SECURITY ALERT] Suspicious request: ${req.method} ${req.path} from ${req.ip}`);
                
                // Log additional details
                console.warn(`User-Agent: ${req.get('User-Agent')}`);
                console.warn(`Referer: ${req.get('Referer') || 'None'}`);
            }

            next();
        };
    }
}

module.exports = SecurityConfig;
