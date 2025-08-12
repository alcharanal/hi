// Enhanced Authentication JavaScript
class AuthManager {
    constructor() {
        this.isRegisterMode = true;
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
        this.passwordVisible = false;
        this.tokenRefreshInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initTheme();
        
        // Check if user is already logged in
        if (this.accessToken) {
            this.verifyAndShowDashboard();
        }
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('authentication-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });

        // Real-time validation
        document.getElementById('username').addEventListener('input', this.validateUsername.bind(this));
        document.getElementById('email').addEventListener('input', this.validateEmail.bind(this));
        document.getElementById('password').addEventListener('input', this.validatePassword.bind(this));

        // Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && document.getElementById('auth-form').style.display !== 'none') {
                this.handleAuth();
            }
        });
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    validateUsername() {
        const username = document.getElementById('username').value.trim();
        const validationEl = document.getElementById('username-validation');
        const inputEl = document.getElementById('username');
        
        if (!username) {
            this.clearValidation(validationEl, inputEl);
            return false;
        }

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

        if (errors.length > 0) {
            this.showValidation(validationEl, inputEl, errors[0], 'error');
            return false;
        } else {
            this.showValidation(validationEl, inputEl, 'Username looks good!', 'success');
            return true;
        }
    }

    validateEmail() {
        const email = document.getElementById('email').value.trim();
        const validationEl = document.getElementById('email-validation');
        const inputEl = document.getElementById('email');
        
        if (!email) {
            this.clearValidation(validationEl, inputEl);
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(email)) {
            this.showValidation(validationEl, inputEl, 'Please enter a valid email address', 'error');
            return false;
        } else {
            this.showValidation(validationEl, inputEl, 'Email format is valid', 'success');
            return true;
        }
    }

    validatePassword() {
        const password = document.getElementById('password').value;
        const validationEl = document.getElementById('password-validation');
        const inputEl = document.getElementById('password');
        const strengthContainer = document.getElementById('password-strength');
        
        if (!password) {
            this.clearValidation(validationEl, inputEl);
            strengthContainer.style.display = 'none';
            return false;
        }

        if (this.isRegisterMode) {
            strengthContainer.style.display = 'block';
            const strength = this.calculatePasswordStrength(password);
            this.updatePasswordStrength(strength);
        }

        const errors = [];
        
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        
        if (!/[a-z]/.test(password)) {
            errors.push('Must contain at least one lowercase letter');
        }
        
        if (!/[A-Z]/.test(password)) {
            errors.push('Must contain at least one uppercase letter');
        }
        
        if (!/\d/.test(password)) {
            errors.push('Must contain at least one number');
        }
        
        if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
            errors.push('Must contain at least one special character');
        }

        if (errors.length > 0 && this.isRegisterMode) {
            this.showValidation(validationEl, inputEl, errors[0], 'error');
            return false;
        } else if (this.isRegisterMode) {
            this.showValidation(validationEl, inputEl, 'Password meets security requirements', 'success');
            return true;
        }

        return true;
    }

    calculatePasswordStrength(password) {
        let score = 0;
        
        // Length
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        
        // Character types
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[!@#$%^&*(),.?\":{}|<>]/.test(password)) score += 1;
        
        // Complexity
        if (password.length >= 16) score += 1;
        if (/[!@#$%^&*(),.?\":{}|<>].*[!@#$%^&*(),.?\":{}|<>]/.test(password)) score += 1;

        return Math.min(score, 4);
    }

    updatePasswordStrength(score) {
        const fillEl = document.getElementById('strength-fill');
        const textEl = document.getElementById('strength-text');
        
        fillEl.className = 'strength-fill';
        
        switch (score) {
            case 0:
            case 1:
                fillEl.classList.add('strength-weak');
                textEl.textContent = 'Weak password';
                break;
            case 2:
                fillEl.classList.add('strength-fair');
                textEl.textContent = 'Fair password';
                break;
            case 3:
                fillEl.classList.add('strength-good');
                textEl.textContent = 'Good password';
                break;
            case 4:
                fillEl.classList.add('strength-strong');
                textEl.textContent = 'Strong password';
                break;
        }
    }

    showValidation(validationEl, inputEl, message, type) {
        validationEl.textContent = message;
        validationEl.className = `validation-message ${type}`;
        validationEl.style.display = 'flex';
        
        inputEl.className = type;
    }

    clearValidation(validationEl, inputEl) {
        validationEl.style.display = 'none';
        inputEl.className = '';
    }

    togglePassword() {
        const passwordInput = document.getElementById('password');
        const toggleIcon = document.querySelector('.password-toggle');
        
        this.passwordVisible = !this.passwordVisible;
        passwordInput.type = this.passwordVisible ? 'text' : 'password';
        toggleIcon.textContent = this.passwordVisible ? '🙈' : '👁️';
    }

    switchMode(event) {
        if (event) event.preventDefault();
        
        this.isRegisterMode = !this.isRegisterMode;
        const emailGroup = document.getElementById('email-group');
        const authBtn = document.getElementById('auth-btn-text');
        const switchText = document.getElementById('switch-text');
        const switchLink = document.getElementById('switch-link');
        const strengthContainer = document.getElementById('password-strength');
        
        if (this.isRegisterMode) {
            emailGroup.style.display = 'block';
            authBtn.textContent = 'Create Account';
            switchText.textContent = 'Already have an account?';
            switchLink.textContent = 'Sign In';
            document.getElementById('password').setAttribute('autocomplete', 'new-password');
        } else {
            emailGroup.style.display = 'none';
            authBtn.textContent = 'Sign In';
            switchText.textContent = "Don't have an account?";
            switchLink.textContent = 'Create Account';
            strengthContainer.style.display = 'none';
            document.getElementById('password').setAttribute('autocomplete', 'current-password');
        }
        
        // Clear form
        document.getElementById('authentication-form').reset();
        this.clearAllValidations();
    }

    clearAllValidations() {
        const validations = document.querySelectorAll('.validation-message');
        const inputs = document.querySelectorAll('input');
        
        validations.forEach(el => el.style.display = 'none');
        inputs.forEach(el => el.className = '');
    }

    async handleAuth() {
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        // Validate all fields
        const usernameValid = this.validateUsername();
        const emailValid = this.isRegisterMode ? this.validateEmail() : true;
        const passwordValid = this.validatePassword();
        
        if (!usernameValid || !passwordValid || (this.isRegisterMode && !emailValid)) {
            this.showStatus('Please fix the validation errors above', 'error');
            return;
        }
        
        if (!username || !password || (this.isRegisterMode && !email)) {
            this.showStatus('Please fill in all required fields', 'error');
            return;
        }
        
        this.setLoading(true);
        
        try {
            const endpoint = this.isRegisterMode ? '/auth/register' : '/auth/login';
            const body = this.isRegisterMode ? { username, email, password } : { username, password };
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (this.isRegisterMode) {
                    this.showStatus('Registration successful! Please sign in with your credentials.', 'success');
                    setTimeout(() => {
                        this.switchMode();
                        // Pre-fill username
                        document.getElementById('username').value = username;
                    }, 2000);
                } else {
                    // Login successful
                    this.accessToken = data.access_token;
                    this.refreshToken = data.refresh_token;
                    
                    localStorage.setItem('accessToken', this.accessToken);
                    localStorage.setItem('refreshToken', this.refreshToken);
                    
                    this.showStatus('Login successful! Welcome back.', 'success');
                    this.startTokenRefresh();
                    
                    setTimeout(() => {
                        this.showDashboard(data.user);
                    }, 1000);
                }
            } else {
                if (data.lockoutTimeMs) {
                    this.showStatus(`${data.message} Please wait ${Math.ceil(data.lockoutTimeMs / 60000)} minutes.`, 'warning');
                } else {
                    this.showStatus(data.message || 'Authentication failed', 'error');
                }
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showStatus('Network error. Please check your connection and try again.', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async verifyAndShowDashboard() {
        try {
            const response = await this.authenticatedFetch('/auth/me');
            
            if (response.ok) {
                const data = await response.json();
                this.showDashboard(data.user);
                this.startTokenRefresh();
            } else {
                // Token invalid, clear storage
                this.clearTokens();
            }
        } catch (error) {
            console.error('Token verification error:', error);
            this.clearTokens();
        }
    }

    async authenticatedFetch(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        let response = await fetch(url, defaultOptions);
        
        // If token expired, try to refresh
        if (response.status === 401 && this.refreshToken) {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
                // Retry the original request with new token
                defaultOptions.headers['Authorization'] = `Bearer ${this.accessToken}`;
                response = await fetch(url, defaultOptions);
            }
        }
        
        return response;
    }

    async refreshAccessToken() {
        try {
            const response = await fetch('/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refresh_token: this.refreshToken
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.accessToken = data.access_token;
                localStorage.setItem('accessToken', this.accessToken);
                return true;
            } else {
                // Refresh token invalid, logout user
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            this.logout();
            return false;
        }
    }

    startTokenRefresh() {
        // Refresh token every 50 minutes (tokens expire in 60 minutes)
        this.tokenRefreshInterval = setInterval(() => {
            this.refreshAccessToken();
        }, 50 * 60 * 1000);
    }

    stopTokenRefresh() {
        if (this.tokenRefreshInterval) {
            clearInterval(this.tokenRefreshInterval);
            this.tokenRefreshInterval = null;
        }
    }

    showDashboard(user) {
        document.getElementById('auth-form').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        // Set user avatar (first letter of anonymous name)
        const avatar = document.getElementById('user-avatar');
        avatar.textContent = user.anonymous_name.charAt(0);
        
        // Set anonymous name
        document.getElementById('anonymous-name').textContent = user.anonymous_name;
        
        // Set user info
        const userInfo = document.getElementById('user-info');
        userInfo.innerHTML = `
            <div class=\"user-info-item\">
                <span>Username:</span>
                <span>${user.username}</span>
            </div>
            <div class=\"user-info-item\">
                <span>Email:</span>
                <span>${user.email}</span>
            </div>
            <div class=\"user-info-item\">
                <span>Member since:</span>
                <span>${new Date(user.created_at).toLocaleDateString()}</span>
            </div>
            <div class=\"user-info-item\">
                <span>Status:</span>
                <span style=\"color: var(--success-color)\">${user.is_active ? 'Active' : 'Inactive'}</span>
            </div>
        `;
    }

    async logout() {
        try {
            // Call logout endpoint
            await this.authenticatedFetch('/auth/logout', {
                method: 'POST',
                body: JSON.stringify({
                    refresh_token: this.refreshToken
                })
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        this.clearTokens();
        this.stopTokenRefresh();
        
        // Show auth form
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('auth-form').style.display = 'block';
        
        // Clear form
        document.getElementById('authentication-form').reset();
        this.clearAllValidations();
        
        this.showStatus('Logged out successfully', 'success');
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    }

    setLoading(loading) {
        const button = document.getElementById('auth-btn');
        button.classList.toggle('loading', loading);
        button.disabled = loading;
    }

    showStatus(message, type) {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'flex';
        
        // Auto-hide success and error messages
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }
}

// Global functions for HTML event handlers
let authManager;

function toggleTheme() {
    authManager.toggleTheme();
}

function togglePassword() {
    authManager.togglePassword();
}

function switchMode(event) {
    authManager.switchMode(event);
}

function logout() {
    authManager.logout();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    authManager = new AuthManager();
});
