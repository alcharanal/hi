// AI Insights Frontend Manager
class AIInsightsManager {
    constructor(chatClient) {
        this.chatClient = chatClient;
        this.insights = new Map(); // insightId -> insight
        this.compatibility = null;
        this.mood = null;
        this.topicSuggestions = [];
        this.isEnabled = localStorage.getItem('aiInsightsEnabled') !== 'false';
        this.privacySettings = this.loadPrivacySettings();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSocketListeners();
        this.updatePrivacyUI();
    }

    setupEventListeners() {
        // AI toggle button
        const aiToggle = document.getElementById('ai-toggle');
        if (aiToggle) {
            aiToggle.addEventListener('change', (e) => {
                this.toggleAIFeatures(e.target.checked);
            });
        }

        // Privacy settings
        const privacyBtn = document.getElementById('ai-privacy-btn');
        if (privacyBtn) {
            privacyBtn.addEventListener('click', () => {
                this.showPrivacySettings();
            });
        }

        // Topic suggestion clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.topic-suggestion')) {
                this.useSuggestion(e.target.dataset.topicId);
            }
        });

        // Insight actions
        document.addEventListener('click', (e) => {
            if (e.target.matches('.insight-action')) {
                this.handleInsightAction(e.target.dataset.insightId, e.target.dataset.action);
            }
        });

        // Mood details
        const moodIndicator = document.getElementById('mood-indicator');
        if (moodIndicator) {
            moodIndicator.addEventListener('click', () => {
                this.showMoodDetails();
            });
        }
    }

    setupSocketListeners() {
        if (!this.chatClient.socket) return;

        // AI insights
        this.chatClient.socket.on('aiInsights', (data) => {
            this.handleInsights(data.insights);
        });

        // Compatibility updates
        this.chatClient.socket.on('compatibilityUpdate', (data) => {
            this.updateCompatibility(data);
        });

        // Mood updates
        this.chatClient.socket.on('moodUpdate', (data) => {
            this.updateMood(data);
        });

        // Topic suggestions
        this.chatClient.socket.on('topicSuggestions', (data) => {
            this.updateTopicSuggestions(data.suggestions);
        });

        // Privacy settings updates
        this.chatClient.socket.on('privacySettingsUpdated', (data) => {
            this.privacySettings = data.settings;
            this.updatePrivacyUI();
        });
    }

    // Privacy Management
    loadPrivacySettings() {
        const saved = localStorage.getItem('aiPrivacySettings');
        return saved ? JSON.parse(saved) : {
            aiAnalysisEnabled: true,
            sentimentAnalysis: true,
            personalityAnalysis: true,
            topicSuggestions: true,
            compatibilityScoring: true,
            conversationCoaching: true,
            dataRetention: '30d'
        };
    }

    savePrivacySettings() {
        localStorage.setItem('aiPrivacySettings', JSON.stringify(this.privacySettings));
        
        // Send to server
        if (this.chatClient.socket) {
            this.chatClient.socket.emit('updatePrivacySettings', {
                settings: this.privacySettings
            });
        }
    }

    showPrivacySettings() {
        const modal = this.createPrivacyModal();
        document.body.appendChild(modal);
    }

    createPrivacyModal() {
        const modal = document.createElement('div');
        modal.className = 'ai-privacy-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>AI Privacy Settings</h3>
                    <button class="modal-close" onclick="this.closest('.ai-privacy-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="privacy-section">
                        <h4>AI Features</h4>
                        <label class="privacy-toggle">
                            <input type="checkbox" id="privacy-analysis" ${this.privacySettings.aiAnalysisEnabled ? 'checked' : ''}>
                            <span>Enable AI Analysis</span>
                            <small>Analyze messages for insights and suggestions</small>
                        </label>
                        <label class="privacy-toggle">
                            <input type="checkbox" id="privacy-sentiment" ${this.privacySettings.sentimentAnalysis ? 'checked' : ''}>
                            <span>Sentiment Analysis</span>
                            <small>Detect emotional tone in messages</small>
                        </label>
                        <label class="privacy-toggle">
                            <input type="checkbox" id="privacy-personality" ${this.privacySettings.personalityAnalysis ? 'checked' : ''}>
                            <span>Personality Analysis</span>
                            <small>Build personality profile for better matching</small>
                        </label>
                        <label class="privacy-toggle">
                            <input type="checkbox" id="privacy-topics" ${this.privacySettings.topicSuggestions ? 'checked' : ''}>
                            <span>Topic Suggestions</span>
                            <small>Get conversation starter suggestions</small>
                        </label>
                        <label class="privacy-toggle">
                            <input type="checkbox" id="privacy-compatibility" ${this.privacySettings.compatibilityScoring ? 'checked' : ''}>
                            <span>Compatibility Scoring</span>
                            <small>Calculate compatibility with chat partners</small>
                        </label>
                        <label class="privacy-toggle">
                            <input type="checkbox" id="privacy-coaching" ${this.privacySettings.conversationCoaching ? 'checked' : ''}>
                            <span>Conversation Coaching</span>
                            <small>Receive tips to improve conversations</small>
                        </label>
                    </div>
                    <div class="privacy-section">
                        <h4>Data Retention</h4>
                        <select id="privacy-retention">
                            <option value="1d" ${this.privacySettings.dataRetention === '1d' ? 'selected' : ''}>1 Day</option>
                            <option value="7d" ${this.privacySettings.dataRetention === '7d' ? 'selected' : ''}>7 Days</option>
                            <option value="30d" ${this.privacySettings.dataRetention === '30d' ? 'selected' : ''}>30 Days</option>
                            <option value="never" ${this.privacySettings.dataRetention === 'never' ? 'selected' : ''}>Never Delete</option>
                        </select>
                        <small>How long to keep your AI analysis data</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.ai-privacy-modal').remove()">Cancel</button>
                    <button class="btn-primary" onclick="aiInsightsManager.savePrivacyFromModal(this)">Save Settings</button>
                </div>
            </div>
        `;
        return modal;
    }

    savePrivacyFromModal(button) {
        const modal = button.closest('.ai-privacy-modal');
        
        this.privacySettings = {
            aiAnalysisEnabled: modal.querySelector('#privacy-analysis').checked,
            sentimentAnalysis: modal.querySelector('#privacy-sentiment').checked,
            personalityAnalysis: modal.querySelector('#privacy-personality').checked,
            topicSuggestions: modal.querySelector('#privacy-topics').checked,
            compatibilityScoring: modal.querySelector('#privacy-compatibility').checked,
            conversationCoaching: modal.querySelector('#privacy-coaching').checked,
            dataRetention: modal.querySelector('#privacy-retention').value
        };
        
        this.savePrivacySettings();
        this.updatePrivacyUI();
        modal.remove();
        
        this.chatClient.showNotification('Privacy settings updated', 'success');
    }

    updatePrivacyUI() {
        const aiToggle = document.getElementById('ai-toggle');
        if (aiToggle) {
            aiToggle.checked = this.privacySettings.aiAnalysisEnabled;
        }
        
        // Show/hide AI features based on settings
        const aiSidebar = document.getElementById('ai-insights-sidebar');
        if (aiSidebar) {
            aiSidebar.style.display = this.privacySettings.aiAnalysisEnabled ? 'block' : 'none';
        }
    }

    // Feature Management
    toggleAIFeatures(enabled) {
        this.isEnabled = enabled;
        localStorage.setItem('aiInsightsEnabled', enabled.toString());
        
        const aiSidebar = document.getElementById('ai-insights-sidebar');
        if (aiSidebar) {
            aiSidebar.style.display = enabled ? 'block' : 'none';
        }
        
        this.privacySettings.aiAnalysisEnabled = enabled;
        this.savePrivacySettings();
    }

    // Insights Management
    handleInsights(insights) {
        if (!this.isEnabled || !this.privacySettings.conversationCoaching) return;

        insights.forEach(insight => {
            this.insights.set(insight.id, insight);
            this.displayInsight(insight);
        });

        // Clean up expired insights
        this.cleanupExpiredInsights();
    }

    displayInsight(insight) {
        const container = document.getElementById('ai-insights-container');
        if (!container) return;

        const insightEl = document.createElement('div');
        insightEl.className = `ai-insight insight-${insight.type} priority-${insight.priority}`;
        insightEl.id = `insight-${insight.id}`;
        
        const icon = this.getInsightIcon(insight.type);
        const color = this.getInsightColor(insight.priority);
        
        insightEl.innerHTML = `
            <div class="insight-header" style="border-left-color: ${color}">
                <span class="insight-icon">${icon}</span>
                <span class="insight-title">${insight.title}</span>
                <button class="insight-close" data-insight-id="${insight.id}" data-action="dismiss">×</button>
            </div>
            <div class="insight-content">
                <p>${insight.message}</p>
                ${insight.suggestions.length > 0 ? `
                    <div class="insight-suggestions">
                        ${insight.suggestions.map((suggestion, index) => 
                            `<button class="suggestion-btn" data-insight-id="${insight.id}" data-action="use-suggestion" data-suggestion="${suggestion}">${suggestion}</button>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        // Add animation
        insightEl.style.opacity = '0';
        insightEl.style.transform = 'translateY(20px)';
        container.appendChild(insightEl);
        
        // Animate in
        requestAnimationFrame(() => {
            insightEl.style.transition = 'all 0.3s ease';
            insightEl.style.opacity = '1';
            insightEl.style.transform = 'translateY(0)';
        });

        // Auto-remove after timeout
        setTimeout(() => {
            if (insightEl.parentNode) {
                this.removeInsight(insight.id);
            }
        }, 30000); // 30 seconds
    }

    getInsightIcon(type) {
        const icons = {
            coaching: '💡',
            warning: '⚠️',
            suggestion: '💭',
            observation: '👁️'
        };
        return icons[type] || '💡';
    }

    getInsightColor(priority) {
        const colors = {
            low: '#94a3b8',
            medium: '#f59e0b',
            high: '#ef4444',
            urgent: '#dc2626'
        };
        return colors[priority] || '#94a3b8';
    }

    handleInsightAction(insightId, action) {
        const insight = this.insights.get(insightId);
        if (!insight) return;

        switch (action) {
            case 'dismiss':
                this.removeInsight(insightId);
                break;
            case 'use-suggestion':
                // Handle suggestion usage
                break;
        }
    }

    removeInsight(insightId) {
        const insightEl = document.getElementById(`insight-${insightId}`);
        if (insightEl) {
            insightEl.style.transition = 'all 0.3s ease';
            insightEl.style.opacity = '0';
            insightEl.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                if (insightEl.parentNode) {
                    insightEl.remove();
                }
            }, 300);
        }
        
        this.insights.delete(insightId);
    }

    cleanupExpiredInsights() {
        const now = new Date();
        for (const [insightId, insight] of this.insights) {
            if (new Date(insight.expiresAt) < now) {
                this.removeInsight(insightId);
            }
        }
    }

    // Compatibility Management
    updateCompatibility(data) {
        if (!this.isEnabled || !this.privacySettings.compatibilityScoring) return;

        this.compatibility = data;
        this.displayCompatibilityScore();
    }

    displayCompatibilityScore() {
        const container = document.getElementById('compatibility-container');
        if (!container || !this.compatibility) return;

        const score = this.compatibility.score;
        const confidence = this.compatibility.confidence;
        
        container.innerHTML = `
            <div class="compatibility-header">
                <h4>Compatibility</h4>
                <div class="compatibility-score ${this.getCompatibilityClass(score)}">
                    ${score}%
                </div>
            </div>
            <div class="compatibility-breakdown">
                ${Object.entries(this.compatibility.components).map(([component, value]) => `
                    <div class="compatibility-component">
                        <span class="component-name">${this.capitalizeFirst(component)}</span>
                        <div class="component-bar">
                            <div class="component-fill" style="width: ${value}%"></div>
                        </div>
                        <span class="component-value">${value}%</span>
                    </div>
                `).join('')}
            </div>
            <div class="compatibility-confidence">
                Confidence: ${Math.round(confidence * 100)}%
            </div>
        `;

        // Add animation
        container.style.opacity = '0';
        requestAnimationFrame(() => {
            container.style.transition = 'opacity 0.5s ease';
            container.style.opacity = '1';
        });
    }

    getCompatibilityClass(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }

    // Mood Management
    updateMood(data) {
        if (!this.isEnabled || !this.privacySettings.sentimentAnalysis) return;

        this.mood = data;
        this.displayMoodIndicator();
    }

    displayMoodIndicator() {
        const indicator = document.getElementById('mood-indicator');
        if (!indicator || !this.mood) return;

        const moodColor = this.getMoodColor(this.mood.primary);
        const moodIcon = this.getMoodIcon(this.mood.primary);
        
        indicator.innerHTML = `
            <div class="mood-icon" style="color: ${moodColor}">${moodIcon}</div>
            <div class="mood-text">
                <div class="mood-primary">${this.capitalizeFirst(this.mood.primary)}</div>
                <div class="mood-intensity">${Math.round(this.mood.intensity * 100)}% intensity</div>
            </div>
        `;
        
        indicator.style.borderColor = moodColor;
    }

    getMoodColor(mood) {
        const colors = {
            happy: '#10b981',
            sad: '#3b82f6',
            angry: '#ef4444',
            excited: '#f59e0b',
            calm: '#8b5cf6',
            confused: '#6b7280',
            loving: '#ec4899',
            nervous: '#f97316',
            bored: '#64748b',
            surprised: '#06b6d4',
            neutral: '#9ca3af'
        };
        return colors[mood] || '#9ca3af';
    }

    getMoodIcon(mood) {
        const icons = {
            happy: '😊',
            sad: '😢',
            angry: '😠',
            excited: '🤩',
            calm: '😌',
            confused: '😕',
            loving: '🥰',
            nervous: '😰',
            bored: '😴',
            surprised: '😲',
            neutral: '😐'
        };
        return icons[mood] || '😐';
    }

    showMoodDetails() {
        if (!this.mood) return;

        const modal = this.createMoodModal();
        document.body.appendChild(modal);
    }

    createMoodModal() {
        const modal = document.createElement('div');
        modal.className = 'mood-details-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Your Current Mood</h3>
                    <button class="modal-close" onclick="this.closest('.mood-details-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="mood-overview">
                        <div class="mood-primary">
                            <span class="mood-icon-large">${this.getMoodIcon(this.mood.primary)}</span>
                            <h4>${this.capitalizeFirst(this.mood.primary)}</h4>
                            <p>Intensity: ${Math.round(this.mood.intensity * 100)}%</p>
                        </div>
                    </div>
                    <div class="emotions-breakdown">
                        <h4>Emotion Breakdown</h4>
                        ${Object.entries(this.mood.emotions).map(([emotion, value]) => `
                            <div class="emotion-item">
                                <span class="emotion-name">${this.capitalizeFirst(emotion)}</span>
                                <div class="emotion-bar">
                                    <div class="emotion-fill" style="width: ${value * 100}%"></div>
                                </div>
                                <span class="emotion-value">${Math.round(value * 100)}%</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="mood-trend">
                        <h4>Trend: ${this.capitalizeFirst(this.mood.trend)}</h4>
                        <p>Based on your recent messages</p>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    // Topic Suggestions
    updateTopicSuggestions(suggestions) {
        if (!this.isEnabled || !this.privacySettings.topicSuggestions) return;

        this.topicSuggestions = suggestions;
        this.displayTopicSuggestions();
    }

    displayTopicSuggestions() {
        const container = document.getElementById('topic-suggestions-container');
        if (!container) return;

        container.innerHTML = `
            <div class="suggestions-header">
                <h4>💭 Conversation Ideas</h4>
            </div>
            <div class="suggestions-list">
                ${this.topicSuggestions.map(suggestion => `
                    <button class="topic-suggestion" data-topic-id="${suggestion.id}">
                        <div class="suggestion-title">${suggestion.title}</div>
                        <div class="suggestion-content">${suggestion.content}</div>
                    </button>
                `).join('')}
            </div>
        `;
    }

    useSuggestion(topicId) {
        const suggestion = this.topicSuggestions.find(s => s.id === topicId);
        if (!suggestion) return;

        // Auto-fill the message input
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.value = suggestion.content;
            messageInput.focus();
            
            // Trigger input event to enable send button
            messageInput.dispatchEvent(new Event('input'));
        }

        // Track usage
        if (this.chatClient.socket) {
            this.chatClient.socket.emit('topicSuggestionUsed', {
                topicId: topicId,
                success: true
            });
        }
    }

    // Utility Methods
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Public API
    getInsights() {
        return Array.from(this.insights.values());
    }

    getCompatibility() {
        return this.compatibility;
    }

    getMood() {
        return this.mood;
    }

    getTopicSuggestions() {
        return this.topicSuggestions;
    }
}

// Global instance
let aiInsightsManager = null;

// Initialize when chat client is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for chat client to be available
    const initAI = () => {
        if (window.chatClient) {
            aiInsightsManager = new AIInsightsManager(window.chatClient);
            window.aiInsightsManager = aiInsightsManager;
        } else {
            setTimeout(initAI, 100);
        }
    };
    initAI();
});
