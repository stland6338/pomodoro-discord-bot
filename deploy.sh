#!/bin/bash

# Discord Pomodoro Bot - Cloud Run Deployment Script

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${1:-""}
DISCORD_TOKEN=${2:-""}
CLIENT_ID=${3:-""}
REGION=${4:-"asia-northeast1"}
SERVICE_NAME="pomodoro-discord-bot"

echo -e "${GREEN}🚀 Discord Pomodoro Bot - Cloud Run Deployment${NC}"
echo "================================================="

# Check if required parameters are provided
if [[ -z "$PROJECT_ID" ]] || [[ -z "$DISCORD_TOKEN" ]] || [[ -z "$CLIENT_ID" ]]; then
    echo -e "${RED}❌ Usage: ./deploy.sh PROJECT_ID DISCORD_TOKEN CLIENT_ID [REGION]${NC}"
    echo "Example: ./deploy.sh my-project-123 Bot.ABC123... 987654321 asia-northeast1"
    exit 1
fi

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud CLI not found. Please install it first.${NC}"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set project
echo -e "${YELLOW}📋 Setting project: $PROJECT_ID${NC}"
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com

# Create secrets
echo -e "${YELLOW}🔐 Creating/updating secrets...${NC}"

# Create or update discord-token secret
if gcloud secrets describe discord-token >/dev/null 2>&1; then
    echo "Updating existing discord-token secret..."
    echo -n "$DISCORD_TOKEN" | gcloud secrets versions add discord-token --data-file=-
else
    echo "Creating new discord-token secret..."
    echo -n "$DISCORD_TOKEN" | gcloud secrets create discord-token --data-file=- --replication-policy="automatic"
fi

# Create or update client-id secret
if gcloud secrets describe client-id >/dev/null 2>&1; then
    echo "Updating existing client-id secret..."
    echo -n "$CLIENT_ID" | gcloud secrets versions add client-id --data-file=-
else
    echo "Creating new client-id secret..."
    echo -n "$CLIENT_ID" | gcloud secrets create client-id --data-file=- --replication-policy="automatic"
fi

# Verify secrets were created
echo -e "${YELLOW}🔍 Verifying secrets...${NC}"
gcloud secrets list | grep -E "(discord-token|client-id)" || echo -e "${RED}❌ Warning: Secrets may not have been created properly${NC}"

# Build and deploy using Cloud Build
echo -e "${YELLOW}🏗️  Building and deploying with Cloud Build...${NC}"
gcloud builds submit --config=cloudbuild.yaml .

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" 2>/dev/null || echo "")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo "================================================="
echo -e "📍 Service URL: ${GREEN}$SERVICE_URL${NC}"
echo -e "🏥 Health Check: ${GREEN}$SERVICE_URL/health${NC}"
echo -e "📊 Logs: ${YELLOW}gcloud logs tail --follow --filter=\"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\"${NC}"
echo -e "🔧 Console: ${YELLOW}https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME${NC}"
echo ""
echo -e "${GREEN}🎉 Your Discord Pomodoro Bot is now running on Cloud Run!${NC}"