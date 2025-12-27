// AI Models and Data Structures for Anon-Connect

class ConversationAnalysis {
    constructor(data = {}) {
        this.messageId = data.messageId || null;
        this.chatId = data.chatId || null;
        this.timestamp = data.timestamp || new Date().toISOString();
        this.sentiment = data.sentiment || { score: 0, label: 'neutral', confidence: 0 };
        this.topics = data.topics || [];
        this.emotions = data.emotions || [];
        this.toxicity = data.toxicity || { score: 0, isToxic: false };
        this.complexity = data.complexity || { score: 0, level: 'simple' };
        this.engagement = data.engagement || { score: 0, level: 'low' };
        this.language = data.language || { detected: 'en', confidence: 1 };
    }

    toJSON() {
        return {
            messageId: this.messageId,
            chatId: this.chatId,
            timestamp: this.timestamp,
            sentiment: this.sentiment,
            topics: this.topics,
            emotions: this.emotions,
            toxicity: this.toxicity,
            complexity: this.complexity,
            engagement: this.engagement,
            language: this.language
        };
    }
}

class CompatibilityScore {
    constructor(data = {}) {
        this.user1Id = data.user1Id || null;
        this.user2Id = data.user2Id || null;
        this.chatId = data.chatId || null;
        this.overall = data.overall || 0; // 0-100
        this.components = data.components || {
            communication: 0,
            interests: 0,
            emotional: 0,
            personality: 0,
            engagement: 0
        };
        this.confidence = data.confidence || 0;
        this.lastUpdated = data.lastUpdated || new Date().toISOString();
        this.analysisCount = data.analysisCount || 0;
    }

    update(newData) {
        this.overall = newData.overall || this.overall;
        this.components = { ...this.components, ...newData.components };
        this.confidence = newData.confidence || this.confidence;
        this.lastUpdated = new Date().toISOString();
        this.analysisCount += 1;
    }

    toJSON() {
        return {
            user1Id: this.user1Id,
            user2Id: this.user2Id,
            chatId: this.chatId,
            overall: this.overall,
            components: this.components,
            confidence: this.confidence,
            lastUpdated: this.lastUpdated,
            analysisCount: this.analysisCount
        };
    }
}

class AIInsight {
    constructor(data = {}) {
        this.id = data.id || `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = data.type || 'coaching'; // coaching, warning, suggestion, observation
        this.category = data.category || 'general'; // general, conversation, emotional, engagement
        this.title = data.title || '';
        this.message = data.message || '';
        this.priority = data.priority || 'medium'; // low, medium, high, urgent
        this.actionable = data.actionable || false;
        this.suggestions = data.suggestions || [];
        this.targetUserId = data.targetUserId || null;
        this.chatId = data.chatId || null;
        this.timestamp = data.timestamp || new Date().toISOString();
        this.expiresAt = data.expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
        this.isActive = data.isActive !== undefined ? data.isActive : true;
    }

    isExpired() {
        return new Date() > new Date(this.expiresAt);
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            category: this.category,
            title: this.title,
            message: this.message,
            priority: this.priority,
            actionable: this.actionable,
            suggestions: this.suggestions,
            targetUserId: this.targetUserId,
            chatId: this.chatId,
            timestamp: this.timestamp,
            expiresAt: this.expiresAt,
            isActive: this.isActive
        };
    }
}

class TopicSuggestion {
    constructor(data = {}) {
        this.id = data.id || `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.title = data.title || '';
        this.content = data.content || '';
        this.category = data.category || 'general';
        this.difficulty = data.difficulty || 'easy'; // easy, medium, hard
        this.context = data.context || 'icebreaker'; // icebreaker, followup, deep, rescue
        this.tags = data.tags || [];
        this.relevanceScore = data.relevanceScore || 0;
        this.usageCount = data.usageCount || 0;
        this.successRate = data.successRate || 0;
        this.chatId = data.chatId || null;
        this.timestamp = data.timestamp || new Date().toISOString();
    }

    incrementUsage() {
        this.usageCount += 1;
    }

    updateSuccessRate(wasSuccessful) {
        const newTotal = this.usageCount;
        const oldSuccessful = Math.round(this.successRate * (newTotal - 1));
        const newSuccessful = oldSuccessful + (wasSuccessful ? 1 : 0);
        this.successRate = newSuccessful / newTotal;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            category: this.category,
            difficulty: this.difficulty,
            context: this.context,
            tags: this.tags,
            relevanceScore: this.relevanceScore,
            usageCount: this.usageCount,
            successRate: this.successRate,
            chatId: this.chatId,
            timestamp: this.timestamp
        };
    }
}

class MoodAnalysis {
    constructor(data = {}) {
        this.chatId = data.chatId || null;
        this.userId = data.userId || null;
        this.timestamp = data.timestamp || new Date().toISOString();
        this.primary = data.primary || 'neutral';
        this.secondary = data.secondary || [];
        this.intensity = data.intensity || 0.5; // 0-1
        this.confidence = data.confidence || 0;
        this.emotions = data.emotions || {
            joy: 0,
            sadness: 0,
            anger: 0,
            fear: 0,
            surprise: 0,
            disgust: 0,
            trust: 0,
            anticipation: 0
        };
        this.trend = data.trend || 'stable'; // improving, declining, stable
        this.conversationContext = data.conversationContext || {};
    }

    getMoodIcon() {
        const moodIcons = {
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
        return moodIcons[this.primary] || '😐';
    }

    getMoodColor() {
        const moodColors = {
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
        return moodColors[this.primary] || '#9ca3af';
    }

    toJSON() {
        return {
            chatId: this.chatId,
            userId: this.userId,
            timestamp: this.timestamp,
            primary: this.primary,
            secondary: this.secondary,
            intensity: this.intensity,
            confidence: this.confidence,
            emotions: this.emotions,
            trend: this.trend,
            conversationContext: this.conversationContext
        };
    }
}

class UserPersonality {
    constructor(data = {}) {
        this.userId = data.userId || null;
        this.traits = data.traits || {
            openness: 0.5,
            conscientiousness: 0.5,
            extraversion: 0.5,
            agreeableness: 0.5,
            neuroticism: 0.5
        };
        this.communicationStyle = data.communicationStyle || {
            formal: 0.5,
            emotional: 0.5,
            logical: 0.5,
            creative: 0.5,
            direct: 0.5
        };
        this.interests = data.interests || [];
        this.conversationPreferences = data.conversationPreferences || {
            depth: 'medium', // shallow, medium, deep
            pace: 'medium', // slow, medium, fast
            topics: [], // preferred topic categories
            style: 'balanced' // analytical, emotional, humorous, serious, balanced
        };
        this.analysisCount = data.analysisCount || 0;
        this.confidence = data.confidence || 0;
        this.lastUpdated = data.lastUpdated || new Date().toISOString();
    }

    update(newData) {
        // Weighted update based on analysis count
        const weight = Math.min(0.3, 1 / (this.analysisCount + 1));
        
        // Update traits
        Object.keys(this.traits).forEach(trait => {
            if (newData.traits && newData.traits[trait] !== undefined) {
                this.traits[trait] = this.traits[trait] * (1 - weight) + newData.traits[trait] * weight;
            }
        });

        // Update communication style
        Object.keys(this.communicationStyle).forEach(style => {
            if (newData.communicationStyle && newData.communicationStyle[style] !== undefined) {
                this.communicationStyle[style] = this.communicationStyle[style] * (1 - weight) + newData.communicationStyle[style] * weight;
            }
        });

        // Update interests (additive)
        if (newData.interests) {
            newData.interests.forEach(interest => {
                if (!this.interests.find(i => i.name === interest.name)) {
                    this.interests.push(interest);
                } else {
                    const existing = this.interests.find(i => i.name === interest.name);
                    existing.confidence = Math.max(existing.confidence, interest.confidence);
                }
            });
        }

        this.analysisCount += 1;
        this.confidence = Math.min(1, this.confidence + 0.1);
        this.lastUpdated = new Date().toISOString();
    }

    getCompatibilityWith(otherPersonality) {
        if (!otherPersonality) return 0;

        let compatibility = 0;
        let factors = 0;

        // Personality traits compatibility
        Object.keys(this.traits).forEach(trait => {
            const diff = Math.abs(this.traits[trait] - otherPersonality.traits[trait]);
            const traitCompatibility = 1 - diff;
            compatibility += traitCompatibility;
            factors += 1;
        });

        // Communication style compatibility
        Object.keys(this.communicationStyle).forEach(style => {
            const similarity = 1 - Math.abs(this.communicationStyle[style] - otherPersonality.communicationStyle[style]);
            compatibility += similarity;
            factors += 1;
        });

        // Interest overlap
        const commonInterests = this.interests.filter(interest1 => 
            otherPersonality.interests.some(interest2 => interest1.name === interest2.name)
        );
        const interestCompatibility = commonInterests.length / Math.max(this.interests.length, otherPersonality.interests.length, 1);
        compatibility += interestCompatibility;
        factors += 1;

        return factors > 0 ? compatibility / factors : 0;
    }

    toJSON() {
        return {
            userId: this.userId,
            traits: this.traits,
            communicationStyle: this.communicationStyle,
            interests: this.interests,
            conversationPreferences: this.conversationPreferences,
            analysisCount: this.analysisCount,
            confidence: this.confidence,
            lastUpdated: this.lastUpdated
        };
    }
}

class ConversationMetrics {
    constructor(data = {}) {
        this.chatId = data.chatId || null;
        this.startTime = data.startTime || new Date().toISOString();
        this.lastActivity = data.lastActivity || new Date().toISOString();
        this.messageCount = data.messageCount || 0;
        this.averageResponseTime = data.averageResponseTime || 0;
        this.engagementScore = data.engagementScore || 0;
        this.sentimentFlow = data.sentimentFlow || [];
        this.topicChanges = data.topicChanges || 0;
        this.silencePeriods = data.silencePeriods || [];
        this.participationBalance = data.participationBalance || 0.5; // 0 = user1 dominates, 1 = user2 dominates, 0.5 = balanced
        this.quality = data.quality || {
            overall: 0,
            depth: 0,
            authenticity: 0,
            respect: 0
        };
    }

    addMessage(message, responseTime = null) {
        this.messageCount += 1;
        this.lastActivity = new Date().toISOString();
        
        if (responseTime !== null) {
            this.averageResponseTime = (this.averageResponseTime * (this.messageCount - 1) + responseTime) / this.messageCount;
        }
    }

    updateEngagement(score) {
        this.engagementScore = (this.engagementScore + score) / 2;
    }

    addSentimentPoint(sentiment) {
        this.sentimentFlow.push({
            timestamp: new Date().toISOString(),
            sentiment: sentiment
        });
        
        // Keep only last 20 sentiment points
        if (this.sentimentFlow.length > 20) {
            this.sentimentFlow = this.sentimentFlow.slice(-20);
        }
    }

    getDuration() {
        return new Date() - new Date(this.startTime);
    }

    toJSON() {
        return {
            chatId: this.chatId,
            startTime: this.startTime,
            lastActivity: this.lastActivity,
            messageCount: this.messageCount,
            averageResponseTime: this.averageResponseTime,
            engagementScore: this.engagementScore,
            sentimentFlow: this.sentimentFlow,
            topicChanges: this.topicChanges,
            silencePeriods: this.silencePeriods,
            participationBalance: this.participationBalance,
            quality: this.quality
        };
    }
}

// Static data for topic suggestions
const DEFAULT_TOPICS = {
    icebreakers: [
        { title: "Favorite Travel Memory", content: "What's your most memorable travel experience?", category: "travel" },
        { title: "Dream Superpower", content: "If you could have any superpower, what would it be and why?", category: "imagination" },
        { title: "Perfect Weekend", content: "What does your ideal weekend look like?", category: "lifestyle" },
        { title: "Childhood Memory", content: "What's a childhood memory that always makes you smile?", category: "personal" },
        { title: "Hidden Talent", content: "Do you have any hidden talents or unusual skills?", category: "personal" }
    ],
    followups: [
        { title: "Tell Me More", content: "That's really interesting! Can you tell me more about that?", category: "general" },
        { title: "How Did That Feel", content: "How did that make you feel?", category: "emotional" },
        { title: "What Happened Next", content: "What happened next?", category: "storytelling" },
        { title: "Similar Experience", content: "I had a similar experience once...", category: "sharing" }
    ],
    deep: [
        { title: "Life Philosophy", content: "What's something you believe that most people disagree with?", category: "philosophy" },
        { title: "Personal Growth", content: "What's the most important lesson you've learned in recent years?", category: "growth" },
        { title: "Future Dreams", content: "Where do you see yourself in 10 years?", category: "future" },
        { title: "Values", content: "What values are most important to you in relationships?", category: "values" }
    ],
    rescue: [
        { title: "Fun Question", content: "Let's try something fun - what's the weirdest food combination you actually enjoy?", category: "fun" },
        { title: "Would You Rather", content: "Would you rather be able to fly or be invisible?", category: "game" },
        { title: "Random Fact", content: "Here's a random question - what's something interesting you learned recently?", category: "learning" },
        { title: "Comfort Zone", content: "What's something you've always wanted to try but haven't yet?", category: "adventure" }
    ]
};

module.exports = {
    ConversationAnalysis,
    CompatibilityScore,
    AIInsight,
    TopicSuggestion,
    MoodAnalysis,
    UserPersonality,
    ConversationMetrics,
    DEFAULT_TOPICS
};
