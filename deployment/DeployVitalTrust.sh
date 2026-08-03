#!/bin/bash
# VitalTrust Docker Deployment Bootstrapper
# Simple script that builds and runs the standalone or a role-based instance, passing local .env elements.

echo "============================================="
echo "   VITALTRUST DOCKER BOOTSTRAP DEPLOYER      "
echo "============================================="

# Find actual directory where the project or .env is
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

ENV_FILE=""
if [ -f ".env" ]; then
    ENV_FILE=".env"
    echo "[INFO] Found .env file at $(pwd)/$ENV_FILE. Will pass optional secrets to container."
elif [ -f "./deployment/.env" ]; then
    ENV_FILE="./deployment/.env"
    echo "[INFO] Found .env at $ENV_FILE. Will pass optional secrets to container."
else
    echo "[INFO] No .env file found. Container will start with NODE_ENV=production only."
    echo "[INFO] Configure Duo/API keys via optional .env, or use Settings UI and first-login password bootstrap."
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

for artifact in "persistent_db.json" "deployment_config.json" "system_console.log" "boot_instance.id" "duo_sso_config.json" "local_auth_config.json"; do
  reset_db_artifact "$(pwd)/$artifact"
done

# Common host paths when refreshing from /tmp/vitaltrust or a persistent checkout
reset_db_artifact "/home/ubuntu/vitaltrust/persistent_db.json"
reset_db_artifact "/tmp/vitaltrust/persistent_db.json"
reset_db_artifact "/tmp/vitaltrust/boot_instance.id"

echo "[1/3] Building VitalTrust Docker Image..."
docker build -t vitaltrust-app -f "$DOCKER_FILE" .

echo "[2/3] Stopping any legacy/conflicting containers..."
docker stop vitaltrust-container vitaltrust-app 2>/dev/null || true
docker rm vitaltrust-container vitaltrust-app 2>/dev/null || true

# Pre-create the custom network for proxy communication
docker network create vitaltrust-net 2>/dev/null || true

echo "[3/3] Launching VitalTrust Container on vitaltrust-net..."
DOCKER_RUN_ARGS=(
  -d
  --name vitaltrust-app
  -p 3000:3000
  --network vitaltrust-net
  --restart unless-stopped
  -e NODE_ENV=production
)
if [ -n "$ENV_FILE" ]; then
  DOCKER_RUN_ARGS+=(--env-file "$ENV_FILE")
fi

docker run "${DOCKER_RUN_ARGS[@]}" vitaltrust-app

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
