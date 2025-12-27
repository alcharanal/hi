#!/usr/bin/env node

// Startup validation script for Anon-Connect
// Checks environment and dependencies before server starts

const fs = require('fs');
const path = require('path');

console.log('🔍 Anon-Connect Startup Validation...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion < 16) {
    console.error('❌ Node.js version 16+ required. Current version:', nodeVersion);
    process.exit(1);
} else {
    console.log('✅ Node.js version:', nodeVersion);
}

// Check required files
const requiredFiles = [
    'server.js',
    'package.json',
    'auth.js',
    'chat.js',
    'public/index.html',
    'public/chat.html',
    'public/admin.html'
];

let missingFiles = [];
for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
        missingFiles.push(file);
    }
}

if (missingFiles.length > 0) {
    console.error('❌ Missing required files:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    process.exit(1);
} else {
    console.log('✅ All required files present');
}

// Check environment variables
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
    console.log('ℹ️  NODE_ENV set to development');
} else {
    console.log('✅ NODE_ENV:', process.env.NODE_ENV);
}

// Check .env file
if (!fs.existsSync('.env')) {
    console.log('ℹ️  No .env file found, using defaults');
} else {
    console.log('✅ .env file found');
}

// Check node_modules
if (!fs.existsSync('node_modules')) {
    console.error('❌ node_modules not found. Run: npm install');
    process.exit(1);
} else {
    console.log('✅ Dependencies installed');
}

// Check port availability
const net = require('net');
const PORT = process.env.PORT || 3002;

const server = net.createServer();
server.listen(PORT, () => {
    server.close();
    console.log(`✅ Port ${PORT} available`);
    console.log('\n🚀 All checks passed! Ready to start server.\n');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${PORT} is busy, but that's okay if server is already running`);
        console.log('\n🚀 Validation complete!\n');
    } else {
        console.error('❌ Port check failed:', err.message);
        process.exit(1);
    }
});
