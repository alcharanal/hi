const Filter = require('bad-words');
const emojiRegex = require('emoji-regex');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const AIService = require('./ai-service');

class ConnectionManager {
    constructor() {
        this.connections = new Map(); // userId -> socket
        this.userRooms = new Map(); // userId -> roomId
        this.rooms = new Map(); // roomId -> {users: Set, messages: [], createdAt, expiresAt}
        this.waitingQueue = []; // users waiting for a match
        this.typingUsers = new Map(); // roomId -> Set of typing userIds
        this.userProfiles = new Map(); // userId -> {username, anonymousName, etc}

        // Initialize profanity filter
        this.filter = new Filter();

        // Initialize AI service
        this.aiService = new AIService();

        // Initialize database connection
        this.dbPath = path.join(__dirname, 'anon_connect.db');
        this.db = new sqlite3.Database(this.dbPath);

        // Cleanup expired rooms every 5 minutes
        setInterval(() => this.cleanupExpiredRooms(), 5 * 60 * 1000);

        // AI cleanup every 30 minutes
        setInterval(() => this.aiService.cleanup(), 30 * 60 * 1000);
    }

    // User connection management
    addConnection(userId, socket, userProfile) {
        this.connections.set(userId, socket);
        this.userProfiles.set(userId, userProfile);
        
        console.log(`User ${userProfile.anonymousName} (${userId}) connected`);
        
        // Set user as online
        this.broadcastUserStatus(userId, 'online');
        
        // Auto-join waiting queue if not in a room
        if (!this.userRooms.has(userId)) {
            this.addToWaitingQueue(userId);
        } else {
            // Rejoin existing room
            const roomId = this.userRooms.get(userId);
            if (this.rooms.has(roomId)) {
                this.joinRoom(userId, roomId);
            }
        }
    }

    removeConnection(userId) {
        const userProfile = this.userProfiles.get(userId);
        if (userProfile) {
            console.log(`User ${userProfile.anonymousName} (${userId}) disconnected`);
        }
        
        // Remove from waiting queue
        this.removeFromWaitingQueue(userId);
        
        // Handle room departure
        const roomId = this.userRooms.get(userId);
        if (roomId && this.rooms.has(roomId)) {
            this.leaveRoom(userId, roomId);
        }
        
        // Set user as offline
        this.broadcastUserStatus(userId, 'offline');
        
        // Cleanup
        this.connections.delete(userId);
        this.userProfiles.delete(userId);
        this.userRooms.delete(userId);
    }

    // Room management
    createRoom(user1Id, user2Id) {
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        const room = {
            id: roomId,
            users: new Set([user1Id, user2Id]),
            messages: [],
            createdAt: new Date(),
            expiresAt: expiresAt,
            isActive: true
        };
        
        this.rooms.set(roomId, room);
        this.userRooms.set(user1Id, roomId);
        this.userRooms.set(user2Id, roomId);
        
        // Save room to database
        this.saveRoomToDatabase(room, user1Id, user2Id);
        
        console.log(`Created room ${roomId} for users ${user1Id} and ${user2Id}`);
        return roomId;
    }

    joinRoom(userId, roomId) {
        const room = this.rooms.get(roomId);
        const socket = this.connections.get(userId);
        const userProfile = this.userProfiles.get(userId);
        
        if (!room || !socket || !userProfile) return false;
        
        // Send room info and chat history
        socket.emit('roomJoined', {
            roomId: roomId,
            expiresAt: room.expiresAt,
            messages: room.messages,
            partner: this.getRoomPartner(userId, roomId)
        });
        
        // Notify partner about user joining
        const partnerId = this.getRoomPartnerId(userId, roomId);
        if (partnerId) {
            const partnerSocket = this.connections.get(partnerId);
            if (partnerSocket) {
                partnerSocket.emit('partnerJoined', {
                    partner: userProfile
                });
            }
        }
        
        return true;
    }

    leaveRoom(userId, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        // Notify partner about leaving
        const partnerId = this.getRoomPartnerId(userId, roomId);
        if (partnerId) {
            const partnerSocket = this.connections.get(partnerId);
            const userProfile = this.userProfiles.get(userId);
            if (partnerSocket && userProfile) {
                partnerSocket.emit('partnerLeft', {
                    partner: userProfile
                });
            }
        }
        
        // Remove user from room
        room.users.delete(userId);
        this.userRooms.delete(userId);
        
        // If room is empty, mark as inactive
        if (room.users.size === 0) {
            room.isActive = false;
            this.updateRoomStatus(roomId, 'ended');
        }
    }

    // Enhanced message handling with AI analysis
    async handleMessage(userId, messageData) {
        const roomId = this.userRooms.get(userId);
        const room = this.rooms.get(roomId);
        const userProfile = this.userProfiles.get(userId);

        if (!room || !userProfile || !room.isActive) {
            return { success: false, error: 'Invalid room or user' };
        }

        // Validate message
        const validation = this.validateMessage(messageData.content);
        if (!validation.isValid) {
            return { success: false, error: validation.error };
        }

        // Create message object
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            chatId: roomId,
            senderId: userId,
            senderName: userProfile.anonymousName,
            content: this.encryptMessage(validation.content),
            originalContent: validation.content,
            timestamp: new Date().toISOString(),
            type: 'message'
        };

        // AI Analysis
        const partnerId = this.getRoomPartnerId(userId, roomId);
        const analysis = await this.aiService.analyzeMessage(message, {
            userId: userId,
            chatId: roomId,
            partnerId: partnerId
        });

        // Check for toxicity and moderate if necessary
        if (analysis && analysis.toxicity.isToxic) {
            console.log(`Toxic message detected from user ${userId}`);

            // Send warning to user
            const socket = this.connections.get(userId);
            if (socket) {
                socket.emit('moderationWarning', {
                    type: 'toxicity',
                    message: 'Your message contains inappropriate content and was not sent.',
                    severity: analysis.toxicity.score
                });
            }

            return { success: false, error: 'Message blocked due to inappropriate content' };
        }

        // Add AI analysis to message
        if (analysis) {
            message.aiAnalysis = analysis.toJSON();
        }

        // Add to room and persist
        room.messages.push(message);
        await this.saveMessageToDatabase(message);

        // Broadcast to room participants
        this.broadcastToRoom(roomId, 'newMessage', message);

        // Generate and send AI insights
        if (analysis) {
            await this.sendAIInsights(userId, roomId);
            await this.updateCompatibilityScore(userId, partnerId, roomId);
        }

        console.log(`Message sent in room ${roomId} by ${userProfile.anonymousName}`);
        return { success: true, message, analysis };
    }

    // Typing indicators
    handleTypingStart(userId) {
        const roomId = this.userRooms.get(userId);
        if (!roomId) return;
        
        if (!this.typingUsers.has(roomId)) {
            this.typingUsers.set(roomId, new Set());
        }
        
        this.typingUsers.get(roomId).add(userId);
        
        // Notify partner
        const partnerId = this.getRoomPartnerId(userId, roomId);
        if (partnerId) {
            const partnerSocket = this.connections.get(partnerId);
            const userProfile = this.userProfiles.get(userId);
            if (partnerSocket && userProfile) {
                partnerSocket.emit('typingStart', {
                    userId: userId,
                    userName: userProfile.anonymousName
                });
            }
        }
    }

    handleTypingStop(userId) {
        const roomId = this.userRooms.get(userId);
        if (!roomId) return;
        
        if (this.typingUsers.has(roomId)) {
            this.typingUsers.get(roomId).delete(userId);
        }
        
        // Notify partner
        const partnerId = this.getRoomPartnerId(userId, roomId);
        if (partnerId) {
            const partnerSocket = this.connections.get(partnerId);
            const userProfile = this.userProfiles.get(userId);
            if (partnerSocket && userProfile) {
                partnerSocket.emit('typingStop', {
                    userId: userId,
                    userName: userProfile.anonymousName
                });
            }
        }
    }

    // User matching system
    addToWaitingQueue(userId) {
        if (this.waitingQueue.includes(userId)) return;
        
        this.waitingQueue.push(userId);
        const userProfile = this.userProfiles.get(userId);
        console.log(`User ${userProfile?.anonymousName} (${userId}) added to waiting queue`);
        
        // Notify user they're in queue
        const socket = this.connections.get(userId);
        if (socket) {
            socket.emit('queueJoined', {
                position: this.waitingQueue.length,
                estimatedWait: this.waitingQueue.length * 10 // rough estimate
            });
        }
        
        // Try to match immediately
        this.tryMatching();
    }

    removeFromWaitingQueue(userId) {
        const index = this.waitingQueue.indexOf(userId);
        if (index > -1) {
            this.waitingQueue.splice(index, 1);
            console.log(`User ${userId} removed from waiting queue`);
        }
    }

    async tryMatching() {
        if (this.waitingQueue.length < 2) return;

        // AI-powered smart matching
        const user1Id = this.waitingQueue.shift();
        const remainingUsers = [...this.waitingQueue];

        let user2Id;
        if (remainingUsers.length > 0) {
            // Use AI service to find best match
            user2Id = await this.aiService.findBestMatch(user1Id, remainingUsers);

            // Remove matched user from queue
            const user2Index = this.waitingQueue.indexOf(user2Id);
            if (user2Index > -1) {
                this.waitingQueue.splice(user2Index, 1);
            }
        }

        // Fallback to random if AI matching fails
        if (!user2Id && this.waitingQueue.length > 0) {
            user2Id = this.waitingQueue.shift();
        }

        if (user2Id) {
            // Create room and join users
            const roomId = this.createRoom(user1Id, user2Id);

            // Join both users to the room
            this.joinRoom(user1Id, roomId);
            this.joinRoom(user2Id, roomId);

            console.log(`AI-matched users ${user1Id} and ${user2Id} in room ${roomId}`);

            // Send initial compatibility score
            setTimeout(() => this.updateCompatibilityScore(user1Id, user2Id, roomId), 2000);
        }

        // Continue matching if more users waiting
        if (this.waitingQueue.length >= 2) {
            setTimeout(() => this.tryMatching(), 1000);
        }
    }

    // Utility methods
    getRoomPartnerId(userId, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        
        for (const participantId of room.users) {
            if (participantId !== userId) {
                return participantId;
            }
        }
        return null;
    }

    getRoomPartner(userId, roomId) {
        const partnerId = this.getRoomPartnerId(userId, roomId);
        if (!partnerId) return null;
        
        return this.userProfiles.get(partnerId);
    }

    broadcastToRoom(roomId, event, data) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        for (const userId of room.users) {
            const socket = this.connections.get(userId);
            if (socket) {
                socket.emit(event, data);
            }
        }
    }

    broadcastUserStatus(userId, status) {
        const roomId = this.userRooms.get(userId);
        if (!roomId) return;
        
        const partnerId = this.getRoomPartnerId(userId, roomId);
        if (partnerId) {
            const partnerSocket = this.connections.get(partnerId);
            const userProfile = this.userProfiles.get(userId);
            if (partnerSocket && userProfile) {
                partnerSocket.emit('userStatusChange', {
                    userId: userId,
                    userName: userProfile.anonymousName,
                    status: status
                });
            }
        }
    }

    // Message validation and filtering
    validateMessage(content) {
        if (!content || typeof content !== 'string') {
            return { isValid: false, error: 'Message content is required' };
        }
        
        const trimmed = content.trim();
        if (trimmed.length === 0) {
            return { isValid: false, error: 'Message cannot be empty' };
        }
        
        if (trimmed.length > 500) {
            return { isValid: false, error: 'Message too long (max 500 characters)' };
        }
        
        // Apply profanity filter
        const filtered = this.filter.clean(trimmed);
        
        return { isValid: true, content: filtered };
    }

    // Basic XOR encryption for messages
    encryptMessage(message) {
        const key = 'anon-connect-key'; // In production, use proper encryption
        let encrypted = '';
        
        for (let i = 0; i < message.length; i++) {
            encrypted += String.fromCharCode(
                message.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        
        return Buffer.from(encrypted).toString('base64');
    }

    decryptMessage(encryptedMessage) {
        try {
            const key = 'anon-connect-key';
            const decoded = Buffer.from(encryptedMessage, 'base64').toString();
            let decrypted = '';
            
            for (let i = 0; i < decoded.length; i++) {
                decrypted += String.fromCharCode(
                    decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            
            return decrypted;
        } catch (error) {
            return encryptedMessage; // Return as-is if decryption fails
        }
    }

    // Database operations
    saveRoomToDatabase(room, user1Id, user2Id) {
        this.db.run(`
            INSERT OR REPLACE INTO chats (id, user1_id, user2_id, status, created_at, expires_at)
            VALUES (?, ?, ?, 'active', ?, ?)
        `, [room.id, user1Id, user2Id, room.createdAt.toISOString(), room.expiresAt.toISOString()]);
    }

    async saveMessageToDatabase(message) {
        return new Promise((resolve, reject) => {
            // Find the database chat record
            this.db.get('SELECT id FROM chats WHERE id = ?', [message.chatId], (err, chat) => {
                if (err || !chat) {
                    console.error('Chat not found for message:', message.chatId);
                    resolve();
                    return;
                }
                
                this.db.run(`
                    INSERT INTO messages (chat_id, sender_id, content, timestamp, is_encrypted)
                    VALUES ((SELECT id FROM chats WHERE id = ?), ?, ?, ?, 1)
                `, [message.chatId, message.senderId, message.content, message.timestamp], 
                function(err) {
                    if (err) {
                        console.error('Error saving message:', err);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        });
    }

    updateRoomStatus(roomId, status) {
        this.db.run('UPDATE chats SET status = ? WHERE id = ?', [status, roomId]);
    }

    // Cleanup operations
    cleanupExpiredRooms() {
        const now = new Date();
        const expiredRooms = [];
        
        for (const [roomId, room] of this.rooms) {
            if (now > room.expiresAt) {
                expiredRooms.push(roomId);
            }
        }
        
        expiredRooms.forEach(roomId => {
            const room = this.rooms.get(roomId);
            if (room) {
                // Notify users about expiration
                this.broadcastToRoom(roomId, 'roomExpired', {
                    roomId: roomId,
                    message: 'Chat session has expired after 24 hours'
                });
                
                // Update database
                this.updateRoomStatus(roomId, 'expired');
                
                // Remove from memory
                this.rooms.delete(roomId);
                
                // Remove user room mappings
                for (const userId of room.users) {
                    this.userRooms.delete(userId);
                }
            }
        });
        
        if (expiredRooms.length > 0) {
            console.log(`Cleaned up ${expiredRooms.length} expired rooms`);
        }
    }

    // Statistics and monitoring
    getStats() {
        return {
            connectedUsers: this.connections.size,
            activeRooms: this.rooms.size,
            waitingQueue: this.waitingQueue.length,
            totalMessages: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.messages.length, 0)
        };
    }
}

module.exports = ConnectionManager;
