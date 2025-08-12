#!/usr/bin/env node

// Quick fix script for common Anon-Connect startup issues

const fs = require('fs');
const path = require('path');

console.log('🔧 Anon-Connect Quick Fix Script\n');

// Fix 1: Ensure .env file exists with defaults
if (!fs.existsSync('.env')) {
    console.log('📝 Creating .env file with defaults...');
    const envContent = `# Anon-Connect Environment Configuration
NODE_ENV=development
PORT=3002
SECRET_KEY=anon-connect-dev-secret-${Date.now()}
SESSION_SECRET=anon-connect-session-secret-${Date.now()}
OPENAI_API_KEY=
ADMIN_EMAIL=admin@example.com
ALLOWED_ORIGINS=http://localhost:3002
DATABASE_PATH=./anon_connect.db
ENABLE_AI_FEATURES=true
`;
    fs.writeFileSync('.env', envContent);
    console.log('✅ .env file created');
} else {
    console.log('✅ .env file already exists');
}

// Fix 2: Set NODE_ENV if not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
    console.log('✅ NODE_ENV set to development');
}

// Fix 3: Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
    console.log('✅ Created logs directory');
}

// Fix 4: Create data directory for database
if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
    console.log('✅ Created data directory');
}

// Fix 5: Check if database exists
if (!fs.existsSync('anon_connect.db')) {
    console.log('ℹ️  Database will be created automatically on first run');
}

console.log('\n🎉 All fixes applied! Try running: npm start\n');
