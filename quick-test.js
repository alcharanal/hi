#!/usr/bin/env node

const http = require('http');

console.log('🧪 Testing Anon-Connect Server...\n');

const tests = [
    { name: 'Health Check', path: '/health' },
    { name: 'Landing Page', path: '/' },
    { name: 'Chat Interface', path: '/chat.html' },
    { name: 'Admin Dashboard', path: '/admin.html' },
    { name: 'API Documentation', path: '/api/docs' }
];

async function testEndpoint(name, path) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:3002${path}`, (res) => {
            const status = res.statusCode === 200 ? '✅' : '❌';
            console.log(`${status} ${name}: http://localhost:3002${path} (${res.statusCode})`);
            resolve(res.statusCode === 200);
        });

        req.on('error', () => {
            console.log(`❌ ${name}: http://localhost:3002${path} (ERROR)`);
            resolve(false);
        });

        req.setTimeout(5000, () => {
            console.log(`⏰ ${name}: http://localhost:3002${path} (TIMEOUT)`);
            req.destroy();
            resolve(false);
        });
    });
}

async function runTests() {
    let passed = 0;
    
    for (const test of tests) {
        const success = await testEndpoint(test.name, test.path);
        if (success) passed++;
    }
    
    console.log(`\n📊 Results: ${passed}/${tests.length} tests passed`);
    
    if (passed === tests.length) {
        console.log('\n🎉 All tests passed! Server is working correctly.');
        console.log('\n🌐 Open your browser to: http://localhost:3002');
    } else {
        console.log('\n🚨 Some tests failed. Check if the server is running:');
        console.log('   npm start');
    }
}

runTests().catch(console.error);
