#!/bin/sh
# Refresh VitalTrust from /tmp/vitaltrust.zip and redeploy via DeployVitalTrust.sh

set -e

VT_ZIP="/tmp/vitaltrust.zip"
VT_DIR="/tmp/vitaltrust"

vt_fail() {
  echo ""
  echo "[ERROR] $1" >&2
  exit 1
}

vt_check_unzip() {
  if command -v unzip >/dev/null 2>&1; then
    return 0
  fi
  echo "============================================="
  echo "  unzip is required"
  echo "============================================="
  echo ""
  echo "Package extraction failed: 'unzip' is not installed."
  echo ""
  echo "Fix (Ubuntu/Debian):"
  echo "  sudo apt-get update && sudo apt-get install -y unzip"
  echo ""
  exit 1
}

vt_check_docker_access() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  echo "============================================="
  echo "  Docker access required"
  echo "============================================="
  echo ""
  echo "This script cannot connect to Docker (unix:///var/run/docker.sock)."
  echo ""

  if groups | tr ' ' '\n' | grep -qx docker; then
    echo "User '$USER' is in the 'docker' group, but this shell has not picked it up yet."
    echo ""
    echo "Fix — run one of the following, then retry:"
    echo "  newgrp docker"
    echo "  # or log out and open a new SSH session"
  else
    echo "User '$USER' is not in the 'docker' group."
    echo ""
    echo "Fix (run once, then log out and back in — or use newgrp):"
    echo "  sudo usermod -aG docker $USER"
    echo "  newgrp docker"
    echo ""
    echo "Verify with:  docker info"
  fi
  echo ""
  exit 1
}

vt_check_package() {
  if [ -f "$VT_ZIP" ]; then
    return 0
  fi
  echo "============================================="
  echo "  VitalTrust package missing"
  echo "============================================="
  echo ""
  echo "Expected archive not found:"
  echo "  $VT_ZIP"
  echo ""
  echo "Copy vitaltrust.zip to /tmp on this VM, then run this script again."
  echo ""
  exit 1
}

echo "============================================="
echo "   VITALTRUST REFRESH"
echo "============================================="

vt_check_unzip
vt_check_package
vt_check_docker_access

echo "[INFO] Prerequisites OK (unzip, package, docker)."

docker stop vitaltrust-app 2>/dev/null || true
docker rm vitaltrust-app 2>/dev/null || true

rm -rf "$VT_DIR"
mkdir -p "$VT_DIR"

echo "[INFO] Extracting $VT_ZIP ..."
if ! unzip -q "$VT_ZIP" -d /tmp; then
  vt_fail "Failed to extract $VT_ZIP"
fi

if [ ! -d "$VT_DIR/deployment" ]; then
  echo ""
  echo "[ERROR] VitalTrust deployment directory missing after extract." >&2
  echo "        Expected: $VT_DIR/deployment" >&2
  echo ""
  echo "Check that vitaltrust.zip was built from the project root and includes deployment/." >&2
  exit 1
fi

rm -f "$VT_ZIP"

# Drop any stale database artifacts from prior installs (container is recreated without volumes)
rm -f "$VT_DIR/persistent_db.json"
rm -f "$VT_DIR/deployment_config.json"
rm -f "$VT_DIR/system_console.log"
rm -f "$VT_DIR/boot_instance.id"
rm -f "$VT_DIR/duo_sso_config.json"
rm -f "$VT_DIR/local_auth_config.json"

if [ ! -f "$HOME/.env" ]; then
  echo "[WARN] $HOME/.env not found. Initial password can be set from the web UI."
else
  cp "$HOME/.env" "$VT_DIR/"
  echo "[INFO] Copied $HOME/.env into package tree."
fi

echo "[INFO] Running DeployVitalTrust.sh ..."
bash "$VT_DIR/deployment/DeployVitalTrust.sh"
