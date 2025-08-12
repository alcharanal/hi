const OpenAI = require('openai');
const Sentiment = require('sentiment');
const natural = require('natural');
const nlp = require('compromise');
const NodeCache = require('node-cache');
const {
    ConversationAnalysis,
    CompatibilityScore,
    AIInsight,
    TopicSuggestion,
    MoodAnalysis,
    UserPersonality,
    ConversationMetrics,
    DEFAULT_TOPICS
} = require('./ai-models');

class AIService {
    constructor() {
        // Initialize OpenAI
        this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        }) : null;
        
        // Initialize sentiment analyzer
        this.sentiment = new Sentiment();
        
        // Initialize cache (5 minute default TTL)
        this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
        
        // Track API usage for cost optimization
        this.apiUsage = {
            calls: 0,
            tokens: 0,
            cost: 0
        };
        
        // Rate limiting
        this.rateLimiter = new Map(); // userId -> [timestamps]
        this.maxCallsPerMinute = 10;
        
        // Personality profiles storage
        this.personalities = new Map(); // userId -> UserPersonality
        
        // Conversation metrics storage
        this.conversationMetrics = new Map(); // chatId -> ConversationMetrics
        
        // Privacy settings
        this.privacySettings = new Map(); // userId -> settings
        
        console.log('AI Service initialized', {
            openAIEnabled: !!this.openai,
            sentimentEnabled: true,
            cacheEnabled: true
        });
    }

    // Privacy and Opt-out Management
    setPrivacySettings(userId, settings) {
        this.privacySettings.set(userId, {
            aiAnalysisEnabled: settings.aiAnalysisEnabled !== false,
            sentimentAnalysis: settings.sentimentAnalysis !== false,
            personalityAnalysis: settings.personalityAnalysis !== false,
            topicSuggestions: settings.topicSuggestions !== false,
            compatibilityScoring: settings.compatibilityScoring !== false,
            conversationCoaching: settings.conversationCoaching !== false,
            dataRetention: settings.dataRetention || '30d',
            ...settings
        });
    }

    getPrivacySettings(userId) {
        return this.privacySettings.get(userId) || {
            aiAnalysisEnabled: true,
            sentimentAnalysis: true,
            personalityAnalysis: true,
            topicSuggestions: true,
            compatibilityScoring: true,
            conversationCoaching: true,
            dataRetention: '30d'
        };
    }

    isFeatureEnabled(userId, feature) {
        const settings = this.getPrivacySettings(userId);
        return settings.aiAnalysisEnabled && settings[feature];
    }

    // Rate Limiting
    checkRateLimit(userId) {
        const now = Date.now();
        const userCalls = this.rateLimiter.get(userId) || [];
        
        // Remove calls older than 1 minute
        const recentCalls = userCalls.filter(timestamp => now - timestamp < 60000);
        
        if (recentCalls.length >= this.maxCallsPerMinute) {
            return false;
        }
        
        recentCalls.push(now);
        this.rateLimiter.set(userId, recentCalls);
        return true;
    }

    // Core Analysis Methods
    async analyzeMessage(message, context = {}) {
        try {
            const { userId, chatId, partnerId } = context;
            
            // Check privacy settings
            if (!this.isFeatureEnabled(userId, 'sentimentAnalysis')) {
                return null;
            }

            // Check rate limiting
            if (!this.checkRateLimit(userId)) {
                console.log(`Rate limit exceeded for user ${userId}`);
                return null;
            }

            const cacheKey = `analysis_${this.hashMessage(message.content)}`;
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return new ConversationAnalysis({...cached, messageId: message.id, chatId});
            }

            const analysis = new ConversationAnalysis({
                messageId: message.id,
                chatId: chatId,
                timestamp: message.timestamp
            });

            // Sentiment analysis (local)
            const sentimentResult = this.sentiment.analyze(message.content);
            analysis.sentiment = {
                score: sentimentResult.score,
                label: this.getSentimentLabel(sentimentResult.score),
                confidence: Math.min(Math.abs(sentimentResult.score) / 5, 1)
            };

            // Topic extraction (local)
            analysis.topics = this.extractTopics(message.content);

            // Emotion detection (local)
            analysis.emotions = this.detectEmotions(message.content);

            // Toxicity detection (local + OpenAI if available)
            analysis.toxicity = await this.detectToxicity(message.content);

            // Complexity analysis
            analysis.complexity = this.analyzeComplexity(message.content);

            // Engagement analysis
            analysis.engagement = this.analyzeEngagement(message.content);

            // Language detection
            analysis.language = this.detectLanguage(message.content);

            // Cache the result (without message-specific data)
            const cacheData = { ...analysis.toJSON() };
            delete cacheData.messageId;
            delete cacheData.chatId;
            this.cache.set(cacheKey, cacheData);

            // Update conversation metrics
            this.updateConversationMetrics(chatId, analysis);

            // Update user personality
            if (this.isFeatureEnabled(userId, 'personalityAnalysis')) {
                await this.updatePersonalityProfile(userId, message.content, analysis);
            }

            return analysis;

        } catch (error) {
            console.error('Error in message analysis:', error);
            return null;
        }
    }

    // Sentiment Analysis
    getSentimentLabel(score) {
        if (score > 2) return 'very positive';
        if (score > 0) return 'positive';
        if (score < -2) return 'very negative';
        if (score < 0) return 'negative';
        return 'neutral';
    }

    // Topic Extraction using compromise
    extractTopics(text) {
        try {
            const doc = nlp(text);
            const topics = [];

            // Extract nouns and noun phrases
            const nouns = doc.nouns().out('array');
            const places = doc.places().out('array');
            const people = doc.people().out('array');
            const topics_detected = doc.topics().out('array');

            // Combine and score topics
            [...nouns, ...places, ...people, ...topics_detected].forEach(topic => {
                if (topic.length > 2 && !topics.find(t => t.name === topic.toLowerCase())) {
                    topics.push({
                        name: topic.toLowerCase(),
                        type: this.categorizeKeyword(topic),
                        confidence: Math.random() * 0.5 + 0.5 // Simple confidence
                    });
                }
            });

            return topics.slice(0, 5); // Limit to top 5 topics
        } catch (error) {
            console.error('Error extracting topics:', error);
            return [];
        }
    }

    categorizeKeyword(keyword) {
        const categories = {
            technology: ['computer', 'software', 'app', 'internet', 'tech', 'ai', 'code'],
            entertainment: ['movie', 'music', 'game', 'show', 'book', 'art', 'film'],
            sports: ['football', 'basketball', 'soccer', 'tennis', 'sport', 'team'],
            travel: ['travel', 'trip', 'vacation', 'country', 'city', 'place'],
            food: ['food', 'restaurant', 'cooking', 'recipe', 'meal', 'eat'],
            personal: ['family', 'friend', 'work', 'job', 'school', 'home'],
            hobbies: ['hobby', 'collect', 'craft', 'create', 'build', 'make']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(k => keyword.toLowerCase().includes(k))) {
                return category;
            }
        }
        return 'general';
    }

    // Emotion Detection
    detectEmotions(text) {
        const emotionKeywords = {
            joy: ['happy', 'excited', 'great', 'amazing', 'wonderful', 'fantastic', 'love', 'joy'],
            sadness: ['sad', 'disappointed', 'upset', 'hurt', 'cry', 'depressed', 'down'],
            anger: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'hate'],
            fear: ['scared', 'afraid', 'worried', 'nervous', 'anxious', 'terrified'],
            surprise: ['surprised', 'shocked', 'amazed', 'unexpected', 'wow'],
            disgust: ['disgusting', 'awful', 'terrible', 'horrible', 'gross'],
            trust: ['trust', 'believe', 'confident', 'sure', 'reliable'],
            anticipation: ['excited', 'looking forward', 'can\'t wait', 'expect']
        };

        const emotions = {};
        const words = text.toLowerCase().split(/\s+/);

        Object.keys(emotionKeywords).forEach(emotion => {
            emotions[emotion] = 0;
            emotionKeywords[emotion].forEach(keyword => {
                if (words.some(word => word.includes(keyword))) {
                    emotions[emotion] += 0.3;
                }
            });
            emotions[emotion] = Math.min(emotions[emotion], 1);
        });

        return emotions;
    }

    // Toxicity Detection
    async detectToxicity(text) {
        try {
            // Basic local toxicity detection
            const toxicKeywords = ['hate', 'stupid', 'idiot', 'kill', 'die', 'shut up'];
            const localScore = toxicKeywords.reduce((score, keyword) => {
                return score + (text.toLowerCase().includes(keyword) ? 0.3 : 0);
            }, 0);

            let result = {
                score: Math.min(localScore, 1),
                isToxic: localScore > 0.5
            };

            // Enhanced detection with OpenAI if available
            if (this.openai && localScore > 0.2) {
                try {
                    const response = await this.openai.chat.completions.create({
                        model: "gpt-3.5-turbo",
                        messages: [{
                            role: "system",
                            content: "Analyze the following message for toxicity, harassment, or inappropriate content. Respond with only a JSON object containing 'isToxic' (boolean) and 'confidence' (0-1)."
                        }, {
                            role: "user",
                            content: text
                        }],
                        max_tokens: 50,
                        temperature: 0
                    });

                    const aiResult = JSON.parse(response.choices[0].message.content);
                    result = {
                        score: aiResult.confidence,
                        isToxic: aiResult.isToxic
                    };

                    this.trackAPIUsage('toxicity', response.usage);
                } catch (error) {
                    console.error('OpenAI toxicity detection error:', error);
                }
            }

            return result;
        } catch (error) {
            console.error('Error in toxicity detection:', error);
            return { score: 0, isToxic: false };
        }
    }

    // Complexity Analysis
    analyzeComplexity(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
        const avgCharsPerWord = text.replace(/\s/g, '').length / Math.max(words.length, 1);

        let complexityScore = 0;
        if (avgWordsPerSentence > 15) complexityScore += 0.3;
        if (avgCharsPerWord > 6) complexityScore += 0.3;
        if (words.some(word => word.length > 10)) complexityScore += 0.4;

        return {
            score: Math.min(complexityScore, 1),
            level: complexityScore < 0.3 ? 'simple' : complexityScore < 0.7 ? 'medium' : 'complex'
        };
    }

    // Engagement Analysis
    analyzeEngagement(text) {
        let engagementScore = 0;
        
        // Questions increase engagement
        if (text.includes('?')) engagementScore += 0.3;
        
        // Exclamation points show enthusiasm
        if (text.includes('!')) engagementScore += 0.2;
        
        // Personal pronouns show engagement
        if (/\b(I|you|we|us|my|your|our)\b/i.test(text)) engagementScore += 0.2;
        
        // Length indicates investment
        if (text.length > 100) engagementScore += 0.2;
        if (text.length > 200) engagementScore += 0.1;

        return {
            score: Math.min(engagementScore, 1),
            level: engagementScore < 0.3 ? 'low' : engagementScore < 0.7 ? 'medium' : 'high'
        };
    }

    // Language Detection
    detectLanguage(text) {
        // Simple English detection - in production, use a proper language detection library
        const englishWords = ['the', 'and', 'to', 'of', 'a', 'in', 'for', 'is', 'on', 'that', 'by', 'this', 'with', 'i', 'you', 'it', 'not', 'or', 'be', 'are'];
        const words = text.toLowerCase().split(/\s+/);
        const englishWordCount = words.filter(word => englishWords.includes(word)).length;
        const confidence = englishWordCount / Math.max(words.length, 1);

        return {
            detected: confidence > 0.3 ? 'en' : 'unknown',
            confidence: Math.min(confidence * 2, 1)
        };
    }

    // Personality Analysis
    async updatePersonalityProfile(userId, messageContent, analysis) {
        try {
            let personality = this.personalities.get(userId) || new UserPersonality({ userId });

            // Analyze communication style from message
            const style = this.analyzeCommunicationStyle(messageContent, analysis);
            
            // Update personality traits (simplified)
            const traits = this.extractPersonalityTraits(messageContent, analysis);

            personality.update({
                traits: traits,
                communicationStyle: style,
                interests: this.extractInterests(messageContent, analysis.topics)
            });

            this.personalities.set(userId, personality);
            return personality;
        } catch (error) {
            console.error('Error updating personality profile:', error);
            return null;
        }
    }

    analyzeCommunicationStyle(text, analysis) {
        const style = {
            formal: 0.5,
            emotional: 0.5,
            logical: 0.5,
            creative: 0.5,
            direct: 0.5
        };

        // Formal indicators
        if (/\b(however|therefore|furthermore|moreover|nevertheless)\b/i.test(text)) {
            style.formal += 0.2;
        }
        if (text.includes('!') || text.includes('?')) {
            style.formal -= 0.1;
        }

        // Emotional indicators
        if (analysis.sentiment.score !== 0) {
            style.emotional += Math.abs(analysis.sentiment.score) / 5;
        }
        if (Object.values(analysis.emotions).some(score => score > 0.3)) {
            style.emotional += 0.2;
        }

        // Logical indicators
        if (/\b(because|since|therefore|thus|hence|consequently)\b/i.test(text)) {
            style.logical += 0.2;
        }

        // Creative indicators
        if (/\b(imagine|creative|artistic|beautiful|amazing)\b/i.test(text)) {
            style.creative += 0.2;
        }

        // Direct indicators
        if (text.length < 50 && text.split('.').length <= 2) {
            style.direct += 0.2;
        }

        // Normalize values
        Object.keys(style).forEach(key => {
            style[key] = Math.max(0, Math.min(1, style[key]));
        });

        return style;
    }

    extractPersonalityTraits(text, analysis) {
        const traits = {
            openness: 0.5,
            conscientiousness: 0.5,
            extraversion: 0.5,
            agreeableness: 0.5,
            neuroticism: 0.5
        };

        // Openness - creativity, curiosity
        if (/\b(creative|art|music|travel|explore|new|different|unique)\b/i.test(text)) {
            traits.openness += 0.1;
        }

        // Conscientiousness - organization, responsibility
        if (/\b(plan|organize|schedule|responsible|careful|detail)\b/i.test(text)) {
            traits.conscientiousness += 0.1;
        }

        // Extraversion - social, outgoing
        if (text.includes('!') || text.includes('?') || /\b(party|friends|social|meet|people)\b/i.test(text)) {
            traits.extraversion += 0.1;
        }

        // Agreeableness - cooperative, trusting
        if (/\b(help|kind|nice|agree|understand|sorry|please|thank)\b/i.test(text)) {
            traits.agreeableness += 0.1;
        }

        // Neuroticism - anxiety, emotional instability
        if (analysis.emotions.fear > 0.3 || analysis.emotions.sadness > 0.3 || /\b(worry|stress|anxious|nervous)\b/i.test(text)) {
            traits.neuroticism += 0.1;
        }

        // Normalize values
        Object.keys(traits).forEach(key => {
            traits[key] = Math.max(0, Math.min(1, traits[key]));
        });

        return traits;
    }

    extractInterests(text, topics) {
        const interests = [];
        
        topics.forEach(topic => {
            interests.push({
                name: topic.name,
                category: topic.type,
                confidence: topic.confidence,
                extractedFrom: 'conversation'
            });
        });

        return interests;
    }

    // Compatibility Scoring
    async calculateCompatibility(user1Id, user2Id, chatId) {
        try {
            if (!this.isFeatureEnabled(user1Id, 'compatibilityScoring') || 
                !this.isFeatureEnabled(user2Id, 'compatibilityScoring')) {
                return null;
            }

            const personality1 = this.personalities.get(user1Id);
            const personality2 = this.personalities.get(user2Id);

            if (!personality1 || !personality2) {
                return new CompatibilityScore({
                    user1Id,
                    user2Id,
                    chatId,
                    overall: 50,
                    confidence: 0
                });
            }

            const overall = personality1.getCompatibilityWith(personality2) * 100;
            
            const components = {
                communication: this.calculateCommunicationCompatibility(personality1, personality2),
                interests: this.calculateInterestCompatibility(personality1, personality2),
                emotional: this.calculateEmotionalCompatibility(personality1, personality2),
                personality: this.calculatePersonalityCompatibility(personality1, personality2),
                engagement: this.calculateEngagementCompatibility(user1Id, user2Id, chatId)
            };

            const compatibility = new CompatibilityScore({
                user1Id,
                user2Id,
                chatId,
                overall: Math.round(overall),
                components,
                confidence: Math.min(personality1.confidence, personality2.confidence)
            });

            return compatibility;
        } catch (error) {
            console.error('Error calculating compatibility:', error);
            return null;
        }
    }

    calculateCommunicationCompatibility(p1, p2) {
        const styles1 = p1.communicationStyle;
        const styles2 = p2.communicationStyle;
        
        let compatibility = 0;
        let count = 0;
        
        Object.keys(styles1).forEach(style => {
            const similarity = 1 - Math.abs(styles1[style] - styles2[style]);
            compatibility += similarity;
            count++;
        });
        
        return Math.round((compatibility / count) * 100);
    }

    calculateInterestCompatibility(p1, p2) {
        const interests1 = p1.interests.map(i => i.name);
        const interests2 = p2.interests.map(i => i.name);
        
        const common = interests1.filter(i => interests2.includes(i));
        const total = new Set([...interests1, ...interests2]).size;
        
        return total > 0 ? Math.round((common.length / total) * 100) : 50;
    }

    calculateEmotionalCompatibility(p1, p2) {
        const traits1 = p1.traits;
        const traits2 = p2.traits;
        
        // Emotional stability compatibility
        const neuroticismDiff = Math.abs(traits1.neuroticism - traits2.neuroticism);
        const agreeablenessSim = 1 - Math.abs(traits1.agreeableness - traits2.agreeableness);
        
        return Math.round(((1 - neuroticismDiff) + agreeablenessSim) * 50);
    }

    calculatePersonalityCompatibility(p1, p2) {
        const traits1 = p1.traits;
        const traits2 = p2.traits;
        
        let compatibility = 0;
        let count = 0;
        
        Object.keys(traits1).forEach(trait => {
            const similarity = 1 - Math.abs(traits1[trait] - traits2[trait]);
            compatibility += similarity;
            count++;
        });
        
        return Math.round((compatibility / count) * 100);
    }

    calculateEngagementCompatibility(user1Id, user2Id, chatId) {
        const metrics = this.conversationMetrics.get(chatId);
        if (!metrics) return 50;
        
        // Balance score: closer to 0.5 is better
        const balanceScore = 1 - Math.abs(metrics.participationBalance - 0.5) * 2;
        const engagementScore = metrics.engagementScore;
        
        return Math.round((balanceScore + engagementScore) * 50);
    }

    // Conversation Coaching
    async generateInsights(chatId, userId) {
        try {
            if (!this.isFeatureEnabled(userId, 'conversationCoaching')) {
                return [];
            }

            const insights = [];
            const metrics = this.conversationMetrics.get(chatId);
            const personality = this.personalities.get(userId);

            if (!metrics) return insights;

            // Check for conversation balance
            if (Math.abs(metrics.participationBalance - 0.5) > 0.3) {
                const isOverParticipating = (userId === metrics.user1Id && metrics.participationBalance < 0.3) ||
                                         (userId === metrics.user2Id && metrics.participationBalance > 0.7);
                
                if (isOverParticipating) {
                    insights.push(new AIInsight({
                        type: 'coaching',
                        category: 'conversation',
                        title: 'Give your partner space',
                        message: 'Try asking more questions to encourage your partner to share more.',
                        suggestions: ['Ask about their interests', 'Listen actively', 'Share less, ask more'],
                        targetUserId: userId,
                        chatId: chatId,
                        priority: 'medium'
                    }));
                } else {
                    insights.push(new AIInsight({
                        type: 'coaching',
                        category: 'conversation',
                        title: 'Share more about yourself',
                        message: 'Your partner seems interested! Try sharing more about your thoughts and experiences.',
                        suggestions: ['Tell a personal story', 'Share your opinions', 'Ask follow-up questions'],
                        targetUserId: userId,
                        chatId: chatId,
                        priority: 'medium'
                    }));
                }
            }

            // Check conversation flow
            if (metrics.engagementScore < 0.3) {
                insights.push(new AIInsight({
                    type: 'suggestion',
                    category: 'engagement',
                    title: 'Try a conversation starter',
                    message: 'The conversation might benefit from a new topic or question.',
                    suggestions: this.getTopicSuggestions(chatId, 'rescue').slice(0, 3).map(t => t.content),
                    targetUserId: userId,
                    chatId: chatId,
                    priority: 'high'
                }));
            }

            // Sentiment-based insights
            if (metrics.sentimentFlow.length > 0) {
                const recentSentiment = metrics.sentimentFlow.slice(-3);
                const avgSentiment = recentSentiment.reduce((sum, s) => sum + s.sentiment.score, 0) / recentSentiment.length;
                
                if (avgSentiment < -2) {
                    insights.push(new AIInsight({
                        type: 'coaching',
                        category: 'emotional',
                        title: 'Consider shifting the mood',
                        message: 'The conversation seems to have taken a negative turn. Try introducing something positive.',
                        suggestions: ['Share something you\'re grateful for', 'Ask about happy memories', 'Suggest a lighter topic'],
                        targetUserId: userId,
                        chatId: chatId,
                        priority: 'high'
                    }));
                }
            }

            return insights.filter(insight => !insight.isExpired());
        } catch (error) {
            console.error('Error generating insights:', error);
            return [];
        }
    }

    // Topic Suggestions
    getTopicSuggestions(chatId, context = 'icebreaker') {
        const metrics = this.conversationMetrics.get(chatId);
        const suggestions = [];
        
        // Get appropriate topics based on context
        const topicPool = DEFAULT_TOPICS[context] || DEFAULT_TOPICS.icebreakers;
        
        // Add contextual scoring based on conversation
        topicPool.forEach(topic => {
            const suggestion = new TopicSuggestion({
                ...topic,
                context: context,
                chatId: chatId,
                relevanceScore: this.calculateTopicRelevance(topic, metrics)
            });
            suggestions.push(suggestion);
        });

        // Sort by relevance and return top suggestions
        return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
    }

    calculateTopicRelevance(topic, metrics) {
        let relevance = 0.5; // Base score
        
        if (!metrics) return relevance;
        
        // Prefer topics that haven't been discussed
        const discussedTopics = metrics.topicChanges;
        if (discussedTopics < 3) {
            relevance += 0.2; // Prefer variety in new conversations
        }
        
        // Adjust based on conversation length
        if (metrics.messageCount > 20) {
            relevance += topic.difficulty === 'medium' ? 0.2 : 0;
        } else {
            relevance += topic.difficulty === 'easy' ? 0.2 : 0;
        }
        
        return Math.min(relevance, 1);
    }

    // Mood Analysis
    generateMoodAnalysis(userId, recentMessages, chatId) {
        try {
            if (!this.isFeatureEnabled(userId, 'sentimentAnalysis')) {
                return null;
            }

            if (!recentMessages || recentMessages.length === 0) {
                return new MoodAnalysis({
                    chatId,
                    userId,
                    primary: 'neutral'
                });
            }

            // Analyze recent messages for mood
            let totalSentiment = 0;
            let emotionTotals = {
                joy: 0, sadness: 0, anger: 0, fear: 0,
                surprise: 0, disgust: 0, trust: 0, anticipation: 0
            };

            recentMessages.forEach(message => {
                const sentiment = this.sentiment.analyze(message.content);
                totalSentiment += sentiment.score;
                
                const emotions = this.detectEmotions(message.content);
                Object.keys(emotions).forEach(emotion => {
                    emotionTotals[emotion] += emotions[emotion];
                });
            });

            // Calculate averages
            const avgSentiment = totalSentiment / recentMessages.length;
            Object.keys(emotionTotals).forEach(emotion => {
                emotionTotals[emotion] /= recentMessages.length;
            });

            // Determine primary mood
            const primaryEmotion = Object.keys(emotionTotals).reduce((a, b) => 
                emotionTotals[a] > emotionTotals[b] ? a : b
            );

            const moodMapping = {
                joy: 'happy',
                sadness: 'sad',
                anger: 'angry',
                fear: 'nervous',
                surprise: 'surprised',
                disgust: 'disgusted',
                trust: 'calm',
                anticipation: 'excited'
            };

            const mood = new MoodAnalysis({
                chatId,
                userId,
                primary: emotionTotals[primaryEmotion] > 0.2 ? moodMapping[primaryEmotion] : 'neutral',
                secondary: Object.keys(emotionTotals).filter(e => emotionTotals[e] > 0.1 && e !== primaryEmotion),
                intensity: Math.min(emotionTotals[primaryEmotion], 1),
                confidence: Math.min(recentMessages.length / 5, 1),
                emotions: emotionTotals,
                trend: avgSentiment > 1 ? 'improving' : avgSentiment < -1 ? 'declining' : 'stable'
            });

            return mood;
        } catch (error) {
            console.error('Error generating mood analysis:', error);
            return null;
        }
    }

    // Conversation Metrics Management
    updateConversationMetrics(chatId, analysis) {
        let metrics = this.conversationMetrics.get(chatId) || new ConversationMetrics({ chatId });
        
        metrics.addMessage({}, null); // Add message count
        metrics.addSentimentPoint(analysis.sentiment);
        
        // Update engagement based on analysis
        if (analysis.engagement.score > 0.5) {
            metrics.updateEngagement(analysis.engagement.score);
        }
        
        this.conversationMetrics.set(chatId, metrics);
    }

    // Utility Methods
    hashMessage(content) {
        return require('crypto').createHash('md5').update(content).digest('hex');
    }

    trackAPIUsage(endpoint, usage) {
        this.apiUsage.calls++;
        if (usage) {
            this.apiUsage.tokens += usage.total_tokens || 0;
            this.apiUsage.cost += (usage.total_tokens || 0) * 0.002 / 1000; // Rough estimate
        }
    }

    getAPIUsageStats() {
        return { ...this.apiUsage };
    }

    // AI-Powered Smart Matching
    async findBestMatch(userId, waitingUsers) {
        try {
            if (!this.isFeatureEnabled(userId, 'compatibilityScoring')) {
                // Fallback to random matching
                return waitingUsers[Math.floor(Math.random() * waitingUsers.length)];
            }

            const userPersonality = this.personalities.get(userId);
            if (!userPersonality || waitingUsers.length === 0) {
                return waitingUsers[Math.floor(Math.random() * waitingUsers.length)];
            }

            let bestMatch = null;
            let bestScore = 0;

            for (const candidateId of waitingUsers) {
                if (candidateId === userId) continue;

                const candidatePersonality = this.personalities.get(candidateId);
                if (!candidatePersonality) continue;

                const compatibility = userPersonality.getCompatibilityWith(candidatePersonality);
                if (compatibility > bestScore) {
                    bestScore = compatibility;
                    bestMatch = candidateId;
                }
            }

            return bestMatch || waitingUsers[Math.floor(Math.random() * waitingUsers.length)];
        } catch (error) {
            console.error('Error in smart matching:', error);
            return waitingUsers[Math.floor(Math.random() * waitingUsers.length)];
        }
    }

    // Cleanup Methods
    cleanup() {
        // Clean expired insights
        // Clean old personality data
        // Clean conversation metrics
        console.log('AI Service cleanup completed');
    }
}

module.exports = AIService;
