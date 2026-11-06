#!/bin/bash
# deploy.sh — Automated deploy script for FutureCraft
set -euo pipefail

PROJECT_NAME="futurecraft"
BUILD_ENV=${1:-docker}

echo "🚀 Deploying ${PROJECT_NAME} (${BUILD_ENV})..."

if [ "${BUILD_ENV}" = "vercel" ]; then
  echo "Building frontend..."
  npm ci
  npm run build
  echo "Deploying to Vercel..."
  vercel --prod --confirm
  echo "✅ Deployed to Vercel"

elif [ "${BUILD_ENV}" = "docker" ]; then
  TAG="${DOCKER_TAG:-${PROJECT_NAME}:latest}"
  echo "Building Docker image: ${TAG}..."
  docker build -t "${TAG}" .
  echo "Running smoke test..."
  CONTAINER_ID=$(docker run -d -p 3001:3000 "${TAG}")
  sleep 3
  if curl -sf http://localhost:3001 > /dev/null; then
    echo "✅ Smoke test passed"
  else
    echo "❌ Smoke test failed"
    docker stop "${CONTAINER_ID}" 2>/dev/null || true
    exit 1
  fi
  docker stop "${CONTAINER_ID}" 2>/dev/null || true
  echo "📦 Image ready: ${TAG}"

else
  echo "Unknown: ${BUILD_ENV}. Use 'vercel' or 'docker'."
  exit 1
fi
