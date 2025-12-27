# Multi-stage build for optimized production image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user for security
RUN addgroup -g 1001 -S anon-connect && \
    adduser -S anon-connect -u 1001

# Set ownership of app directory
RUN chown -R anon-connect:anon-connect /app

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S anon-connect && \
    adduser -S anon-connect -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=anon-connect:anon-connect /app ./

# Create necessary directories with proper permissions
RUN mkdir -p logs && \
    chown -R anon-connect:anon-connect logs

# Set security-focused environment variables
ENV NODE_ENV=production
ENV PORT=3002
ENV SECRET_KEY=CHANGEME_IN_PRODUCTION
ENV SESSION_SECRET=CHANGEME_IN_PRODUCTION

# Expose port
EXPOSE 3002

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Switch to non-root user
USER anon-connect

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
