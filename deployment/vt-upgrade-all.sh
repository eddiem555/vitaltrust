#!/bin/sh
# Instructor tool: rebuild the VitalTrust Docker image and recreate ALL vitaltrust
# containers on this host so every student instance picks up the new version.
#
#   vt-upgrade-all           — rebuild image + recreate all containers (prompts first)
#   vt-upgrade-all --yes     — skip confirmation
#   vt-upgrade-all --no-build — recreate containers from the current local image only
#
# Restricted to ubuntu or root (same policy as vt-stop -all).

set -e

# Instructor-only gate (before any Docker or build work). --help is allowed for all users.
vt_require_instructor() {
  case "${1:-}" in
    -h|--help)
      return 0
      ;;
  esac

  case "$(id -un)" in
    ubuntu)
      return 0
      ;;
  esac

  if [ "$(id -u)" -eq 0 ]; then
    return 0
  fi

  echo "[ERROR] vt-upgrade-all is restricted to the ubuntu user or root (sudo)." >&2
  echo "        You are logged in as: $(id -un)" >&2
  echo "        Student accounts (aiuser*) cannot run this command." >&2
  echo "        Ask your instructor to upgrade all instances on this host." >&2
  exit 1
}

vt_require_instructor "$@"

ASSUME_YES=0
SKIP_BUILD=0
IMAGE="${VITALTRUST_IMAGE:-vitaltrust-app}"

vt_fail() {
  echo "[ERROR] $1" >&2
  exit 1
}

vt_require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    vt_fail "docker is not installed or not on PATH."
  fi
  if ! docker info >/dev/null 2>&1; then
    vt_fail "Cannot connect to Docker. Run this script as ubuntu or via sudo."
  fi
}

vt_usage() {
  echo "Usage: vt-upgrade-all [--yes] [--no-build]"
  echo ""
  echo "  Rebuild vitaltrust-app and recreate every VitalTrust container on this host"
  echo "  (vitaltrust-app + vitaltrust-aiuser*), preserving host port mappings."
  echo ""
  echo "Options:"
  echo "  --yes, -y       Skip confirmation prompt"
  echo "  --no-build      Do not rebuild the image; recreate containers from current image"
  echo "  -h, --help      Show this help"
  echo ""
  echo "Run from the VitalTrust project root or deployment/ directory."
  echo "Restricted to ubuntu or sudo."
}

vt_parse_args() {
  for arg in "$@"; do
    case "$arg" in
      --yes|-y)
        ASSUME_YES=1
        ;;
      --no-build)
        SKIP_BUILD=1
        ;;
      -h|--help)
        vt_usage
        exit 0
        ;;
      *)
        vt_fail "Unknown option: $arg (try --help)"
        ;;
    esac
  done
}

vt_project_root() {
  if [ -n "${VT_PROJECT_ROOT:-}" ] && [ -f "$VT_PROJECT_ROOT/deployment/Dockerfile" ]; then
    echo "$(CDPATH= cd -- "$VT_PROJECT_ROOT" && pwd)"
    return 0
  fi

  if [ -f "./deployment/Dockerfile" ]; then
    echo "$(pwd)"
    return 0
  fi

  script_dir="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
  if [ -f "$script_dir/Dockerfile" ]; then
    echo "$(CDPATH= cd -- "$script_dir/.." && pwd)"
    return 0
  fi
  if [ -f "$script_dir/../deployment/Dockerfile" ]; then
    echo "$(CDPATH= cd -- "$script_dir/.." && pwd)"
    return 0
  fi

  for candidate in /tmp/vitaltrust /home/ubuntu/vitaltrust; do
    if [ -f "$candidate/deployment/Dockerfile" ]; then
      echo "$candidate"
      return 0
    fi
  done

  vt_fail "Cannot find deployment/Dockerfile. cd to the VitalTrust package or set VT_PROJECT_ROOT."
}

vt_linux_user_for_container() {
  name="$1"
  case "$name" in
    vitaltrust-app)
      echo "ubuntu"
      ;;
    vitaltrust-*)
      echo "${name#vitaltrust-}"
      ;;
    *)
      echo ""
      ;;
  esac
}

vt_host_port_for_user() {
  linux_user="$1"
  num="$(echo "$linux_user" | sed 's/[^0-9]*//g')"
  if [ -z "$num" ]; then
    num=0
  fi
  echo $((3000 + num))
}

vt_env_file_for_user() {
  linux_user="$1"
  if [ -f "/home/$linux_user/.env" ]; then
    echo "/home/$linux_user/.env"
  fi
}

vt_host_port_for_container() {
  name="$1"
  port="$(docker inspect -f '{{range $p, $conf := .NetworkSettings.Ports}}{{if eq $p "3000/tcp"}}{{if $conf}}{{(index $conf 0).HostPort}}{{end}}{{end}}{{end}}' "$name" 2>/dev/null || true)"
  if [ -n "$port" ]; then
    echo "$port"
    return 0
  fi
  linux_user="$(vt_linux_user_for_container "$name")"
  if [ -n "$linux_user" ]; then
    vt_host_port_for_user "$linux_user"
  fi
}

vt_list_containers() {
  docker ps -a --filter "name=vitaltrust" --format '{{.Names}}' | while read -r name; do
    [ -z "$name" ] && continue
    case "$name" in
      vitaltrust|vitaltrust-*)
        echo "$name"
        ;;
    esac
  done
}

vt_recreate_container() {
  name="$1"
  host_port="$2"
  env_file="$3"

  echo "[INFO] Recreating $name on host port $host_port ..."
  docker rm -f "$name" >/dev/null 2>&1 || true

  run_args="-d --name $name -p ${host_port}:3000 -e NODE_ENV=production"
  if [ "$name" = "vitaltrust-app" ]; then
    run_args="$run_args --network vitaltrust-net --restart unless-stopped"
  fi

  if [ -n "$env_file" ]; then
    echo "       env: $env_file"
    # shellcheck disable=SC2086
    docker run $run_args --env-file "$env_file" "$IMAGE" >/dev/null
  else
    echo "       env: (none)"
    # shellcheck disable=SC2086
    docker run $run_args "$IMAGE" >/dev/null
  fi
}

vt_print_version_from_container() {
  name="$1"
  if docker ps --format '{{.Names}}' | grep -Fxq "$name"; then
    version="$(docker exec "$name" cat /app/src/version.ts 2>/dev/null | sed -n "s/.*VERSION = \"\(.*\)\".*/\1/p" | head -n 1)"
    if [ -n "$version" ]; then
      echo "$version"
    else
      echo "(unknown)"
    fi
  else
    echo "(not running)"
  fi
}

vt_parse_args "$@"

vt_require_docker

ROOT="$(vt_project_root)"
DOCKERFILE="$ROOT/deployment/Dockerfile"
if [ ! -f "$DOCKERFILE" ]; then
  vt_fail "Missing $DOCKERFILE"
fi

CONTAINERS="$(vt_list_containers | sort)"
CONTAINER_COUNT=0
if [ -n "$CONTAINERS" ]; then
  CONTAINER_COUNT="$(printf '%s\n' "$CONTAINERS" | wc -l | tr -d ' ')"
fi

echo "============================================="
echo "   VITALTRUST UPGRADE ALL INSTANCES"
echo "============================================="
echo "Project:     $ROOT"
echo "Image:       $IMAGE"
echo "Containers:  ${CONTAINER_COUNT:-0} found"
if [ -n "$CONTAINERS" ]; then
  printf '%s\n' "$CONTAINERS" | sed 's/^/  - /'
else
  echo "  (none — only the instructor container will be created if missing)"
fi
echo ""

if [ "$ASSUME_YES" -eq 0 ]; then
  echo "This will:"
  if [ "$SKIP_BUILD" -eq 0 ]; then
    echo "  1. Rebuild the Docker image ($IMAGE) from the current package"
  else
    echo "  1. Skip image rebuild (--no-build)"
  fi
  echo "  2. Remove and recreate every vitaltrust container listed above"
  echo "  3. Preserve each container's host port and per-user ~/.env (if present)"
  echo ""
  echo "Each recreated container starts with a fresh runtime filesystem"
  echo "(database and instance settings inside the old container are not kept)."
  echo ""
  printf "Continue? [y/N] "
  read -r reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *)
      echo "Upgrade cancelled."
      exit 0
      ;;
  esac
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "[1/3] Building Docker image $IMAGE ..."
  docker build -t "$IMAGE" -f "$DOCKERFILE" "$ROOT"
else
  echo "[1/3] Skipping image build (--no-build)"
  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    vt_fail "Image '$IMAGE' not found. Run without --no-build first."
  fi
fi

docker network create vitaltrust-net 2>/dev/null || true

echo "[2/3] Recreating VitalTrust containers ..."

if printf '%s\n' "$CONTAINERS" | grep -Fxq "vitaltrust-app"; then
  host_port="$(vt_host_port_for_container vitaltrust-app)"
  env_file=""
  if [ -f "$ROOT/.env" ]; then
    env_file="$ROOT/.env"
  elif [ -f "$ROOT/deployment/.env" ]; then
    env_file="$ROOT/deployment/.env"
  else
    env_file="$(vt_env_file_for_user ubuntu)"
  fi
  vt_recreate_container "vitaltrust-app" "$host_port" "$env_file"
fi

for name in $(vt_list_containers | sort); do
  [ -z "$name" ] && continue
  [ "$name" = "vitaltrust-app" ] && continue
  case "$name" in
    vitaltrust|vitaltrust-*)
      host_port="$(vt_host_port_for_container "$name")"
      linux_user="$(vt_linux_user_for_container "$name")"
      env_file=""
      if [ -n "$linux_user" ]; then
        env_file="$(vt_env_file_for_user "$linux_user")"
      fi
      vt_recreate_container "$name" "$host_port" "$env_file"
      ;;
  esac
done

# If no containers existed, create instructor instance only
if [ -z "$CONTAINERS" ]; then
  echo "[INFO] No existing containers — creating vitaltrust-app on port 3000 ..."
  env_file=""
  if [ -f "$ROOT/.env" ]; then
    env_file="$ROOT/.env"
  elif [ -f "$ROOT/deployment/.env" ]; then
    env_file="$ROOT/deployment/.env"
  else
    env_file="$(vt_env_file_for_user ubuntu)"
  fi
  vt_recreate_container "vitaltrust-app" "3000" "$env_file"
fi

echo "[3/3] Verifying versions ..."
sleep 2
echo ""
printf "%-22s %-8s %s\n" "CONTAINER" "PORT" "VERSION"
printf "%-22s %-8s %s\n" "----------------------" "--------" "-------"

vt_list_containers | sort | while read -r name; do
  [ -z "$name" ] && continue
  host_port="$(vt_host_port_for_container "$name")"
  version="$(vt_print_version_from_container "$name")"
  printf "%-22s %-8s %s\n" "$name" "$host_port" "$version"
done

echo ""
echo "[SUCCESS] Upgrade complete. All recreated containers use image: $IMAGE"
echo "Students who had no container yet can still run: vt-start"
