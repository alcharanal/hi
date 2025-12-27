const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const fs = require('fs');

class TestSuite {
    constructor(baseUrl = 'http://localhost:3002') {
        this.baseUrl = baseUrl;
        this.testResults = [];
        this.authToken = null;
        this.adminToken = null;
        this.testUser = {
            username: 'testuser_' + Date.now(),
            email: 'test_' + Date.now() + '@example.com',
            password: 'TestPass123!'
        };
    }

    async runAllTests() {
        console.log('🧪 Starting Anon-Connect Test Suite...\n');
        
        try {
            await this.testHealthEndpoint();
            await this.testUserRegistration();
            await this.testUserLogin();
            await this.testAuthenticatedEndpoints();
            await this.testAdminLogin();
            await this.testAdminEndpoints();
            await this.testWebSocketConnection();
            await this.testStaticFiles();
            await this.testErrorHandling();
            await this.testRateLimiting();
            await this.testAPIDocumentation();
            
            this.printTestResults();
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }

    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const requestOptions = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: 10000
            };

            if (options.body) {
                requestOptions.headers['Content-Type'] = 'application/json';
                requestOptions.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(options.body));
            }

            const req = http.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const jsonData = data ? JSON.parse(data) : {};
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: jsonData
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: data
                        });
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    addTestResult(testName, success, message, details = null) {
        this.testResults.push({
            test: testName,
            success,
            message,
            details,
            timestamp: new Date().toISOString()
        });

        const icon = success ? '✅' : '❌';
        console.log(`${icon} ${testName}: ${message}`);
        
        if (details && !success) {
            console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
        }
    }

    async testHealthEndpoint() {
        try {
            const response = await this.makeRequest('/health');
            
            if (response.statusCode === 200 && response.data.success) {
                this.addTestResult('Health Check', true, 'Health endpoint responding correctly');
            } else {
                this.addTestResult('Health Check', false, 'Health endpoint not responding correctly', response);
            }
        } catch (error) {
            this.addTestResult('Health Check', false, 'Health endpoint failed', error.message);
        }
    }

    async testUserRegistration() {
        try {
            const response = await this.makeRequest('/auth/register', {
                method: 'POST',
                body: this.testUser
            });

            if (response.statusCode === 201 && response.data.success) {
                this.addTestResult('User Registration', true, 'User registered successfully');
            } else {
                this.addTestResult('User Registration', false, 'User registration failed', response.data);
            }
        } catch (error) {
            this.addTestResult('User Registration', false, 'User registration request failed', error.message);
        }
    }

    async testUserLogin() {
        try {
            const response = await this.makeRequest('/auth/login', {
                method: 'POST',
                body: {
                    username: this.testUser.username,
                    password: this.testUser.password
                }
            });

            if (response.statusCode === 200 && response.data.success && response.data.access_token) {
                this.authToken = response.data.access_token;
                this.addTestResult('User Login', true, 'User login successful');
            } else {
                this.addTestResult('User Login', false, 'User login failed', response.data);
            }
        } catch (error) {
            this.addTestResult('User Login', false, 'User login request failed', error.message);
        }
    }

    async testAuthenticatedEndpoints() {
        if (!this.authToken) {
            this.addTestResult('Authenticated Endpoints', false, 'No auth token available');
            return;
        }

        try {
            const response = await this.makeRequest('/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.statusCode === 200 && response.data.success) {
                this.addTestResult('Authenticated Endpoints', true, 'Protected endpoint accessible with token');
            } else {
                this.addTestResult('Authenticated Endpoints', false, 'Protected endpoint failed', response.data);
            }
        } catch (error) {
            this.addTestResult('Authenticated Endpoints', false, 'Protected endpoint request failed', error.message);
        }
    }

    async testAdminLogin() {
        try {
            const response = await this.makeRequest('/admin/login', {
                method: 'POST',
                body: {
                    username: 'admin123',
                    password: 'admin321',
                    ipAddress: '127.0.0.1'
                }
            });

            if (response.statusCode === 200 && response.data.success && response.data.token) {
                this.adminToken = response.data.token;
                this.addTestResult('Admin Login', true, 'Admin login successful');
            } else {
                this.addTestResult('Admin Login', false, 'Admin login failed', response.data);
            }
        } catch (error) {
            this.addTestResult('Admin Login', false, 'Admin login request failed', error.message);
        }
    }

    async testAdminEndpoints() {
        if (!this.adminToken) {
            this.addTestResult('Admin Endpoints', false, 'No admin token available');
            return;
        }

        try {
            const response = await this.makeRequest('/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`
                }
            });

            if (response.statusCode === 200) {
                this.addTestResult('Admin Endpoints', true, 'Admin dashboard accessible');
            } else {
                this.addTestResult('Admin Endpoints', false, 'Admin dashboard failed', response.data);
            }
        } catch (error) {
            this.addTestResult('Admin Endpoints', false, 'Admin dashboard request failed', error.message);
        }
    }

    async testWebSocketConnection() {
        if (!this.authToken) {
            this.addTestResult('WebSocket Connection', false, 'No auth token for WebSocket test');
            return;
        }

        return new Promise((resolve) => {
            try {
                const wsUrl = this.baseUrl.replace('http', 'ws') + '/socket.io/?transport=websocket';
                const ws = new WebSocket(wsUrl, {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                });

                const timeout = setTimeout(() => {
                    ws.close();
                    this.addTestResult('WebSocket Connection', false, 'WebSocket connection timeout');
                    resolve();
                }, 5000);

                ws.on('open', () => {
                    clearTimeout(timeout);
                    ws.close();
                    this.addTestResult('WebSocket Connection', true, 'WebSocket connection successful');
                    resolve();
                });

                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    this.addTestResult('WebSocket Connection', false, 'WebSocket connection failed', error.message);
                    resolve();
                });

            } catch (error) {
                this.addTestResult('WebSocket Connection', false, 'WebSocket test failed', error.message);
                resolve();
            }
        });
    }

    async testStaticFiles() {
        const staticFiles = [
            '/',
            '/chat.html',
            '/admin.html',
            '/auth.html'
        ];

        for (const file of staticFiles) {
            try {
                const response = await this.makeRequest(file);
                
                if (response.statusCode === 200) {
                    this.addTestResult(`Static File: ${file}`, true, 'File served successfully');
                } else {
                    this.addTestResult(`Static File: ${file}`, false, `File not found (${response.statusCode})`);
                }
            } catch (error) {
                this.addTestResult(`Static File: ${file}`, false, 'File request failed', error.message);
            }
        }
    }

    async testErrorHandling() {
        try {
            // Test 404 error
            const response = await this.makeRequest('/nonexistent-endpoint');
            
            if (response.statusCode === 404) {
                this.addTestResult('Error Handling (404)', true, '404 errors handled correctly');
            } else {
                this.addTestResult('Error Handling (404)', false, 'Unexpected response for 404', response);
            }
        } catch (error) {
            this.addTestResult('Error Handling (404)', false, '404 test failed', error.message);
        }

        try {
            // Test unauthorized access
            const response = await this.makeRequest('/admin/stats');
            
            if (response.statusCode === 401) {
                this.addTestResult('Error Handling (401)', true, 'Unauthorized access blocked correctly');
            } else {
                this.addTestResult('Error Handling (401)', false, 'Unauthorized access not blocked', response);
            }
        } catch (error) {
            this.addTestResult('Error Handling (401)', false, '401 test failed', error.message);
        }
    }

    async testRateLimiting() {
        try {
            // Make multiple requests quickly to test rate limiting
            const requests = [];
            for (let i = 0; i < 15; i++) {
                requests.push(this.makeRequest('/auth/login', {
                    method: 'POST',
                    body: { username: 'invalid', password: 'invalid' }
                }));
            }

            const responses = await Promise.all(requests);
            const rateLimited = responses.some(response => response.statusCode === 429);

            if (rateLimited) {
                this.addTestResult('Rate Limiting', true, 'Rate limiting working correctly');
            } else {
                this.addTestResult('Rate Limiting', false, 'Rate limiting not triggered');
            }
        } catch (error) {
            this.addTestResult('Rate Limiting', false, 'Rate limiting test failed', error.message);
        }
    }

    async testAPIDocumentation() {
        try {
            const response = await this.makeRequest('/api/docs/swagger.json');
            
            if (response.statusCode === 200 && response.data.openapi) {
                this.addTestResult('API Documentation', true, 'Swagger documentation available');
            } else {
                this.addTestResult('API Documentation', false, 'Swagger documentation not available', response);
            }
        } catch (error) {
            this.addTestResult('API Documentation', false, 'API documentation test failed', error.message);
        }
    }

    printTestResults() {
        console.log('\n📊 TEST RESULTS SUMMARY');
        console.log('=' .repeat(50));
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);

        console.log(`Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        
        if (failedTests > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults
                .filter(r => !r.success)
                .forEach(result => {
                    console.log(`   • ${result.test}: ${result.message}`);
                });
        }

        // Save detailed results to file
        this.saveResultsToFile();
        
        console.log('\n🎯 Test suite completed!');
        console.log(`📁 Detailed results saved to: test-results-${Date.now()}.json`);
    }

    saveResultsToFile() {
        const results = {
            summary: {
                total: this.testResults.length,
                passed: this.testResults.filter(r => r.success).length,
                failed: this.testResults.filter(r => !r.success).length,
                successRate: ((this.testResults.filter(r => r.success).length / this.testResults.length) * 100).toFixed(1) + '%'
            },
            tests: this.testResults,
            timestamp: new Date().toISOString(),
            baseUrl: this.baseUrl
        };

        const filename = `test-results-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    }
}

// CLI interface
if (require.main === module) {
    const baseUrl = process.argv[2] || 'http://localhost:3002';
    const testSuite = new TestSuite(baseUrl);
    testSuite.runAllTests();
}

module.exports = TestSuite;
