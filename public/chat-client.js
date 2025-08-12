// Chat Client - WebSocket and UI Management
class ChatClient {
    constructor() {
        this.socket = null;
        this.currentRoom = null;
        this.partner = null;
        this.isConnected = false;
        this.isInQueue = false;
        this.isTyping = false;
        this.typingTimeout = null;
        this.messageQueue = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.accessToken = localStorage.getItem('accessToken');
        this.notificationSound = null;
        
        this.init();
    }

    async init() {
        this.initTheme();
        this.setupEventListeners();
        this.createNotificationSound();
        
        if (!this.accessToken) {
            this.redirectToLogin();
            return;
        }
        
        await this.connectSocket();
    }

    // Theme Management
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

    // Event Listeners Setup
    setupEventListeners() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const leaveRoomBtn = document.getElementById('leave-room-btn');
        const statsBtn = document.getElementById('stats-btn');

        // Message input handling
        messageInput.addEventListener('input', this.handleInputChange.bind(this));
        messageInput.addEventListener('keydown', this.handleKeyDown.bind(this));
        messageInput.addEventListener('paste', this.handlePaste.bind(this));

        // Send button
        sendButton.addEventListener('click', this.sendMessage.bind(this));

        // Room management
        leaveRoomBtn.addEventListener('click', this.leaveRoom.bind(this));

        // Stats button
        statsBtn.addEventListener('click', this.showStats.bind(this));

        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // Page visibility change (for notifications)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.socket) {
                this.socket.emit('ping'); // Heartbeat
            }
        });

        // Window beforeunload
        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.disconnect();
            }
        });
    }

    // Socket Connection Management
    async connectSocket() {
        try {
            this.showLoadingOverlay('Connecting to chat system...');

            this.socket = io('/', {
                auth: {
                    token: this.accessToken
                },
                transports: ['websocket', 'polling'],
                timeout: 10000,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000
            });

            this.setupSocketEvents();
            
        } catch (error) {
            console.error('Socket connection error:', error);
            this.handleConnectionError(error);
        }
    }

    setupSocketEvents() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to chat system');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.hideLoadingOverlay();
            this.updateConnectionStatus('searching', 'Looking for a chat partner...');
            this.showNotification('Connected to chat system', 'success');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from chat system:', reason);
            this.isConnected = false;
            this.updateConnectionStatus('disconnected', 'Disconnected from chat system');
            
            if (reason === 'io server disconnect') {
                // Server disconnected, try to reconnect
                this.reconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.handleConnectionError(error);
        });

        // Queue events
        this.socket.on('queueJoined', (data) => {
            this.isInQueue = true;
            this.updateConnectionStatus('searching', `In queue (position ${data.position}). Estimated wait: ${data.estimatedWait}s`);
        });

        this.socket.on('queueLeft', () => {
            this.isInQueue = false;
            this.updateConnectionStatus('searching', 'Looking for a chat partner...');
        });

        // Room events
        this.socket.on('roomJoined', (data) => {
            this.currentRoom = data.roomId;
            this.partner = data.partner;
            this.updatePartnerInfo(data.partner);
            this.updateConnectionStatus('connected', `Connected with ${data.partner.anonymousName}`);
            this.enableMessageInput();
            this.loadChatHistory(data.messages);
            this.showNotification(`Connected with ${data.partner.anonymousName}!`, 'success');
            this.playNotificationSound();
            
            document.getElementById('leave-room-btn').style.display = 'block';
        });

        this.socket.on('partnerJoined', (data) => {
            this.updatePartnerStatus('online');
            this.showNotification(`${data.partner.anonymousName} joined the chat`, 'success');
        });

        this.socket.on('partnerLeft', (data) => {
            this.updatePartnerStatus('offline');
            this.showNotification(`${data.partner.anonymousName} left the chat`, 'warning');
            this.disableMessageInput();
            
            // Auto-join queue after partner leaves
            setTimeout(() => {
                if (!this.currentRoom) {
                    this.joinQueue();
                }
            }, 2000);
        });

        this.socket.on('roomLeft', () => {
            this.currentRoom = null;
            this.partner = null;
            this.hidePartnerInfo();
            this.disableMessageInput();
            this.updateConnectionStatus('searching', 'Looking for a new chat partner...');
            document.getElementById('leave-room-btn').style.display = 'none';
            this.joinQueue();
        });

        this.socket.on('roomExpired', (data) => {
            this.showNotification(data.message, 'warning');
            this.currentRoom = null;
            this.partner = null;
            this.hidePartnerInfo();
            this.disableMessageInput();
            this.updateConnectionStatus('searching', 'Chat expired. Looking for a new partner...');
            document.getElementById('leave-room-btn').style.display = 'none';
            this.joinQueue();
        });

        // Message events
        this.socket.on('newMessage', (message) => {
            this.displayMessage(message);
            this.playNotificationSound();
            
            // Show notification if page is not visible
            if (document.hidden) {
                this.showBrowserNotification(`${message.senderName}: ${message.originalContent}`);
            }
        });

        this.socket.on('messageConfirmed', (data) => {
            this.updateMessageStatus(data.tempId, 'sent');
        });

        this.socket.on('messageError', (data) => {
            this.updateMessageStatus(data.tempId, 'error');
            this.showNotification(`Failed to send message: ${data.error}`, 'error');
        });

        // Typing events
        this.socket.on('typingStart', (data) => {
            this.showTypingIndicator(data.userName);
        });

        this.socket.on('typingStop', (data) => {
            this.hideTypingIndicator();
        });

        // Status events
        this.socket.on('userStatusChange', (data) => {
            if (data.userId === this.partner?.id) {
                this.updatePartnerStatus(data.status);
            }
        });

        // Heartbeat
        this.socket.on('pong', () => {
            // Connection is alive
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showNotification('Connection error occurred', 'error');
        });
    }

    // Message Handling
    handleInputChange() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        
        const hasContent = messageInput.value.trim().length > 0;
        sendButton.disabled = !hasContent || !this.isConnected || !this.currentRoom;
        
        // Handle typing indicators
        if (hasContent && !this.isTyping && this.currentRoom) {
            this.isTyping = true;
            this.socket.emit('typingStart');
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.typingTimeout = setTimeout(() => {
            if (this.isTyping) {
                this.isTyping = false;
                this.socket.emit('typingStop');
            }
        }, 1000);
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    handlePaste(event) {
        // Prevent pasting very long content
        const paste = event.clipboardData.getData('text');
        if (paste.length > 500) {
            event.preventDefault();
            this.showNotification('Message too long (max 500 characters)', 'error');
        }
    }

    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const content = messageInput.value.trim();
        
        if (!content || !this.isConnected || !this.currentRoom) return;
        
        if (content.length > 500) {
            this.showNotification('Message too long (max 500 characters)', 'error');
            return;
        }
        
        // Clear typing indicator
        if (this.isTyping) {
            this.isTyping = false;
            this.socket.emit('typingStop');
        }
        
        // Create temporary message for immediate UI feedback
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const tempMessage = {
            id: tempId,
            content: content,
            originalContent: content,
            timestamp: new Date().toISOString(),
            type: 'message',
            isSent: true,
            isTemporary: true
        };
        
        // Display immediately
        this.displayMessage(tempMessage);
        
        // Send to server
        this.socket.emit('sendMessage', {
            content: content,
            tempId: tempId
        });
        
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        document.getElementById('send-button').disabled = true;
    }

    displayMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        const isOwnMessage = message.isSent || (this.partner && message.senderId !== this.partner.id);
        
        // Create message group
        const messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${isOwnMessage ? 'sent' : 'received'}`;
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isOwnMessage ? 'sent' : 'received'}`;
        messageEl.setAttribute('data-message-id', message.id);
        
        // Message content
        const contentEl = document.createElement('div');
        contentEl.textContent = message.originalContent || message.content;
        messageEl.appendChild(contentEl);
        
        // Timestamp
        const timestampEl = document.createElement('div');
        timestampEl.className = 'message-timestamp';
        timestampEl.textContent = this.formatTimestamp(message.timestamp);
        messageEl.appendChild(timestampEl);
        
        // Status for sent messages
        if (isOwnMessage && !message.isTemporary) {
            const statusEl = document.createElement('div');
            statusEl.className = 'message-status';
            statusEl.textContent = 'Delivered';
            messageEl.appendChild(statusEl);
        }
        
        messageGroup.appendChild(messageEl);
        chatMessages.appendChild(messageGroup);
        
        // Auto-scroll to bottom
        this.scrollToBottom();
    }

    updateMessageStatus(tempId, status) {
        const messageEl = document.querySelector(`[data-message-id="${tempId}"]`);
        if (messageEl) {
            messageEl.setAttribute('data-message-id', `confirmed_${tempId}`);
            
            if (status === 'error') {
                messageEl.style.opacity = '0.5';
                const statusEl = messageEl.querySelector('.message-status');
                if (statusEl) {
                    statusEl.textContent = 'Failed to send';
                    statusEl.style.color = 'var(--error-color)';
                }
            }
        }
    }

    // Typing Indicators
    showTypingIndicator(userName) {
        this.hideTypingIndicator(); // Remove any existing indicator
        
        const chatMessages = document.getElementById('chat-messages');
        
        const typingGroup = document.createElement('div');
        typingGroup.className = 'message-group received';
        typingGroup.id = 'typing-indicator-group';
        
        const typingEl = document.createElement('div');
        typingEl.className = 'typing-indicator';
        typingEl.innerHTML = `
            <span>${userName} is typing</span>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        typingGroup.appendChild(typingEl);
        chatMessages.appendChild(typingGroup);
        
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const existingIndicator = document.getElementById('typing-indicator-group');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }

    // UI Update Methods
    updatePartnerInfo(partner) {
        const partnerInfo = document.getElementById('partner-info');
        const partnerAvatar = document.getElementById('partner-avatar');
        const partnerName = document.getElementById('partner-name');
        
        partnerInfo.style.display = 'flex';
        partnerAvatar.textContent = partner.anonymousName.charAt(0);
        partnerName.textContent = partner.anonymousName;
        
        this.updatePartnerStatus('online');
    }

    hidePartnerInfo() {
        const partnerInfo = document.getElementById('partner-info');
        partnerInfo.style.display = 'none';
    }

    updatePartnerStatus(status) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        statusIndicator.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'online':
                statusText.textContent = 'Online';
                break;
            case 'typing':
                statusText.textContent = 'Typing...';
                break;
            case 'offline':
                statusText.textContent = 'Offline';
                break;
            default:
                statusText.textContent = 'Unknown';
        }
    }

    updateConnectionStatus(type, message) {
        const connectionStatus = document.getElementById('connection-status');
        const statusMessage = document.getElementById('status-message');
        
        connectionStatus.className = `connection-status ${type}`;
        statusMessage.textContent = message;
    }

    enableMessageInput() {
        const messageInput = document.getElementById('message-input');
        messageInput.disabled = false;
        messageInput.placeholder = 'Type your message...';
        messageInput.focus();
    }

    disableMessageInput() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        
        messageInput.disabled = true;
        messageInput.placeholder = 'No active chat...';
        sendButton.disabled = true;
    }

    loadChatHistory(messages) {
        if (!messages || messages.length === 0) return;
        
        const chatMessages = document.getElementById('chat-messages');
        
        // Clear existing messages except system messages
        const systemMessages = chatMessages.querySelectorAll('.message.received');
        chatMessages.innerHTML = '';
        
        // Re-add system messages
        systemMessages.forEach(msg => {
            const group = msg.closest('.message-group');
            if (group) chatMessages.appendChild(group);
        });
        
        // Add chat history
        messages.forEach(message => {
            this.displayMessage({
                ...message,
                isSent: message.senderId !== this.partner?.id
            });
        });
    }

    // Room Management
    joinQueue() {
        if (this.socket && this.isConnected && !this.isInQueue && !this.currentRoom) {
            this.socket.emit('joinQueue');
        }
    }

    leaveRoom() {
        if (this.socket && this.currentRoom) {
            this.socket.emit('leaveRoom');
        }
    }

    // Utility Methods
    scrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Notifications
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const content = document.getElementById('notification-content');
        
        content.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }

    async showBrowserNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Anon-Connect', {
                body: message,
                icon: '/favicon.ico'
            });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification('Anon-Connect', {
                    body: message,
                    icon: '/favicon.ico'
                });
            }
        }
    }

    createNotificationSound() {
        // Create a simple notification sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.notificationSound = audioContext;
        } catch (error) {
            console.log('Web Audio API not supported');
        }
    }

    playNotificationSound() {
        if (!this.notificationSound) return;
        
        try {
            const oscillator = this.notificationSound.createOscillator();
            const gainNode = this.notificationSound.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.notificationSound.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, this.notificationSound.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.notificationSound.currentTime + 0.3);
            
            oscillator.start(this.notificationSound.currentTime);
            oscillator.stop(this.notificationSound.currentTime + 0.3);
        } catch (error) {
            console.log('Could not play notification sound');
        }
    }

    // Loading and Error Handling
    showLoadingOverlay(message) {
        const overlay = document.getElementById('loading-overlay');
        const spinner = overlay.querySelector('div div:last-child');
        spinner.textContent = message;
        overlay.style.display = 'flex';
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'none';
    }

    handleConnectionError(error) {
        console.error('Connection error:', error);
        this.hideLoadingOverlay();
        
        if (error.message && error.message.includes('Authentication failed')) {
            this.showNotification('Authentication failed. Please login again.', 'error');
            setTimeout(() => this.redirectToLogin(), 2000);
        } else {
            this.showNotification('Failed to connect to chat system', 'error');
            this.updateConnectionStatus('disconnected', 'Connection failed');
        }
    }

    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.showLoadingOverlay(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectSocket();
            }, this.reconnectAttempts * 2000);
        } else {
            this.showNotification('Unable to reconnect. Please refresh the page.', 'error');
            this.updateConnectionStatus('disconnected', 'Connection lost');
        }
    }

    redirectToLogin() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth.html';
    }

    // Stats
    async showStats() {
        try {
            const response = await fetch('/chat/stats');
            const data = await response.json();
            
            if (data.success) {
                const stats = data.data;
                this.showNotification(
                    `Users: ${stats.connectedUsers} | Rooms: ${stats.activeRooms} | Queue: ${stats.waitingQueue}`,
                    'info'
                );
            }
        } catch (error) {
            console.error('Failed to get stats:', error);
        }
    }
}

// Global functions for HTML event handlers
function toggleTheme() {
    if (window.chatClient) {
        window.chatClient.toggleTheme();
    }
}

// Initialize chat client when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatClient = new ChatClient();
});
