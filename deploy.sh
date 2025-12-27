#!/bin/bash

# Anon-Connect Deployment Script
# This script handles the deployment of the Anon-Connect application

set -e  # Exit on any error

# Configuration
APP_NAME="anon-connect"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    success "Dependencies check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p data
    mkdir -p backups
    mkdir -p config
    mkdir -p ssl
    
    success "Directories created"
}

# Check and create environment file
setup_environment() {
    log "Setting up environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        log "Creating environment file from template..."
        cat > "$ENV_FILE" << EOF
# Anon-Connect Environment Configuration
NODE_ENV=production
PORT=3002

# Security Keys (CHANGE THESE IN PRODUCTION!)
SECRET_KEY=CHANGE_ME_SUPER_SECRET_KEY_AT_LEAST_32_CHARS
SESSION_SECRET=CHANGE_ME_SESSION_SECRET_KEY_32_CHARS

# OpenAI Configuration (Optional)
OPENAI_API_KEY=

# Admin Configuration
ADMIN_EMAIL=admin@example.com

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3002,https://yourdomain.com

# Redis Configuration
REDIS_PASSWORD=anon-connect-redis-pass

# Database Configuration
DATABASE_PATH=./data/anon_connect.db

# Monitoring
ENABLE_MONITORING=true
METRICS_PORT=9090
EOF
        warning "Environment file created. Please edit $ENV_FILE with your production values!"
    else
        log "Environment file already exists"
    fi
}

# Backup existing data
backup_data() {
    if [ -d "data" ] && [ "$(ls -A data)" ]; then
        log "Creating backup of existing data..."
        
        BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_PATH="$BACKUP_DIR/backup_$BACKUP_TIMESTAMP"
        
        mkdir -p "$BACKUP_PATH"
        cp -r data/* "$BACKUP_PATH/"
        
        success "Backup created at $BACKUP_PATH"
    else
        log "No existing data to backup"
    fi
}

# Build and deploy
deploy() {
    log "Starting deployment..."
    
    # Pull latest changes (if in git repo)
    if [ -d ".git" ]; then
        log "Pulling latest changes from git..."
        git pull
    fi
    
    # Build and start services
    log "Building and starting services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    success "Services started successfully"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T anon-connect node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" 2>/dev/null; then
            success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying in 5 seconds..."
        sleep 5
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
    return 1
}

# Show status
show_status() {
    log "Deployment status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    
    log "Application logs:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs --tail=10 anon-connect
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Find latest backup
    if [ -d "$BACKUP_DIR" ]; then
        LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | head -n1)
        if [ -n "$LATEST_BACKUP" ]; then
            log "Restoring from backup: $LATEST_BACKUP"
            cp -r "$BACKUP_DIR/$LATEST_BACKUP"/* data/
            docker-compose -f "$DOCKER_COMPOSE_FILE" restart anon-connect
            success "Rollback completed"
        else
            warning "No backup found for rollback"
        fi
    else
        warning "Backup directory not found"
    fi
}

# Cleanup old backups (keep last 10)
cleanup_backups() {
    if [ -d "$BACKUP_DIR" ]; then
        log "Cleaning up old backups..."
        ls -t "$BACKUP_DIR" | tail -n +11 | xargs -I {} rm -rf "$BACKUP_DIR/{}"
        success "Old backups cleaned up"
    fi
}

# Main deployment function
main() {
    log "Starting Anon-Connect deployment script"
    
    check_dependencies
    create_directories
    setup_environment
    backup_data
    deploy
    
    if health_check; then
        show_status
        cleanup_backups
        success "Deployment completed successfully!"
        log "Application is running at http://localhost:3002"
        log "Admin panel: http://localhost:3002/admin.html"
    else
        error "Deployment failed health check"
        log "To rollback, run: $0 rollback"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "status")
        show_status
        ;;
    "logs")
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f "${2:-anon-connect}"
        ;;
    "stop")
        log "Stopping services..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
        success "Services stopped"
        ;;
    "restart")
        log "Restarting services..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" restart
        success "Services restarted"
        ;;
    "backup")
        backup_data
        ;;
    "health")
        health_check
        ;;
    "help")
        echo "Anon-Connect Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Deploy the application (default)"
        echo "  rollback  - Rollback to previous backup"
        echo "  status    - Show application status"
        echo "  logs      - Show application logs"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  backup    - Create backup of current data"
        echo "  health    - Perform health check"
        echo "  help      - Show this help message"
        ;;
    *)
        error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac
