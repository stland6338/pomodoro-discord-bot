#!/bin/bash

# Cloud Run Secret Debug Script

set -e

PROJECT_ID=${1:-""}
SERVICE_NAME="pomodoro-discord-bot"
REGION="asia-northeast1"

if [[ -z "$PROJECT_ID" ]]; then
    echo "❌ Usage: ./debug-secrets.sh PROJECT_ID"
    exit 1
fi

echo "🔍 Debugging Cloud Run secrets for project: $PROJECT_ID"
echo "================================================="

# Set project
gcloud config set project "$PROJECT_ID"

echo "📋 1. Checking existing secrets..."
echo "-----------------------------------"
gcloud secrets list | grep -E "(discord|token|client)" || echo "No matching secrets found"

echo ""
echo "🔐 2. Checking secret versions..."
echo "---------------------------------"
if gcloud secrets versions list discord-token >/dev/null 2>&1; then
    echo "✅ discord-token secret exists"
    gcloud secrets versions list discord-token --limit=1
else
    echo "❌ discord-token secret not found"
fi

if gcloud secrets versions list client-id >/dev/null 2>&1; then
    echo "✅ client-id secret exists"
    gcloud secrets versions list client-id --limit=1
else
    echo "❌ client-id secret not found"
fi

echo ""
echo "🚀 3. Checking Cloud Run service configuration..."
echo "------------------------------------------------"
if gcloud run services describe $SERVICE_NAME --region=$REGION >/dev/null 2>&1; then
    echo "✅ Service exists"
    echo "Environment variables:"
    gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.template.spec.containers[0].env[].name,spec.template.spec.template.spec.containers[0].env[].value)"
    echo ""
    echo "Secrets:"
    gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.template.spec.containers[0].env[].valueFrom.secretKeyRef.name,spec.template.spec.template.spec.containers[0].env[].valueFrom.secretKeyRef.key)"
else
    echo "❌ Service not found"
fi

echo ""
echo "📝 4. Recommended fixes:"
echo "------------------------"
echo "If secrets are missing, create them:"
echo "  gcloud secrets create discord-token --data-file=-"
echo "  gcloud secrets create client-id --data-file=-"
echo ""
echo "If service configuration is wrong, redeploy:"
echo "  gcloud run deploy $SERVICE_NAME --set-secrets=DISCORD_TOKEN=discord-token:latest,CLIENT_ID=client-id:latest --region=$REGION"
echo ""
echo "Check logs:"
echo "  gcloud logs tail --follow --filter=\"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --format=\"value(textPayload)\""