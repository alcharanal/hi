const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const AuthService = require('./auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-super-secret-key-change-this-in-production';

// Initialize auth service
const authService = new AuthService();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Apply rate limiting
app.use('/auth', authLimiter);
app.use(generalLimiter);

// CORS and body parsing middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Database setup
const dbPath = path.join(__dirname, 'anon_connect.db');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    anonymous_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
  )`);

  // Chats table
  db.run(`CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (datetime('now', '+24 hours')),
    FOREIGN KEY (user1_id) REFERENCES users (id),
    FOREIGN KEY (user2_id) REFERENCES users (id)
  )`);

  // Messages table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_encrypted BOOLEAN DEFAULT 0,
    FOREIGN KEY (chat_id) REFERENCES chats (id),
    FOREIGN KEY (sender_id) REFERENCES users (id)
  )`);
});

// Anonymous name generator
const ADJECTIVES = [
  "Silent", "Mysterious", "Chatty", "Friendly", "Cool", "Smart", "Quick", "Clever",
  "Bright", "Swift", "Bold", "Calm", "Wild", "Free", "Happy", "Lucky", "Magic",
  "Sunny", "Gentle", "Brave", "Noble", "Wise", "Kind", "Pure", "Strong"
];

const ANIMALS = [
  "Cat", "Dog", "Wolf", "Fox", "Bear", "Lion", "Tiger", "Eagle", "Hawk", "Owl",
  "Rabbit", "Deer", "Dolphin", "Whale", "Shark", "Turtle", "Dragon", "Phoenix",
  "Panda", "Koala", "Penguin", "Seal", "Otter", "Falcon", "Raven", "Swan"
];

function generateAnonymousName() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const number = Math.floor(Math.random() * 900) + 100;
  return `${adjective}${animal}${number}`;
}

// Enhanced middleware to verify JWT token
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const decoded = await authService.verifyAccessToken(token);
    const user = await authService.getUserById(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = {
      userId: user.id,
      username: user.username,
      email: user.email,
      anonymousName: user.anonymous_name
    };
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Anon-Connect API is running successfully!',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Anon-Connect - Anonymous Chat Platform!',
    data: {
      version: '1.0.0',
      endpoints: ['/health', '/auth/register', '/auth/login', '/auth/me', '/db/status']
    }
  });
});

// User registration
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error during user check'
        });
      }

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already exists'
        });
      }

      // Generate unique anonymous name
      const generateUniqueAnonymousName = async () => {
        const name = generateAnonymousName();
        return new Promise((resolve) => {
          db.get('SELECT id FROM users WHERE anonymous_name = ?', [name], (err, existing) => {
            if (existing) {
              resolve(generateUniqueAnonymousName());
            } else {
              resolve(name);
            }
          });
        });
      };

      const anonymousName = await generateUniqueAnonymousName();
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert new user
      db.run(
        'INSERT INTO users (username, email, password_hash, anonymous_name) VALUES (?, ?, ?, ?)',
        [username, email, passwordHash, anonymousName],
        function(err) {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Error creating user'
            });
          }

          res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
              id: this.lastID,
              username,
              email,
              anonymous_name: anonymousName
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// User login
app.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error during login'
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        SECRET_KEY,
        { expiresIn: '30m' }
      );

      res.json({
        access_token: token,
        token_type: 'bearer'
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// Get current user info
app.get('/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, anonymous_name, created_at, is_active FROM users WHERE id = ?', 
    [req.user.userId], 
    (err, user) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User information retrieved successfully',
        user
      });
    }
  );
});

// Database status
app.get('/db/status', (req, res) => {
  db.get('SELECT COUNT(*) as user_count FROM users', (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed'
      });
    }

    res.json({
      success: true,
      message: 'Database connection successful',
      data: {
        total_users: result.user_count,
        database_type: 'SQLite',
        status: 'connected'
      }
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Anon-Connect server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  / - Welcome message`);
  console.log(`   POST /auth/register - User registration`);
  console.log(`   POST /auth/login - User login`);
  console.log(`   GET  /auth/me - Current user info`);
  console.log(`   GET  /db/status - Database status`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
  process.exit(0);
});
