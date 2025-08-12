const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY || 'your-super-secret-key-change-this-in-production';
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY || 'your-refresh-secret-key-change-this-in-production';
const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || '1h';
const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || '7d';

// Enhanced anonymous name generation
const ADJECTIVES = [
  "Silent", "Mysterious", "Chatty", "Friendly", "Cool", "Smart", "Quick", "Clever",
  "Bright", "Swift", "Bold", "Calm", "Wild", "Free", "Happy", "Lucky", "Magic",
  "Sunny", "Gentle", "Brave", "Noble", "Wise", "Kind", "Pure", "Strong", "Sleek",
  "Fierce", "Graceful", "Mighty", "Serene", "Vibrant", "Elegant", "Daring", "Radiant"
];

const ANIMALS = [
  "Cat", "Dog", "Wolf", "Fox", "Bear", "Lion", "Tiger", "Eagle", "Hawk", "Owl",
  "Rabbit", "Deer", "Dolphin", "Whale", "Shark", "Turtle", "Dragon", "Phoenix",
  "Panda", "Koala", "Penguin", "Seal", "Otter", "Falcon", "Raven", "Swan",
  "Leopard", "Cheetah", "Jaguar", "Lynx", "Panther", "Cobra", "Viper", "Mamba"
];

// Rate limiting storage (in production, use Redis)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

class AuthService {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(__dirname, 'anon_connect.db');
    this.db = new sqlite3.Database(this.dbPath);
    this.initRefreshTokenTable();
  }

  // Initialize refresh token table
  initRefreshTokenTable() {
    this.db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
  }

  // Enhanced anonymous name generation
  generateAnonymousName() {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const number = Math.floor(Math.random() * 900) + 100;
    return `${adjective}${animal}${number}`;
  }

  // Generate unique anonymous name
  async generateUniqueAnonymousName() {
    return new Promise((resolve, reject) => {
      const checkUniqueness = () => {
        const name = this.generateAnonymousName();
        this.db.get('SELECT id FROM users WHERE anonymous_name = ?', [name], (err, existing) => {
          if (err) {
            reject(err);
          } else if (existing) {
            checkUniqueness(); // Try again
          } else {
            resolve(name);
          }
        });
      };
      checkUniqueness();
    });
  }

  // Enhanced password validation
  validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Email validation
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Username validation
  validateUsername(username) {
    const errors = [];
    
    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    
    if (username.length > 20) {
      errors.push('Username must be no more than 20 characters long');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Generate access token
  generateAccessToken(userId, username) {
    return jwt.sign(
      { userId, username, type: 'access' },
      SECRET_KEY,
      { expiresIn: ACCESS_TOKEN_EXPIRE }
    );
  }

  // Generate refresh token
  generateRefreshToken(userId, username) {
    return jwt.sign(
      { userId, username, type: 'refresh' },
      REFRESH_SECRET_KEY,
      { expiresIn: REFRESH_TOKEN_EXPIRE }
    );
  }

  // Verify access token
  verifyAccessToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
          reject(err);
        } else if (decoded.type !== 'access') {
          reject(new Error('Invalid token type'));
        } else {
          resolve(decoded);
        }
      });
    });
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, REFRESH_SECRET_KEY, (err, decoded) => {
        if (err) {
          reject(err);
        } else if (decoded.type !== 'refresh') {
          reject(new Error('Invalid token type'));
        } else {
          resolve(decoded);
        }
      });
    });
  }

  // Store refresh token
  storeRefreshToken(userId, token) {
    return new Promise((resolve, reject) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
      
      this.db.run(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [userId, token, expiresAt.toISOString()],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Validate refresh token in database
  validateRefreshToken(token) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM refresh_tokens WHERE token = ? AND is_active = 1 AND expires_at > datetime("now")',
        [token],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // Revoke refresh token
  revokeRefreshToken(token) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE refresh_tokens SET is_active = 0 WHERE token = ?',
        [token],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }

  // Revoke all user refresh tokens
  revokeAllUserTokens(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE refresh_tokens SET is_active = 0 WHERE user_id = ?',
        [userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }

  // Check rate limiting
  checkRateLimit(identifier) {
    const now = Date.now();
    const attempts = loginAttempts.get(identifier);
    
    if (!attempts) {
      return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
    }
    
    // Clean old attempts
    const recentAttempts = attempts.filter(timestamp => now - timestamp < LOCKOUT_TIME);
    loginAttempts.set(identifier, recentAttempts);
    
    if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      const oldestAttempt = Math.min(...recentAttempts);
      const timeUntilReset = LOCKOUT_TIME - (now - oldestAttempt);
      
      return {
        allowed: false,
        remainingAttempts: 0,
        lockoutTimeMs: timeUntilReset,
        lockoutTimeMin: Math.ceil(timeUntilReset / (60 * 1000))
      };
    }
    
    return {
      allowed: true,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - recentAttempts.length
    };
  }

  // Record login attempt
  recordLoginAttempt(identifier) {
    const attempts = loginAttempts.get(identifier) || [];
    attempts.push(Date.now());
    loginAttempts.set(identifier, attempts);
  }

  // Clear login attempts (on successful login)
  clearLoginAttempts(identifier) {
    loginAttempts.delete(identifier);
  }

  // Sanitize input
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  }

  // Get user by ID
  getUserById(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, email, anonymous_name, created_at, is_active FROM users WHERE id = ?',
        [userId],
        (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(user);
          }
        }
      );
    });
  }

  // Get user by username
  getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(user);
          }
        }
      );
    });
  }

  // Check if email exists
  checkEmailExists(email) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM users WHERE email = ?',
        [email],
        (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!user);
          }
        }
      );
    });
  }

  // Check if username exists
  checkUsernameExists(username) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM users WHERE username = ?',
        [username],
        (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!user);
          }
        }
      );
    });
  }

  // Create user
  createUser(userData) {
    return new Promise((resolve, reject) => {
      const { username, email, passwordHash, anonymousName } = userData;
      
      this.db.run(
        'INSERT INTO users (username, email, password_hash, anonymous_name) VALUES (?, ?, ?, ?)',
        [username, email, passwordHash, anonymousName],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              username,
              email,
              anonymous_name: anonymousName
            });
          }
        }
      );
    });
  }

  // Update user last login
  updateLastLogin(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET last_login = datetime("now") WHERE id = ?',
        [userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }
}

module.exports = AuthService;
