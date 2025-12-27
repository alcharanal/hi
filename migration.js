const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseMigration {
    constructor(dbPath = './anon_connect.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.migrations = [
            {
                version: 1,
                description: 'Initial database schema',
                up: this.migration_001_initial,
                down: this.rollback_001_initial
            },
            {
                version: 2,
                description: 'Add admin tables',
                up: this.migration_002_admin_tables,
                down: this.rollback_002_admin_tables
            },
            {
                version: 3,
                description: 'Add AI analytics tables',
                up: this.migration_003_ai_analytics,
                down: this.rollback_003_ai_analytics
            },
            {
                version: 4,
                description: 'Add monitoring and audit tables',
                up: this.migration_004_monitoring_audit,
                down: this.rollback_004_monitoring_audit
            }
        ];
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async disconnect() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Disconnected from SQLite database');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    async createMigrationsTable() {
        return new Promise((resolve, reject) => {
            const sql = `
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version INTEGER UNIQUE NOT NULL,
                    description TEXT NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Migrations table created');
                    resolve();
                }
            });
        });
    }

    async getCurrentVersion() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT MAX(version) as version FROM migrations',
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row ? row.version || 0 : 0);
                    }
                }
            );
        });
    }

    async recordMigration(version, description) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO migrations (version, description) VALUES (?, ?)',
                [version, description],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async removeMigration(version) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM migrations WHERE version = ?',
                [version],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async runQuery(sql) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Migration 001: Initial schema
    async migration_001_initial() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                anonymous_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                last_seen DATETIME,
                preferences TEXT DEFAULT '{}'
            )`,
            
            `CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME DEFAULT (datetime('now', '+24 hours')),
                ended_at DATETIME,
                FOREIGN KEY (user1_id) REFERENCES users (id),
                FOREIGN KEY (user2_id) REFERENCES users (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                sender_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_encrypted BOOLEAN DEFAULT 0,
                message_type TEXT DEFAULT 'text',
                metadata TEXT DEFAULT '{}',
                FOREIGN KEY (chat_id) REFERENCES chats (id),
                FOREIGN KEY (sender_id) REFERENCES users (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_revoked BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }
    }

    async rollback_001_initial() {
        const queries = [
            'DROP TABLE IF EXISTS refresh_tokens',
            'DROP TABLE IF EXISTS messages',
            'DROP TABLE IF EXISTS chats',
            'DROP TABLE IF EXISTS users'
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }
    }

    // Migration 002: Admin tables
    async migration_002_admin_tables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS admin_users (
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
            )`,
            
            `CREATE TABLE IF NOT EXISTS admin_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (admin_id) REFERENCES admin_users (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id INTEGER,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT 1,
                FOREIGN KEY (admin_id) REFERENCES admin_users (id)
            )`
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }
    }

    async rollback_002_admin_tables() {
        const queries = [
            'DROP TABLE IF EXISTS audit_log',
            'DROP TABLE IF EXISTS admin_sessions',
            'DROP TABLE IF EXISTS admin_users'
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }
    }

    // Migration 003: AI analytics tables
    async migration_003_ai_analytics() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS ai_analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                analysis_type TEXT NOT NULL,
                data TEXT NOT NULL,
                confidence_score REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS user_personalities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                traits TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sample_size INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS compatibility_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user1_id INTEGER NOT NULL,
                user2_id INTEGER NOT NULL,
                score REAL NOT NULL,
                factors TEXT,
                calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user1_id) REFERENCES users (id),
                FOREIGN KEY (user2_id) REFERENCES users (id)
            )`
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }
    }

    async rollback_003_ai_analytics() {
        const queries = [
            'DROP TABLE IF EXISTS compatibility_scores',
            'DROP TABLE IF EXISTS user_personalities',
            'DROP TABLE IF EXISTS ai_analyses'
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }
    }

    // Migration 004: Monitoring and audit tables
    async migration_004_monitoring_audit() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS system_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                metadata TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS error_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                error_type TEXT NOT NULL,
                error_message TEXT NOT NULL,
                stack_trace TEXT,
                endpoint TEXT,
                user_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS content_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL,
                reported_user_id INTEGER NOT NULL,
                chat_id INTEGER,
                reason TEXT NOT NULL,
                details TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                reviewed_at DATETIME,
                reviewed_by INTEGER,
                FOREIGN KEY (reporter_id) REFERENCES users (id),
                FOREIGN KEY (reported_user_id) REFERENCES users (id),
                FOREIGN KEY (chat_id) REFERENCES chats (id),
                FOREIGN KEY (reviewed_by) REFERENCES admin_users (id)
            )`
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }
    }

    async rollback_004_monitoring_audit() {
        const queries = [
            'DROP TABLE IF EXISTS content_reports',
            'DROP TABLE IF EXISTS error_logs',
            'DROP TABLE IF EXISTS system_metrics'
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }
    }

    async migrate(targetVersion = null) {
        await this.connect();
        await this.createMigrationsTable();
        
        const currentVersion = await this.getCurrentVersion();
        const migrationsToRun = this.migrations.filter(m => 
            m.version > currentVersion && 
            (targetVersion === null || m.version <= targetVersion)
        );

        console.log(`Current database version: ${currentVersion}`);
        console.log(`Migrations to run: ${migrationsToRun.length}`);

        for (const migration of migrationsToRun) {
            try {
                console.log(`Running migration ${migration.version}: ${migration.description}`);
                await migration.up.call(this);
                await this.recordMigration(migration.version, migration.description);
                console.log(`✓ Migration ${migration.version} completed`);
            } catch (error) {
                console.error(`✗ Migration ${migration.version} failed:`, error);
                throw error;
            }
        }

        await this.disconnect();
        console.log('All migrations completed successfully');
    }

    async rollback(targetVersion) {
        await this.connect();
        await this.createMigrationsTable();
        
        const currentVersion = await this.getCurrentVersion();
        const migrationsToRollback = this.migrations
            .filter(m => m.version > targetVersion && m.version <= currentVersion)
            .reverse(); // Rollback in reverse order

        console.log(`Current database version: ${currentVersion}`);
        console.log(`Rolling back to version: ${targetVersion}`);
        console.log(`Migrations to rollback: ${migrationsToRollback.length}`);

        for (const migration of migrationsToRollback) {
            try {
                console.log(`Rolling back migration ${migration.version}: ${migration.description}`);
                await migration.down.call(this);
                await this.removeMigration(migration.version);
                console.log(`✓ Migration ${migration.version} rolled back`);
            } catch (error) {
                console.error(`✗ Rollback ${migration.version} failed:`, error);
                throw error;
            }
        }

        await this.disconnect();
        console.log('Rollback completed successfully');
    }

    async backup(backupPath = null) {
        if (!backupPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            backupPath = `./backups/backup_${timestamp}.db`;
        }

        // Create backups directory if it doesn't exist
        const backupDir = path.dirname(backupPath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(this.dbPath);
            const writeStream = fs.createWriteStream(backupPath);

            readStream.on('error', reject);
            writeStream.on('error', reject);
            writeStream.on('finish', () => {
                console.log(`Database backed up to: ${backupPath}`);
                resolve(backupPath);
            });

            readStream.pipe(writeStream);
        });
    }

    async status() {
        await this.connect();
        await this.createMigrationsTable();
        
        const currentVersion = await this.getCurrentVersion();
        const appliedMigrations = await new Promise((resolve, reject) => {
            this.db.all(
                'SELECT version, description, applied_at FROM migrations ORDER BY version',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        await this.disconnect();

        console.log('\n=== Database Migration Status ===');
        console.log(`Current version: ${currentVersion}`);
        console.log(`Latest available: ${Math.max(...this.migrations.map(m => m.version))}`);
        console.log('\nApplied migrations:');
        
        if (appliedMigrations.length === 0) {
            console.log('  No migrations applied');
        } else {
            appliedMigrations.forEach(migration => {
                console.log(`  ✓ ${migration.version}: ${migration.description} (${migration.applied_at})`);
            });
        }

        console.log('\nAvailable migrations:');
        this.migrations.forEach(migration => {
            const isApplied = appliedMigrations.some(m => m.version === migration.version);
            const status = isApplied ? '✓' : '○';
            console.log(`  ${status} ${migration.version}: ${migration.description}`);
        });
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    const arg = process.argv[3];

    const migration = new DatabaseMigration();

    switch (command) {
        case 'migrate':
            migration.migrate(arg ? parseInt(arg) : null)
                .catch(err => {
                    console.error('Migration failed:', err);
                    process.exit(1);
                });
            break;

        case 'rollback':
            if (!arg) {
                console.error('Rollback requires a target version');
                process.exit(1);
            }
            migration.rollback(parseInt(arg))
                .catch(err => {
                    console.error('Rollback failed:', err);
                    process.exit(1);
                });
            break;

        case 'status':
            migration.status()
                .catch(err => {
                    console.error('Status check failed:', err);
                    process.exit(1);
                });
            break;

        case 'backup':
            migration.backup(arg)
                .catch(err => {
                    console.error('Backup failed:', err);
                    process.exit(1);
                });
            break;

        default:
            console.log('Database Migration Tool');
            console.log('');
            console.log('Usage:');
            console.log('  node migration.js migrate [version]  - Run migrations up to version (all if not specified)');
            console.log('  node migration.js rollback <version> - Rollback to specified version');
            console.log('  node migration.js status             - Show migration status');
            console.log('  node migration.js backup [path]     - Create database backup');
            console.log('');
            console.log('Examples:');
            console.log('  node migration.js migrate           - Run all pending migrations');
            console.log('  node migration.js migrate 2         - Migrate to version 2');
            console.log('  node migration.js rollback 1        - Rollback to version 1');
            console.log('  node migration.js status            - Show current status');
            console.log('  node migration.js backup            - Create timestamped backup');
            break;
    }
}

module.exports = DatabaseMigration;
