// Admin Dashboard Frontend Manager
class AdminDashboard {
    constructor() {
        this.adminToken = localStorage.getItem('adminToken');
        this.currentAdmin = null;
        this.refreshInterval = null;
        this.charts = {};
        this.currentSection = 'overview';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeTheme();
        
        if (this.adminToken) {
            this.verifyTokenAndShowDashboard();
        } else {
            this.showLoginScreen();
        }
    }

    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', this.handleLogin.bind(this));
        
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', this.handleNavigation.bind(this));
        });
        
        // Header actions
        document.getElementById('logout-btn').addEventListener('click', this.handleLogout.bind(this));
        document.getElementById('refresh-btn').addEventListener('click', this.refreshData.bind(this));
        document.getElementById('theme-toggle').addEventListener('click', this.toggleTheme.bind(this));
        document.getElementById('sidebar-toggle').addEventListener('click', this.toggleSidebar.bind(this));
        
        // User management
        document.getElementById('user-filter').addEventListener('change', this.filterUsers.bind(this));
        document.getElementById('export-users-btn').addEventListener('click', this.exportUsers.bind(this));
        
        // Responsive sidebar
        window.addEventListener('resize', this.handleResize.bind(this));
        this.handleResize();
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('adminTheme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    // Authentication
    async handleLogin(e) {
        e.preventDefault();
        
        const loginBtn = document.getElementById('login-btn');
        const loginText = document.getElementById('login-text');
        const loginLoading = document.getElementById('login-loading');
        const errorDiv = document.getElementById('login-error');
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Show loading state
        loginText.style.display = 'none';
        loginLoading.style.display = 'flex';
        loginBtn.disabled = true;
        errorDiv.style.display = 'none';
        
        try {
            const response = await fetch('/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username, 
                    password,
                    ipAddress: await this.getClientIP()
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.adminToken = data.token;
                this.currentAdmin = data.admin;
                localStorage.setItem('adminToken', this.adminToken);
                
                this.showDashboard();
                this.startDataRefresh();
            } else {
                this.showLoginError(data.message);
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showLoginError('Network error. Please try again.');
        } finally {
            // Reset loading state
            loginText.style.display = 'block';
            loginLoading.style.display = 'none';
            loginBtn.disabled = false;
        }
    }

    async verifyTokenAndShowDashboard() {
        try {
            const response = await this.authenticatedFetch('/admin/verify');
            
            if (response.ok) {
                const data = await response.json();
                this.currentAdmin = data.admin;
                this.showDashboard();
                this.startDataRefresh();
            } else {
                this.handleLogout();
            }
        } catch (error) {
            console.error('Token verification error:', error);
            this.handleLogout();
        }
    }

    showLoginScreen() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        this.loadDashboardData();
    }

    showLoginError(message) {
        const errorDiv = document.getElementById('login-error');
        const errorText = document.getElementById('login-error-text');
        
        errorText.textContent = message;
        errorDiv.style.display = 'flex';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    async handleLogout() {
        try {
            if (this.adminToken) {
                await this.authenticatedFetch('/admin/logout', { method: 'POST' });
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        this.adminToken = null;
        this.currentAdmin = null;
        localStorage.removeItem('adminToken');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.showLoginScreen();
    }

    // Navigation
    handleNavigation(e) {
        e.preventDefault();
        
        const section = e.target.dataset.section;
        if (!section) return;
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // Update sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');
        
        // Update header title
        const titles = {
            overview: 'Dashboard Overview',
            users: 'User Management',
            chats: 'Chat Monitoring',
            reports: 'Content Reports',
            system: 'System Health',
            analytics: 'Analytics',
            audit: 'Audit Log'
        };
        
        document.getElementById('section-title').textContent = titles[section];
        this.currentSection = section;
        
        // Load section-specific data
        this.loadSectionData(section);
    }

    // Data Loading
    async loadDashboardData() {
        await Promise.all([
            this.loadStats(),
            this.loadSystemStatus(),
            this.loadActivityFeed()
        ]);
    }

    async loadSectionData(section) {
        switch (section) {
            case 'overview':
                await this.loadDashboardData();
                break;
            case 'users':
                await this.loadUsers();
                break;
            case 'chats':
                await this.loadChats();
                break;
            case 'reports':
                await this.loadReports();
                break;
            case 'system':
                await this.loadSystemHealth();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
            case 'audit':
                await this.loadAuditLog();
                break;
        }
    }

    async loadStats() {
        try {
            const response = await this.authenticatedFetch('/admin/stats');
            const stats = await response.json();
            
            this.renderStatsCards(stats);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    renderStatsCards(stats) {
        const statsGrid = document.getElementById('stats-grid');
        
        const cards = [
            {
                title: 'Total Users',
                value: stats.totalUsers || 0,
                icon: 'fas fa-users',
                color: '#6366f1',
                change: this.calculateChange(stats.totalUsers, stats.newUsersWeek)
            },
            {
                title: 'Active Users',
                value: stats.activeUsers || 0,
                icon: 'fas fa-user-check',
                color: '#10b981',
                change: null
            },
            {
                title: 'Active Chats',
                value: stats.activeChats || 0,
                icon: 'fas fa-comments',
                color: '#8b5cf6',
                change: null
            },
            {
                title: 'Messages Today',
                value: stats.messagesToday || 0,
                icon: 'fas fa-envelope',
                color: '#f59e0b',
                change: null
            }
        ];
        
        statsGrid.innerHTML = cards.map(card => `
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title">${card.title}</span>
                    <div class="stat-icon" style="background: ${card.color}">
                        <i class="${card.icon}"></i>
                    </div>
                </div>
                <div class="stat-value">${this.formatNumber(card.value)}</div>
                ${card.change ? `
                    <div class="stat-change ${card.change.type}">
                        <i class="fas fa-arrow-${card.change.type === 'positive' ? 'up' : 'down'}"></i>
                        ${card.change.value}% from last week
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    async loadSystemStatus() {
        try {
            const response = await this.authenticatedFetch('/admin/system/health');
            const health = await response.json();
            
            this.renderSystemStatus(health);
        } catch (error) {
            console.error('Error loading system status:', error);
        }
    }

    renderSystemStatus(health) {
        const statusContainer = document.getElementById('system-status');
        
        const getStatusColor = (status) => {
            switch (status) {
                case 'healthy': return '#10b981';
                case 'warning': return '#f59e0b';
                case 'critical': return '#ef4444';
                default: return '#6b7280';
            }
        };
        
        statusContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                ${Object.entries(health.checks).map(([key, check]) => `
                    <div style="padding: 16px; border: 1px solid var(--border-color); border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${getStatusColor(check.status)}"></div>
                            <span style="font-weight: 600; text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1')}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">
                            Status: ${check.status}
                            ${check.responseTime ? `<br>Response: ${check.responseTime}ms` : ''}
                            ${check.recentCount !== undefined ? `<br>Recent: ${check.recentCount}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                <strong>Overall Status:</strong> 
                <span style="color: ${getStatusColor(health.overall)}; font-weight: 600; text-transform: uppercase;">
                    ${health.overall}
                </span>
                <span style="margin-left: 16px; color: var(--text-secondary);">
                    Uptime: ${health.uptime}
                </span>
            </div>
        `;
    }

    async loadActivityFeed() {
        try {
            const response = await this.authenticatedFetch('/admin/activity/recent');
            const activities = await response.json();
            
            this.renderActivityFeed(activities);
        } catch (error) {
            console.error('Error loading activity feed:', error);
        }
    }

    renderActivityFeed(activities) {
        const activityFeed = document.getElementById('activity-feed');
        
        if (!activities || activities.length === 0) {
            activityFeed.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No recent activity</p>';
            return;
        }
        
        activityFeed.innerHTML = activities.map(activity => {
            const iconColor = this.getActivityIconColor(activity.action);
            const icon = this.getActivityIcon(activity.action);
            
            return `
                <div class="activity-item">
                    <div class="activity-icon" style="background: ${iconColor}">
                        <i class="${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.details}</div>
                        <div class="activity-time">${this.formatTimeAgo(activity.timestamp)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadUsers() {
        const filter = document.getElementById('user-filter').value;
        
        try {
            const response = await this.authenticatedFetch(`/admin/users?filter=${filter}&page=1&limit=50`);
            const data = await response.json();
            
            this.renderUsersTable(data.users);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    renderUsersTable(users) {
        const tbody = document.getElementById('users-tbody');
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.anonymous_name}</td>
                <td>${this.formatDate(user.created_at)}</td>
                <td>
                    <span class="status-badge status-${user.is_active ? 'online' : 'banned'}">
                        ${user.is_active ? 'Active' : 'Banned'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${user.is_active ? 
                            `<button class="btn btn-warning" onclick="adminDashboard.banUser(${user.id})">Ban</button>` :
                            `<button class="btn btn-success" onclick="adminDashboard.unbanUser(${user.id})">Unban</button>`
                        }
                        <button class="btn btn-danger" onclick="adminDashboard.deleteUser(${user.id})">Delete</button>
                        <button class="btn btn-primary" onclick="adminDashboard.viewUser(${user.id})">View</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async loadChats() {
        try {
            const response = await this.authenticatedFetch('/admin/chats/active');
            const chats = await response.json();
            
            this.renderChatsTable(chats);
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    renderChatsTable(chats) {
        const tbody = document.getElementById('chats-tbody');
        
        tbody.innerHTML = chats.map(chat => `
            <tr>
                <td>${chat.id}</td>
                <td>${chat.user1_anonymous}</td>
                <td>${chat.user2_anonymous}</td>
                <td>${chat.message_count}</td>
                <td>${this.formatDate(chat.created_at)}</td>
                <td>
                    <span class="status-badge status-${chat.status === 'active' ? 'online' : 'offline'}">
                        ${chat.status}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="adminDashboard.viewChat('${chat.id}')">View</button>
                        <button class="btn btn-warning" onclick="adminDashboard.terminateChat('${chat.id}')">Terminate</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // User Actions
    async banUser(userId) {
        if (!confirm('Are you sure you want to ban this user?')) return;
        
        const reason = prompt('Please provide a reason for banning this user:');
        if (!reason) return;
        
        try {
            const response = await this.authenticatedFetch('/admin/users/ban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, reason })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert('User banned successfully', 'success');
                this.loadUsers();
            } else {
                this.showAlert(result.message, 'error');
            }
        } catch (error) {
            console.error('Error banning user:', error);
            this.showAlert('Error banning user', 'error');
        }
    }

    async unbanUser(userId) {
        if (!confirm('Are you sure you want to unban this user?')) return;
        
        try {
            const response = await this.authenticatedFetch('/admin/users/unban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert('User unbanned successfully', 'success');
                this.loadUsers();
            } else {
                this.showAlert(result.message, 'error');
            }
        } catch (error) {
            console.error('Error unbanning user:', error);
            this.showAlert('Error unbanning user', 'error');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;
        
        try {
            const response = await this.authenticatedFetch('/admin/users/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert('User deleted successfully', 'success');
                this.loadUsers();
            } else {
                this.showAlert(result.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showAlert('Error deleting user', 'error');
        }
    }

    async exportUsers() {
        try {
            const response = await this.authenticatedFetch('/admin/users/export?format=csv');
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showAlert('Users exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting users:', error);
            this.showAlert('Error exporting users', 'error');
        }
    }

    // Utility Methods
    async authenticatedFetch(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        const response = await fetch(url, defaultOptions);
        
        if (response.status === 401) {
            this.handleLogout();
            throw new Error('Authentication failed');
        }
        
        return response;
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return this.formatDate(dateString);
    }

    calculateChange(current, previous) {
        if (!previous || previous === 0) return null;
        
        const change = ((current - previous) / previous) * 100;
        return {
            value: Math.abs(change).toFixed(1),
            type: change >= 0 ? 'positive' : 'negative'
        };
    }

    getActivityIconColor(action) {
        const colors = {
            'LOGIN': '#10b981',
            'LOGOUT': '#6b7280',
            'BAN_USER': '#ef4444',
            'UNBAN_USER': '#10b981',
            'DELETE_USER': '#ef4444',
            'TERMINATE_CHAT': '#f59e0b',
            'REVIEW_REPORT': '#3b82f6'
        };
        return colors[action] || '#6b7280';
    }

    getActivityIcon(action) {
        const icons = {
            'LOGIN': 'fas fa-sign-in-alt',
            'LOGOUT': 'fas fa-sign-out-alt',
            'BAN_USER': 'fas fa-ban',
            'UNBAN_USER': 'fas fa-user-check',
            'DELETE_USER': 'fas fa-trash',
            'TERMINATE_CHAT': 'fas fa-times-circle',
            'REVIEW_REPORT': 'fas fa-flag'
        };
        return icons[action] || 'fas fa-info';
    }

    showAlert(message, type) {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add to page
        const header = document.querySelector('.header');
        header.parentNode.insertBefore(alert, header.nextSibling);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('adminTheme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('#theme-toggle i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    handleResize() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (window.innerWidth <= 768) {
            sidebarToggle.style.display = 'block';
        } else {
            sidebarToggle.style.display = 'none';
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    refreshData() {
        this.loadSectionData(this.currentSection);
        this.showAlert('Data refreshed', 'success');
    }

    startDataRefresh() {
        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadSectionData(this.currentSection);
        }, 30000);
    }

    filterUsers() {
        this.loadUsers();
    }

    // Placeholder methods for other sections
    async loadReports() {
        console.log('Loading reports...');
    }

    async loadSystemHealth() {
        console.log('Loading system health...');
    }

    async loadAnalytics() {
        console.log('Loading analytics...');
    }

    async loadAuditLog() {
        console.log('Loading audit log...');
    }

    viewUser(userId) {
        console.log('View user:', userId);
    }

    viewChat(chatId) {
        console.log('View chat:', chatId);
    }

    terminateChat(chatId) {
        console.log('Terminate chat:', chatId);
    }
}

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// Initialize dashboard when DOM is loaded
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});
