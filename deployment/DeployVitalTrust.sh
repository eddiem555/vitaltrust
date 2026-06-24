#!/bin/bash
# VitalTrust Docker Deployment Bootstrapper
# Simple script that builds and runs the standalone or a role-based instance, passing local .env elements.

echo "============================================="
echo "   VITALTRUST DOCKER BOOTSTRAP DEPLOYER      "
echo "============================================="

# Find actual directory where the project or .env is
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
    echo "[INFO] Found .env file at $(pwd)/$ENV_FILE. Will pass to container."
else
    echo "[WARNING] No .env file found in $(pwd). Attempting helper searches..."
    if [ -f "./deployment/.env" ]; then
        ENV_FILE="./deployment/.env"
    else
        echo "[INFO] No .env found; creating minimal .env (add Duo/API keys as needed). Node role is configured via Settings UI / deployment_config.json."
        echo "NODE_ENV=production" > .env
        ENV_FILE=".env"
    fi
fi

# Locate Dockerfile
DOCKER_FILE="deployment/Dockerfile"
if [ ! -f "$DOCKER_FILE" ] && [ -f "deployment/Dockerfile.txt" ]; then
    DOCKER_FILE="deployment/Dockerfile.txt"
fi
if [ ! -f "$DOCKER_FILE" ] && [ -f "Dockerfile" ]; then
    DOCKER_FILE="Dockerfile"
fi

# Safely reset local database/runtime cache before new container build (fresh seed from INITIAL_DB)
reset_db_artifact() {
  if [ -f "$1" ]; then
    echo "[INFO] Removing stale $1"
    rm -f "$1"
  fi
}

for artifact in "persistent_db.json" "deployment_config.json" "system_console.log"; do
  reset_db_artifact "$(pwd)/$artifact"
done

# Common host paths when refreshing from /tmp/vitaltrust or a persistent checkout
reset_db_artifact "/home/ubuntu/vitaltrust/persistent_db.json"
reset_db_artifact "/tmp/vitaltrust/persistent_db.json"

echo "[1/3] Building VitalTrust Docker Image..."
docker build -t vitaltrust-app -f "$DOCKER_FILE" .

echo "[2/3] Stopping any legacy/conflicting containers..."
docker stop vitaltrust-container vitaltrust-app 2>/dev/null || true
docker rm vitaltrust-container vitaltrust-app 2>/dev/null || true

# Pre-create the custom network for proxy communication
docker network create vitaltrust-net 2>/dev/null || true

echo "[3/3] Launching VitalTrust Container on vitaltrust-net..."
docker run -d \
  --name vitaltrust-app \
  -p 3000:3000 \
  --env-file "$ENV_FILE" \
  --network vitaltrust-net \
  --restart unless-stopped \
  vitaltrust-app

echo "---------------------------------------------"
echo "GATEWAY CHECK: Checking Nginx Proxy Manager (NPM)..."
if [ "$(docker inspect -f '{{.State.Running}}' nginx-proxy-manager 2>/dev/null)" = "true" ]; then
    echo "[INFO] Nginx Proxy Manager is already running."
    # Ensure it is connected to the same network as the app
    docker network connect vitaltrust-net nginx-proxy-manager 2>/dev/null || true
else
    echo "[INFO] Nginx Proxy Manager (nginx-proxy-manager) is not active."
    if docker ps -a --format '{{.Names}}' | grep -Eq "^nginx-proxy-manager$"; then
        echo "[INFO] Starting existing stopped nginx-proxy-manager container..."
        docker start nginx-proxy-manager
        # Ensure it is connected to the network
        docker network connect vitaltrust-net nginx-proxy-manager 2>/dev/null || true
    else
        echo "[INFO] Creating and starting secure Nginx Proxy Manager container..."
        docker run -d \
          --name nginx-proxy-manager \
          --restart always \
          -p 80:80 -p 81:81 -p 443:443 \
          -v "$SCRIPT_DIR/npm-data:/data" \
          -v "$SCRIPT_DIR/npm-letsencrypt:/etc/letsencrypt" \
          --network vitaltrust-net \
          jc21/nginx-proxy-manager:latest
    fi
fi

echo "---------------------------------------------"
echo "HEALTH CHECK: Verifying container is active..."
sleep 3
if docker ps | grep -q "vitaltrust-app"; then
    echo "[SUCCESS] VitalTrust container successfully deployed and listening on http://localhost:3000"
else
    echo "[ERROR] Container failed to start. View logs with: docker logs vitaltrust-app"
fi
echo "---------------------------------------------"
