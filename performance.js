const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const os = require('os');

class PerformanceOptimizer {
    constructor() {
        this.cache = new NodeCache({
            stdTTL: 600, // 10 minutes default TTL
            checkperiod: 120, // Check for expired keys every 2 minutes
            useClones: false // Better performance, but be careful with mutations
        });
        
        this.statsCache = new NodeCache({
            stdTTL: 60, // 1 minute for stats
            checkperiod: 30
        });
        
        this.userSessionCache = new NodeCache({
            stdTTL: 3600, // 1 hour for user sessions
            checkperiod: 300
        });

        this.compressionCache = new NodeCache({
            stdTTL: 86400, // 24 hours for compressed static assets
            checkperiod: 3600
        });

        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            totalRequests: 0,
            averageResponseTime: 0,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        };

        this.setupEventListeners();
        this.startMetricsCollection();
    }

    setupEventListeners() {
        // Cache event listeners
        this.cache.on('hit', (key) => {
            this.metrics.cacheHits++;
        });

        this.cache.on('miss', (key) => {
            this.metrics.cacheMisses++;
        });

        this.cache.on('expired', (key, value) => {
            console.log(`Cache key expired: ${key}`);
        });

        this.cache.on('flush', () => {
            console.log('Cache flushed');
        });
    }

    startMetricsCollection() {
        // Collect performance metrics every 30 seconds
        setInterval(() => {
            this.collectMetrics();
        }, 30000);
    }

    collectMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage(this.metrics.cpuUsage);

        this.metrics.memoryUsage = memUsage;
        this.metrics.cpuUsage = cpuUsage;

        // Calculate cache hit ratio
        const totalCacheOperations = this.metrics.cacheHits + this.metrics.cacheMisses;
        const cacheHitRatio = totalCacheOperations > 0 ? 
            (this.metrics.cacheHits / totalCacheOperations) * 100 : 0;

        // Log performance metrics if they're concerning
        if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
            console.warn('⚠️  High memory usage detected:', Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%');
        }

        if (cacheHitRatio < 50 && totalCacheOperations > 100) {
            console.warn('⚠️  Low cache hit ratio:', Math.round(cacheHitRatio) + '%');
        }
    }

    // Response time monitoring middleware
    responseTimeMiddleware() {
        return (req, res, next) => {
            const start = process.hrtime.bigint();
            
            res.on('finish', () => {
                const end = process.hrtime.bigint();
                const responseTime = Number(end - start) / 1000000; // Convert to milliseconds
                
                this.metrics.totalRequests++;
                
                // Update rolling average response time
                this.metrics.averageResponseTime = 
                    (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
                    this.metrics.totalRequests;
                
                // Add response time header
                res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
                
                // Log slow requests
                if (responseTime > 1000) {
                    console.warn(`🐌 Slow request: ${req.method} ${req.path} - ${responseTime.toFixed(2)}ms`);
                }
            });
            
            next();
        };
    }

    // Database query caching
    cacheQuery(key, queryFunction, ttl = 600) {
        const cachedResult = this.cache.get(key);
        if (cachedResult) {
            return Promise.resolve(cachedResult);
        }

        return queryFunction().then(result => {
            this.cache.set(key, result, ttl);
            return result;
        });
    }

    // User session caching
    cacheUserSession(userId, sessionData, ttl = 3600) {
        const key = `user_session_${userId}`;
        this.userSessionCache.set(key, sessionData, ttl);
    }

    getUserSession(userId) {
        const key = `user_session_${userId}`;
        return this.userSessionCache.get(key);
    }

    invalidateUserSession(userId) {
        const key = `user_session_${userId}`;
        this.userSessionCache.del(key);
    }

    // Stats caching for admin dashboard
    cacheStats(statsType, data, ttl = 60) {
        const key = `stats_${statsType}`;
        this.statsCache.set(key, data, ttl);
    }

    getStats(statsType) {
        const key = `stats_${statsType}`;
        return this.statsCache.get(key);
    }

    // Static asset optimization
    optimizeStaticAssets() {
        return (req, res, next) => {
            const filePath = req.path;
            
            // Check if it's a static asset
            if (this.isStaticAsset(filePath)) {
                // Set aggressive caching headers for static assets
                const oneYear = 31536000;
                res.set({
                    'Cache-Control': `public, max-age=${oneYear}, immutable`,
                    'ETag': this.generateETag(filePath),
                    'Expires': new Date(Date.now() + oneYear * 1000).toUTCString()
                });

                // Handle conditional requests
                if (req.headers['if-none-match'] === res.get('ETag')) {
                    return res.status(304).end();
                }
            }
            
            next();
        };
    }

    isStaticAsset(filePath) {
        const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
        return staticExtensions.some(ext => filePath.endsWith(ext));
    }

    generateETag(filePath) {
        try {
            const fullPath = path.join(__dirname, 'public', filePath);
            const stats = fs.statSync(fullPath);
            return `"${stats.mtime.getTime()}-${stats.size}"`;
        } catch (error) {
            return `"${Date.now()}"`;
        }
    }

    // Memory optimization
    optimizeMemory() {
        // Clean up caches periodically
        setInterval(() => {
            this.cache.flushStats();
            this.cleanupExpiredEntries();
        }, 600000); // Every 10 minutes

        // Force garbage collection if available
        if (global.gc) {
            setInterval(() => {
                const memUsage = process.memoryUsage();
                const heapUsedPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
                
                if (heapUsedPercentage > 80) {
                    console.log('🧹 Running garbage collection...');
                    global.gc();
                }
            }, 300000); // Every 5 minutes
        }
    }

    cleanupExpiredEntries() {
        // Get cache statistics
        const stats = this.cache.getStats();
        console.log(`Cache stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.keys} keys`);

        // Manual cleanup for any missed expired entries
        const keys = this.cache.keys();
        keys.forEach(key => {
            const ttl = this.cache.getTtl(key);
            if (ttl && ttl < Date.now()) {
                this.cache.del(key);
            }
        });
    }

    // Connection pooling optimization
    optimizeConnections() {
        return {
            // Socket.io optimization
            socketConfig: {
                transports: ['websocket', 'polling'],
                upgradeTimeout: 30000,
                pingTimeout: 20000,
                pingInterval: 25000,
                maxHttpBufferSize: 1e6,
                allowEIO3: true,
                compression: true,
                perMessageDeflate: true
            },
            
            // HTTP optimization
            httpConfig: {
                keepAlive: true,
                keepAliveMsecs: 30000,
                maxSockets: 50,
                maxFreeSockets: 10,
                timeout: 60000
            }
        };
    }

    // Database optimization
    optimizeDatabase() {
        return {
            // Connection pool settings
            pool: {
                min: 2,
                max: 10,
                acquire: 30000,
                idle: 10000
            },
            
            // Query optimization
            optimizedQueries: {
                // Add indexes for frequently queried columns
                indexes: [
                    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
                    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
                    'CREATE INDEX IF NOT EXISTS idx_users_anonymous_name ON users(anonymous_name)',
                    'CREATE INDEX IF NOT EXISTS idx_chats_user1_id ON chats(user1_id)',
                    'CREATE INDEX IF NOT EXISTS idx_chats_user2_id ON chats(user2_id)',
                    'CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status)',
                    'CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at)',
                    'CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)',
                    'CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)',
                    'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
                    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)',
                    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)',
                    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)'
                ]
            }
        };
    }

    // Cluster mode setup
    setupCluster() {
        const numCPUs = os.cpus().length;
        const maxWorkers = Math.min(numCPUs, 4); // Don't exceed 4 workers for this app

        if (cluster.isMaster && process.env.NODE_ENV === 'production') {
            console.log(`🚀 Master process ${process.pid} is running`);
            console.log(`🔧 Starting ${maxWorkers} worker processes...`);

            // Fork workers
            for (let i = 0; i < maxWorkers; i++) {
                cluster.fork();
            }

            // Handle worker exits
            cluster.on('exit', (worker, code, signal) => {
                console.log(`💀 Worker ${worker.process.pid} died`);
                console.log('🔄 Starting a new worker...');
                cluster.fork();
            });

            // Handle graceful shutdown
            process.on('SIGTERM', () => {
                console.log('🛑 Master received SIGTERM, shutting down workers...');
                
                for (const id in cluster.workers) {
                    cluster.workers[id].kill();
                }
                
                setTimeout(() => {
                    process.exit(0);
                }, 5000);
            });

            return false; // Don't start server in master process
        } else {
            console.log(`👷 Worker ${process.pid} started`);
            return true; // Start server in worker process
        }
    }

    // Performance monitoring
    getPerformanceMetrics() {
        const cacheStats = this.cache.getStats();
        const memUsage = process.memoryUsage();

        return {
            cache: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hitRatio: this.metrics.cacheHits + this.metrics.cacheMisses > 0 ? 
                    (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100 : 0,
                keys: cacheStats.keys,
                size: cacheStats.ksize + cacheStats.vsize
            },
            memory: {
                used: Math.round(memUsage.heapUsed / 1024 / 1024),
                total: Math.round(memUsage.heapTotal / 1024 / 1024),
                usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
                external: Math.round(memUsage.external / 1024 / 1024),
                rss: Math.round(memUsage.rss / 1024 / 1024)
            },
            requests: {
                total: this.metrics.totalRequests,
                averageResponseTime: Math.round(this.metrics.averageResponseTime * 100) / 100
            },
            uptime: Math.round(process.uptime()),
            cpuUsage: this.metrics.cpuUsage
        };
    }

    // Cache warming strategies
    warmCache() {
        console.log('🔥 Warming up caches...');
        
        // Pre-cache common queries that are likely to be needed
        const commonCaches = [
            { key: 'system_stats', ttl: 300 },
            { key: 'user_count', ttl: 600 },
            { key: 'active_chats', ttl: 60 }
        ];

        commonCaches.forEach(({ key, ttl }) => {
            // This would be implemented based on your specific queries
            console.log(`Pre-caching: ${key}`);
        });
    }

    // Rate limiting optimization
    optimizedRateLimit() {
        const rateLimitCache = new NodeCache({ stdTTL: 900 }); // 15 minutes

        return (windowMs, max) => {
            return (req, res, next) => {
                const key = `rate_limit_${req.ip}`;
                const current = rateLimitCache.get(key) || 0;

                if (current >= max) {
                    return res.status(429).json({
                        success: false,
                        message: 'Rate limit exceeded',
                        retryAfter: Math.ceil(windowMs / 1000)
                    });
                }

                rateLimitCache.set(key, current + 1, windowMs / 1000);
                next();
            };
        };
    }

    // Cleanup and shutdown
    cleanup() {
        console.log('🧹 Cleaning up performance optimizer...');
        
        this.cache.flushAll();
        this.statsCache.flushAll();
        this.userSessionCache.flushAll();
        this.compressionCache.flushAll();
        
        this.cache.close();
        this.statsCache.close();
        this.userSessionCache.close();
        this.compressionCache.close();
    }
}

module.exports = PerformanceOptimizer;
