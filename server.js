const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const AuthService = require('./auth');
const ConnectionManager = require('./chat');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3002;
const SECRET_KEY = process.env.SECRET_KEY || 'your-super-secret-key-change-this-in-production';

// Initialize services
const authService = new AuthService();
const connectionManager = new ConnectionManager();

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

// Trust proxy for rate limiting
app.set('trust proxy', 1);

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

// Enhanced user registration
app.post('/auth/register', async (req, res) => {
  try {
    let { username, email, password } = req.body;

    // Sanitize inputs
    username = authService.sanitizeInput(username);
    email = authService.sanitizeInput(email);

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Validate username
    const usernameValidation = authService.validateUsername(username);
    if (!usernameValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid username',
        errors: usernameValidation.errors
      });
    }

    // Validate email
    if (!authService.validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    const passwordValidation = authService.validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    // Check if username exists
    const usernameExists = await authService.checkUsernameExists(username);
    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken'
      });
    }

    // Check if email exists
    const emailExists = await authService.checkEmailExists(email);
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate unique anonymous name and hash password
    const anonymousName = await authService.generateUniqueAnonymousName();
    const passwordHash = await authService.hashPassword(password);

    // Create user
    const newUser = await authService.createUser({
      username,
      email,
      passwordHash,
      anonymousName
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        anonymous_name: newUser.anonymous_name
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// Enhanced user login with rate limiting
app.post('/auth/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Sanitize inputs
    username = authService.sanitizeInput(username);

    // Basic validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check rate limiting
    const rateCheck = authService.checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many login attempts. Please try again in ${rateCheck.lockoutTimeMin} minutes.`,
        lockoutTimeMs: rateCheck.lockoutTimeMs
      });
    }

    // Get user
    const user = await authService.getUserByUsername(username);

    if (!user) {
      authService.recordLoginAttempt(clientIP);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Verify password
    const validPassword = await authService.verifyPassword(password, user.password_hash);
    if (!validPassword) {
      authService.recordLoginAttempt(clientIP);
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

    // Clear login attempts on successful login
    authService.clearLoginAttempts(clientIP);

    // Generate tokens
    const accessToken = authService.generateAccessToken(user.id, user.username);
    const refreshToken = authService.generateRefreshToken(user.id, user.username);

    // Store refresh token
    await authService.storeRefreshToken(user.id, refreshToken);

    // Update last login
    await authService.updateLastLogin(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: '1h',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        anonymous_name: user.anonymous_name
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// Get current user info
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User information retrieved successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        anonymous_name: user.anonymous_name,
        created_at: user.created_at,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error'
    });
  }
});

// Refresh token endpoint
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token signature
    const decoded = await authService.verifyRefreshToken(refresh_token);

    // Validate refresh token in database
    const tokenRecord = await authService.validateRefreshToken(refresh_token);
    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Get user
    const user = await authService.getUserById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new access token
    const newAccessToken = authService.generateAccessToken(user.id, user.username);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      access_token: newAccessToken,
      token_type: 'bearer',
      expires_in: '1h'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
});

// Logout endpoint
app.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (refresh_token) {
      // Revoke the specific refresh token
      await authService.revokeRefreshToken(refresh_token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});

// Logout from all devices
app.post('/auth/logout-all', authenticateToken, async (req, res) => {
  try {
    // Revoke all refresh tokens for the user
    const revokedCount = await authService.revokeAllUserTokens(req.user.userId);

    res.json({
      success: true,
      message: `Logged out from all devices successfully`,
      revoked_tokens: revokedCount
    });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout from all devices'
    });
  }
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

// Socket.io WebSocket handlers
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const decoded = await authService.verifyAccessToken(token);
    const user = await authService.getUserById(decoded.userId);

    if (!user || !user.is_active) {
      throw new Error('User not found or inactive');
    }

    socket.userId = user.id;
    socket.userProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      anonymousName: user.anonymous_name
    };

    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  const userProfile = socket.userProfile;

  console.log(`Socket connected: ${userProfile.anonymousName} (${userId})`);

  // Add connection to manager
  connectionManager.addConnection(userId, socket, userProfile);

  // Message handling
  socket.on('sendMessage', async (data) => {
    try {
      const result = await connectionManager.handleMessage(userId, data);
      if (result.success) {
        socket.emit('messageConfirmed', { messageId: data.tempId, actualId: result.message.id });
      } else {
        socket.emit('messageError', { error: result.error, tempId: data.tempId });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      socket.emit('messageError', { error: 'Failed to send message', tempId: data.tempId });
    }
  });

  // Typing indicators
  socket.on('typingStart', () => {
    connectionManager.handleTypingStart(userId);
  });

  socket.on('typingStop', () => {
    connectionManager.handleTypingStop(userId);
  });

  // Room management
  socket.on('leaveQueue', () => {
    connectionManager.removeFromWaitingQueue(userId);
    socket.emit('queueLeft');
  });

  socket.on('joinQueue', () => {
    connectionManager.addToWaitingQueue(userId);
  });

  socket.on('leaveRoom', () => {
    const roomId = connectionManager.userRooms.get(userId);
    if (roomId) {
      connectionManager.leaveRoom(userId, roomId);
      socket.emit('roomLeft');
    }
  });

  // AI-related events
  socket.on('updatePrivacySettings', (data) => {
    connectionManager.setUserPrivacySettings(userId, data.settings);
    socket.emit('privacySettingsUpdated', { settings: data.settings });
  });

  socket.on('getTopicSuggestions', (data) => {
    const roomId = connectionManager.userRooms.get(userId);
    if (roomId) {
      const suggestions = connectionManager.getTopicSuggestions(roomId, data.context);
      socket.emit('topicSuggestions', { suggestions });
    }
  });

  socket.on('topicSuggestionUsed', (data) => {
    // Track topic suggestion usage for improvement
    console.log(`Topic suggestion ${data.topicId} used by ${userId}, success: ${data.success}`);
  });

  socket.on('getMoodAnalysis', async () => {
    const roomId = connectionManager.userRooms.get(userId);
    if (roomId) {
      const mood = await connectionManager.getMoodAnalysis(userId, roomId);
      if (mood) {
        socket.emit('moodUpdate', mood.toJSON());
      }
    }
  });

  socket.on('requestAIInsights', async () => {
    const roomId = connectionManager.userRooms.get(userId);
    if (roomId) {
      await connectionManager.sendAIInsights(userId, roomId);
    }
  });

  // Heartbeat/keepalive
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${userProfile.anonymousName} (${userId}) - Reason: ${reason}`);
    connectionManager.removeConnection(userId);
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`Socket error for ${userProfile.anonymousName} (${userId}):`, error);
  });
});

// Chat statistics endpoint
app.get('/chat/stats', (req, res) => {
  const stats = connectionManager.getStats();
  res.json({
    success: true,
    data: stats
  });
});

// Start server with Socket.io
server.listen(PORT, () => {
  console.log(`🚀 Anon-Connect server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  / - Welcome message`);
  console.log(`   GET  /chat.html - Real-time chat interface`);
  console.log(`   POST /auth/register - User registration`);
  console.log(`   POST /auth/login - User login`);
  console.log(`   GET  /auth/me - Current user info`);
  console.log(`   GET  /db/status - Database status`);
  console.log(`   GET  /chat/stats - Chat system statistics`);
  console.log(`🔌 WebSocket server ready for connections`);
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
