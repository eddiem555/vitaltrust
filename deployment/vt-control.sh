#!/bin/bash
# VitalTrust Lifecycle Manager
# Usage: ./vt-control.sh [start|stop|restart|status|logs]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Detect Docker Compose version
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

COMMAND=$1

# Function to inject .env into container
sync_env() {
    if [ -f "../.env" ]; then
        echo "[INFO] Found .env in root. Injecting into container 'vitaltrust-app'..."
        # Check if container is actually running
        if docker ps -q --filter "name=vitaltrust-app" | grep -q . ; then
            docker cp ../.env vitaltrust-app:/app/.env
            # Verify file inside
            if docker exec vitaltrust-app ls -la /app/.env >/dev/null 2>&1; then
                echo "[INFO] .env injection verified."
            else
                echo "[ERROR] .env injection failed (copy command succeeded but file not found)."
            fi
        else
            echo "[WARN] Container 'vitaltrust-app' is not running. Injection skipped."
        fi
    else
        echo "[INFO] .env file not found in parent directory. Using container defaults."
    fi
}

case $COMMAND in
    start)
        echo "Starting VitalTrust Stack..."
        $DOCKER_COMPOSE up -d
        sleep 2
        sync_env
        ;;
    stop)
        echo "Stopping VitalTrust Stack..."
        $DOCKER_COMPOSE stop
        ;;
    down)
        echo "Full Shutdown (Removing Containers)..."
        $DOCKER_COMPOSE down
        ;;
    restart)
        echo "Restarting VitalTrust Application..."
        $DOCKER_COMPOSE restart vitaltrust-app
        sleep 2
        sync_env
        echo "Done."
        ;;
    status)
        echo "Current Stack Status:"
        $DOCKER_COMPOSE ps
        ;;
    logs)
        echo "Streaming application logs (Ctrl+C to exit)..."
        $DOCKER_COMPOSE logs -f vitaltrust-app
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|down}"
        exit 1
        ;;
esac
