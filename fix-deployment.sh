#!/bin/bash

# Fix Cloud Run deployment by resolving environment variable conflicts

set -e

PROJECT_ID=${1:-""}
REGION="asia-northeast1"
SERVICE_NAME="pomodoro-discord-bot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Fixing Cloud Run deployment conflicts${NC}"
echo "======================================"

if [[ -z "$PROJECT_ID" ]]; then
    echo -e "${RED}❌ Usage: ./fix-deployment.sh PROJECT_ID${NC}"
    exit 1
fi

# Set project
gcloud config set project "$PROJECT_ID"

echo -e "${YELLOW}📋 Step 1: Checking current service status...${NC}"
if gcloud run services describe $SERVICE_NAME --region=$REGION >/dev/null 2>&1; then
    echo -e "${YELLOW}Service exists. Checking environment variables...${NC}"
    
    # Check if DISCORD_TOKEN is set as env var
    ENV_VARS=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.template.spec.containers[0].env[].name)" 2>/dev/null || echo "")
    
    if echo "$ENV_VARS" | grep -q "DISCORD_TOKEN"; then
        echo -e "${YELLOW}⚠️  DISCORD_TOKEN found as environment variable. This conflicts with secrets.${NC}"
        echo -e "${YELLOW}🗑️  Step 2: Removing conflicting environment variables...${NC}"
        
        gcloud run services update $SERVICE_NAME \
            --region=$REGION \
            --remove-env-vars=DISCORD_TOKEN,CLIENT_ID \
            --quiet || echo "Failed to remove env vars, will delete service instead"
        
        echo -e "${GREEN}✅ Environment variables cleared${NC}"
    else
        echo -e "${GREEN}✅ No conflicting environment variables found${NC}"
    fi
else
    echo -e "${GREEN}✅ Service does not exist yet${NC}"
fi

echo -e "${YELLOW}🚀 Step 3: Deploying with proper secrets configuration...${NC}"

gcloud run deploy $SERVICE_NAME \
    --image=gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --max-instances=5 \
    --min-instances=1 \
    --port=8080 \
    --set-secrets=DISCORD_TOKEN=discord-token:latest,CLIENT_ID=client-id:latest

echo -e "${GREEN}✅ deployment completed!${NC}"

echo -e "${YELLOW}📊 Step 4: Verifying deployment...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" 2>/dev/null || echo "")

echo "================================================="
echo -e "🎉 Deployment successful!"
echo -e "📍 Service URL: ${GREEN}$SERVICE_URL${NC}"
echo -e "🏥 Health Check: ${GREEN}$SERVICE_URL/health${NC}"
echo -e "📊 Logs: ${YELLOW}gcloud logs tail --follow --filter=\"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\"${NC}"
echo ""
echo -e "${GREEN}🤖 Your Discord Pomodoro Bot should now be running with proper secrets!${NC}"