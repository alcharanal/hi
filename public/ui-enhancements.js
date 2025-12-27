/**
 * UI Enhancement Manager
 * Handles loading states, offline detection, accessibility, and UX improvements
 */
class UIEnhancementManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        this.userInteractionStarted = false;
        this.loadingStates = new Map();
        this.notificationQueue = [];
        this.accessibilityFeatures = {
            screenReader: false,
            highContrast: false,
            largeText: false,
            reducedMotion: false
        };
        
        this.init();
    }

    init() {
        this.setupNetworkDetection();
        this.setupAccessibilityFeatures();
        this.setupKeyboardNavigation();
        this.setupLoadingStates();
        this.setupNotificationSystem();
        this.setupResponsiveHandling();
        this.detectScreenReader();
        this.setupPerformanceMonitoring();
    }

    // =============================================================================
    // NETWORK AND CONNECTIVITY
    // =============================================================================

    setupNetworkDetection() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('Connection restored', 'success');
            this.updateConnectivityStatus(true);
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNotification('You are offline. Messages will be sent when connection is restored.', 'warning', 0);
            this.updateConnectivityStatus(false);
        });

        // Initial status
        this.updateConnectivityStatus(this.isOnline);
        
        // Periodic connectivity check
        setInterval(() => {
            this.checkConnectivity();
        }, 30000);
    }

    updateConnectivityStatus(isOnline) {
        const statusIndicator = document.getElementById('connection-status');
        if (!statusIndicator) {
            this.createConnectionStatusIndicator();
            return;
        }

        statusIndicator.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
        statusIndicator.textContent = isOnline ? 'Online' : 'Offline';
        statusIndicator.setAttribute('aria-label', `Connection status: ${isOnline ? 'online' : 'offline'}`);
        
        // Update document body class for styling
        document.body.classList.toggle('offline', !isOnline);
    }

    createConnectionStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'connection-status';
        indicator.className = `connection-status ${this.isOnline ? 'online' : 'offline'}`;
        indicator.textContent = this.isOnline ? 'Online' : 'Offline';
        indicator.setAttribute('role', 'status');
        indicator.setAttribute('aria-live', 'polite');
        
        // Add to header or create a status bar
        const header = document.querySelector('.chat-header') || document.querySelector('header');
        if (header) {
            header.appendChild(indicator);
        } else {
            document.body.insertBefore(indicator, document.body.firstChild);
        }
    }

    async checkConnectivity() {
        try {
            const response = await fetch('/health', { 
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            if (response.ok && !this.isOnline) {
                // Connection restored
                this.isOnline = true;
                this.updateConnectivityStatus(true);
                this.showNotification('Connection restored', 'success');
                this.syncOfflineData();
            }
        } catch (error) {
            if (this.isOnline) {
                // Connection lost
                this.isOnline = false;
                this.updateConnectivityStatus(false);
                this.showNotification('Connection lost. Attempting to reconnect...', 'warning');
            }
        }
    }

    syncOfflineData() {
        // Sync any offline data when connection is restored
        const offlineMessages = JSON.parse(localStorage.getItem('offlineMessages') || '[]');
        
        if (offlineMessages.length > 0) {
            offlineMessages.forEach(message => {
                // Resend offline messages
                this.sendOfflineMessage(message);
            });
            
            localStorage.removeItem('offlineMessages');
            this.showNotification(`${offlineMessages.length} offline messages sent`, 'success');
        }
    }

    sendOfflineMessage(message) {
        // Implement offline message sending logic
        if (window.socket && window.socket.connected) {
            window.socket.emit('sendMessage', message);
        }
    }

    // =============================================================================
    // LOADING STATES
    // =============================================================================

    setupLoadingStates() {
        // Create loading overlay template
        this.createLoadingOverlay();
    }

    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-label', 'Loading');
        overlay.style.display = 'none';
        
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner" aria-hidden="true"></div>
                <div class="loading-text">Loading...</div>
                <div class="loading-progress">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    showLoading(message = 'Loading...', key = 'default') {
        this.loadingStates.set(key, true);
        
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay.querySelector('.loading-text');
        
        loadingText.textContent = message;
        overlay.style.display = 'flex';
        overlay.setAttribute('aria-label', message);
        
        // Announce to screen readers
        this.announceToScreenReader(message);
    }

    hideLoading(key = 'default') {
        this.loadingStates.delete(key);
        
        // Only hide if no other loading states are active
        if (this.loadingStates.size === 0) {
            const overlay = document.getElementById('loading-overlay');
            overlay.style.display = 'none';
        }
    }

    updateLoadingProgress(percentage, key = 'default') {
        if (!this.loadingStates.has(key)) return;
        
        const overlay = document.getElementById('loading-overlay');
        const progressFill = overlay.querySelector('.progress-fill');
        const progressText = overlay.querySelector('.progress-text');
        
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
    }

    // Enhanced button loading states
    setButtonLoading(button, loading = true) {
        if (loading) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.dataset.originalText = button.textContent;
            
            button.innerHTML = `
                <span class="button-spinner" aria-hidden="true"></span>
                <span class="sr-only">Loading</span>
                ${button.dataset.loadingText || 'Loading...'}
            `;
        } else {
            button.disabled = false;
            button.setAttribute('aria-busy', 'false');
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }

    // =============================================================================
    // ACCESSIBILITY FEATURES
    // =============================================================================

    setupAccessibilityFeatures() {
        this.createAccessibilityMenu();
        this.setupFocusManagement();
        this.setupARIALiveRegions();
        this.enforceHeadingHierarchy();
        this.addSkipLinks();
    }

    createAccessibilityMenu() {
        const menu = document.createElement('div');
        menu.id = 'accessibility-menu';
        menu.className = 'accessibility-menu';
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-label', 'Accessibility settings');
        menu.style.display = 'none';
        
        menu.innerHTML = `
            <div class="accessibility-content">
                <h2>Accessibility Settings</h2>
                <button class="close-btn" aria-label="Close accessibility menu">&times;</button>
                
                <div class="accessibility-option">
                    <label>
                        <input type="checkbox" id="high-contrast-toggle"> 
                        High Contrast Mode
                    </label>
                </div>
                
                <div class="accessibility-option">
                    <label>
                        <input type="checkbox" id="large-text-toggle"> 
                        Large Text
                    </label>
                </div>
                
                <div class="accessibility-option">
                    <label>
                        <input type="checkbox" id="reduced-motion-toggle"> 
                        Reduce Motion
                    </label>
                </div>
                
                <div class="accessibility-option">
                    <label for="font-size-slider">Font Size:</label>
                    <input type="range" id="font-size-slider" min="12" max="24" value="16" aria-label="Font size in pixels">
                    <span id="font-size-value">16px</span>
                </div>
                
                <div class="accessibility-option">
                    <button id="reset-accessibility">Reset to Defaults</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(menu);
        this.bindAccessibilityControls();
    }

    bindAccessibilityControls() {
        const menu = document.getElementById('accessibility-menu');
        
        // High contrast toggle
        document.getElementById('high-contrast-toggle').addEventListener('change', (e) => {
            this.toggleHighContrast(e.target.checked);
        });
        
        // Large text toggle
        document.getElementById('large-text-toggle').addEventListener('change', (e) => {
            this.toggleLargeText(e.target.checked);
        });
        
        // Reduced motion toggle
        document.getElementById('reduced-motion-toggle').addEventListener('change', (e) => {
            this.toggleReducedMotion(e.target.checked);
        });
        
        // Font size slider
        const fontSlider = document.getElementById('font-size-slider');
        const fontValue = document.getElementById('font-size-value');
        
        fontSlider.addEventListener('input', (e) => {
            const size = e.target.value;
            document.documentElement.style.fontSize = `${size}px`;
            fontValue.textContent = `${size}px`;
            localStorage.setItem('fontSize', size);
        });
        
        // Close button
        menu.querySelector('.close-btn').addEventListener('click', () => {
            this.hideAccessibilityMenu();
        });
        
        // Reset button
        document.getElementById('reset-accessibility').addEventListener('click', () => {
            this.resetAccessibilitySettings();
        });
    }

    toggleAccessibilityMenu() {
        const menu = document.getElementById('accessibility-menu');
        const isVisible = menu.style.display === 'block';
        
        if (isVisible) {
            this.hideAccessibilityMenu();
        } else {
            this.showAccessibilityMenu();
        }
    }

    showAccessibilityMenu() {
        const menu = document.getElementById('accessibility-menu');
        menu.style.display = 'block';
        menu.focus();
        
        // Trap focus within menu
        this.trapFocus(menu);
    }

    hideAccessibilityMenu() {
        const menu = document.getElementById('accessibility-menu');
        menu.style.display = 'none';
    }

    toggleHighContrast(enabled) {
        this.accessibilityFeatures.highContrast = enabled;
        document.body.classList.toggle('high-contrast', enabled);
        localStorage.setItem('highContrast', enabled);
        this.announceToScreenReader(`High contrast ${enabled ? 'enabled' : 'disabled'}`);
    }

    toggleLargeText(enabled) {
        this.accessibilityFeatures.largeText = enabled;
        document.body.classList.toggle('large-text', enabled);
        localStorage.setItem('largeText', enabled);
        this.announceToScreenReader(`Large text ${enabled ? 'enabled' : 'disabled'}`);
    }

    toggleReducedMotion(enabled) {
        this.accessibilityFeatures.reducedMotion = enabled;
        document.body.classList.toggle('reduced-motion', enabled);
        localStorage.setItem('reducedMotion', enabled);
        this.announceToScreenReader(`Reduced motion ${enabled ? 'enabled' : 'disabled'}`);
    }

    resetAccessibilitySettings() {
        // Reset all accessibility settings
        this.toggleHighContrast(false);
        this.toggleLargeText(false);
        this.toggleReducedMotion(false);
        
        document.getElementById('high-contrast-toggle').checked = false;
        document.getElementById('large-text-toggle').checked = false;
        document.getElementById('reduced-motion-toggle').checked = false;
        document.getElementById('font-size-slider').value = 16;
        document.getElementById('font-size-value').textContent = '16px';
        
        document.documentElement.style.fontSize = '16px';
        
        localStorage.removeItem('highContrast');
        localStorage.removeItem('largeText');
        localStorage.removeItem('reducedMotion');
        localStorage.removeItem('fontSize');
        
        this.announceToScreenReader('Accessibility settings reset to defaults');
    }

    setupFocusManagement() {
        // Focus trap for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            }
        });
        
        // Focus indicators
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });
        
        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });
    }

    trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
            
            if (e.key === 'Escape') {
                this.hideAccessibilityMenu();
            }
        });
    }

    setupARIALiveRegions() {
        // Create polite live region for status updates
        const politeRegion = document.createElement('div');
        politeRegion.id = 'aria-live-polite';
        politeRegion.setAttribute('aria-live', 'polite');
        politeRegion.setAttribute('aria-atomic', 'true');
        politeRegion.className = 'sr-only';
        document.body.appendChild(politeRegion);
        
        // Create assertive live region for urgent updates
        const assertiveRegion = document.createElement('div');
        assertiveRegion.id = 'aria-live-assertive';
        assertiveRegion.setAttribute('aria-live', 'assertive');
        assertiveRegion.setAttribute('aria-atomic', 'true');
        assertiveRegion.className = 'sr-only';
        document.body.appendChild(assertiveRegion);
    }

    announceToScreenReader(message, priority = 'polite') {
        const region = document.getElementById(`aria-live-${priority}`);
        if (region) {
            region.textContent = message;
            
            // Clear after announcement
            setTimeout(() => {
                region.textContent = '';
            }, 1000);
        }
    }

    detectScreenReader() {
        // Detect screen reader usage
        const testElement = document.createElement('div');
        testElement.setAttribute('role', 'application');
        testElement.setAttribute('aria-label', 'test');
        testElement.style.position = 'absolute';
        testElement.style.left = '-10000px';
        document.body.appendChild(testElement);
        
        setTimeout(() => {
            if (testElement.offsetLeft === -10000) {
                this.accessibilityFeatures.screenReader = false;
            } else {
                this.accessibilityFeatures.screenReader = true;
                document.body.classList.add('screen-reader-active');
            }
            document.body.removeChild(testElement);
        }, 100);
    }

    addSkipLinks() {
        const skipLinks = document.createElement('div');
        skipLinks.className = 'skip-links';
        skipLinks.innerHTML = `
            <a href="#main-content" class="skip-link">Skip to main content</a>
            <a href="#chat-input" class="skip-link">Skip to chat input</a>
            <a href="#navigation" class="skip-link">Skip to navigation</a>
        `;
        
        document.body.insertBefore(skipLinks, document.body.firstChild);
    }

    enforceHeadingHierarchy() {
        // Ensure proper heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let currentLevel = 0;
        
        headings.forEach(heading => {
            const level = parseInt(heading.tagName.charAt(1));
            
            if (level > currentLevel + 1) {
                console.warn(`Heading hierarchy issue: Found h${level} after h${currentLevel}`);
            }
            
            currentLevel = level;
        });
    }

    // =============================================================================
    // KEYBOARD NAVIGATION
    // =============================================================================

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Accessibility menu toggle
            if (e.altKey && e.key === 'a') {
                e.preventDefault();
                this.toggleAccessibilityMenu();
            }
            
            // Quick navigation shortcuts
            if (e.altKey && e.key === '1') {
                e.preventDefault();
                this.focusMainContent();
            }
            
            if (e.altKey && e.key === '2') {
                e.preventDefault();
                this.focusChatInput();
            }
            
            // Escape key handling
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });
    }

    focusMainContent() {
        const mainContent = document.getElementById('main-content') || document.querySelector('main') || document.querySelector('.chat-messages');
        if (mainContent) {
            mainContent.focus();
            this.announceToScreenReader('Main content focused');
        }
    }

    focusChatInput() {
        const chatInput = document.getElementById('chat-input') || document.querySelector('input[type="text"]');
        if (chatInput) {
            chatInput.focus();
            this.announceToScreenReader('Chat input focused');
        }
    }

    handleEscapeKey() {
        // Close any open modals or menus
        const modal = document.querySelector('.modal.show');
        if (modal) {
            this.closeModal(modal);
            return;
        }
        
        const menu = document.getElementById('accessibility-menu');
        if (menu && menu.style.display === 'block') {
            this.hideAccessibilityMenu();
            return;
        }
    }

    // =============================================================================
    // NOTIFICATION SYSTEM
    // =============================================================================

    setupNotificationSystem() {
        this.createNotificationContainer();
    }

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Notifications');
        container.setAttribute('aria-live', 'polite');
        
        document.body.appendChild(container);
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.setAttribute('role', 'alert');
        
        const icon = this.getNotificationIcon(type);
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon" aria-hidden="true">${icon}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" aria-label="Close notification">&times;</button>
            </div>
        `;
        
        const container = document.getElementById('notification-container');
        container.appendChild(notification);
        
        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.removeNotification(notification);
        });
        
        // Auto-remove after duration (unless duration is 0)
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }
        
        // Announce to screen readers
        this.announceToScreenReader(message, type === 'error' ? 'assertive' : 'polite');
        
        return notification;
    }

    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        return icons[type] || icons.info;
    }

    // =============================================================================
    // RESPONSIVE HANDLING
    // =============================================================================

    setupResponsiveHandling() {
        this.handleResponsiveLayout();
        
        window.addEventListener('resize', () => {
            this.handleResponsiveLayout();
        });
        
        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResponsiveLayout();
            }, 100);
        });
    }

    handleResponsiveLayout() {
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth <= 1024 && window.innerWidth > 768;
        
        document.body.classList.toggle('mobile', isMobile);
        document.body.classList.toggle('tablet', isTablet);
        document.body.classList.toggle('desktop', !isMobile && !isTablet);
        
        // Update UI elements based on screen size
        this.updateNavigationForScreenSize(isMobile);
        this.updateSidebarForScreenSize(isMobile);
    }

    updateNavigationForScreenSize(isMobile) {
        const nav = document.querySelector('.navigation');
        if (nav) {
            nav.classList.toggle('mobile-nav', isMobile);
        }
    }

    updateSidebarForScreenSize(isMobile) {
        const sidebar = document.querySelector('.ai-insights-sidebar');
        if (sidebar && isMobile) {
            sidebar.classList.add('collapsed');
        }
    }

    // =============================================================================
    // PERFORMANCE MONITORING
    // =============================================================================

    setupPerformanceMonitoring() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            this.reportPerformanceMetrics();
        });
        
        // Monitor memory usage
        if ('memory' in performance) {
            setInterval(() => {
                this.checkMemoryUsage();
            }, 30000);
        }
    }

    reportPerformanceMetrics() {
        if ('getEntriesByType' in performance) {
            const navigation = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');
            
            console.log('Performance Metrics:', {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
                firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime
            });
        }
    }

    checkMemoryUsage() {
        if ('memory' in performance) {
            const memory = performance.memory;
            const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
            
            if (usagePercentage > 80) {
                this.showNotification('High memory usage detected. Consider refreshing the page.', 'warning');
            }
        }
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    isOnlineStatus() {
        return this.isOnline;
    }

    getAccessibilityFeatures() {
        return this.accessibilityFeatures;
    }

    // Load saved accessibility preferences
    loadAccessibilityPreferences() {
        const highContrast = localStorage.getItem('highContrast') === 'true';
        const largeText = localStorage.getItem('largeText') === 'true';
        const reducedMotion = localStorage.getItem('reducedMotion') === 'true';
        const fontSize = localStorage.getItem('fontSize') || '16';
        
        if (highContrast) this.toggleHighContrast(true);
        if (largeText) this.toggleLargeText(true);
        if (reducedMotion) this.toggleReducedMotion(true);
        
        document.documentElement.style.fontSize = `${fontSize}px`;
        
        // Update UI controls
        const highContrastToggle = document.getElementById('high-contrast-toggle');
        const largeTextToggle = document.getElementById('large-text-toggle');
        const reducedMotionToggle = document.getElementById('reduced-motion-toggle');
        const fontSizeSlider = document.getElementById('font-size-slider');
        const fontSizeValue = document.getElementById('font-size-value');
        
        if (highContrastToggle) highContrastToggle.checked = highContrast;
        if (largeTextToggle) largeTextToggle.checked = largeText;
        if (reducedMotionToggle) reducedMotionToggle.checked = reducedMotion;
        if (fontSizeSlider) fontSizeSlider.value = fontSize;
        if (fontSizeValue) fontSizeValue.textContent = `${fontSize}px`;
    }
}

// Initialize UI enhancements when DOM is ready
let uiEnhancementManager;
document.addEventListener('DOMContentLoaded', () => {
    uiEnhancementManager = new UIEnhancementManager();
    
    // Load saved preferences
    setTimeout(() => {
        uiEnhancementManager.loadAccessibilityPreferences();
    }, 100);
});

// Export for global access
window.UIEnhancementManager = UIEnhancementManager;
window.uiEnhancementManager = uiEnhancementManager;
