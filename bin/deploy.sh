#!/usr/bin/env bash
#
# Build, push and deploy access-control-ui (UI + API in one container) to Cloud Run.
# Follows the bapps-edp-services convention (bin/ script, `make … ENV=dev`).
#
# Usage:
#   bin/deploy.sh <env> <command> [--dry-run] [--allow-dirty] [--yes]
#
#   env       dev | stg | prod   (prd is accepted for prod)
#   command   build    build the image locally
#             push     build, then push it to Artifact Registry
#             deploy   build, push, then deploy it to the Cloud Run service
#
#   --dry-run      print every command instead of running it
#   --allow-dirty  build even with uncommitted changes (the tag gets a "-dirty" suffix)
#   --yes          don't ask before deploying to prod
#
# Settings for each environment live in deploy/env/<env>.env.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { echo "Error: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

usage() {
  sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

# ── Arguments ───────────────────────────────────────────────────────────────

ENV="${1:-}"
COMMAND="${2:-}"
[ -n "$ENV" ] && [ -n "$COMMAND" ] || usage
shift 2

DRY_RUN=false
ALLOW_DIRTY=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --allow-dirty) ALLOW_DIRTY=true ;;
    --yes) ASSUME_YES=true ;;
    -h|--help) usage 0 ;;
    *) die "Unknown option: $arg" ;;
  esac
done

case "$ENV" in
  dev|stg|prod) ;;
  prd) ENV=prod ;;
  *) die "Environment must be dev, stg or prod (got '$ENV')." ;;
esac
case "$COMMAND" in
  build|push|deploy) ;;
  *) die "Command must be build, push or deploy (got '$COMMAND')." ;;
esac

# Runs a command, or just prints it with --dry-run.
run() {
  if $DRY_RUN; then
    printf '  [dry-run]'; printf ' %q' "$@"; echo
  else
    "$@"
  fi
}

# ── Settings ────────────────────────────────────────────────────────────────

ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/deploy/env/$ENV.env}"
[ -f "$ENV_FILE" ] || die "Settings file not found: $ENV_FILE"
# shellcheck source=/dev/null
source "$ENV_FILE"

for name in PROJECT_ID PROJECT_NUMBER REGION REPO IMAGE_NAME SERVICE_NAME \
            SERVICE_ACCOUNT BQ_PROJECT BQ_DATASET; do
  value="${!name:-}"
  [ -n "$value" ] || die "$name is empty in $ENV_FILE."
  case "$value" in
    *FILL_ME*) die "Fill in $name in $ENV_FILE first (it still says $value)." ;;
  esac
done
ADMIN_EMAILS="${ADMIN_EMAILS:-}"

# ── Image tag: the git commit, so every deploy can be traced and rolled back ─

cd "$ROOT"
GIT_SHA="$(git rev-parse --short HEAD)"
TAG="$GIT_SHA"
if [ -n "$(git status --porcelain)" ]; then
  $ALLOW_DIRTY || die "You have uncommitted changes. Commit them first, or pass --allow-dirty."
  TAG="$GIT_SHA-dirty"
fi
# REPO may be just the repository name, or its full path (…-docker.pkg.dev/<project>/<repo>).
case "$REPO" in
  *-docker.pkg.dev/*) REGISTRY="${REPO%/}" ;;
  *) REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO" ;;
esac
IMAGE="$REGISTRY/$IMAGE_NAME:$TAG"
LATEST="$REGISTRY/$IMAGE_NAME:latest"

echo "Environment : $ENV  ($ENV_FILE)"
echo "Command     : $COMMAND$($DRY_RUN && echo '  (dry run — nothing will change)')"
echo "Image       : $IMAGE"
[ "$COMMAND" = deploy ] && echo "Service     : $SERVICE_NAME in $PROJECT_ID / $REGION"

# ── Checks before doing anything ────────────────────────────────────────────

if ! $DRY_RUN; then
  command -v docker >/dev/null || die "Docker isn't installed. See README → Run it with Docker."
  docker info >/dev/null 2>&1 || die "Docker isn't running. Open Docker Desktop and try again."
  if [ "$COMMAND" != build ]; then
    command -v gcloud >/dev/null || die "gcloud isn't installed. See README → Deploy to Google Cloud Run."
    [ -n "$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)" ] ||
      die "You're not logged in to gcloud. Run: gcloud auth login"
  fi
fi

if [ "$COMMAND" = deploy ] && [ "$ENV" = prod ] && ! $ASSUME_YES && ! $DRY_RUN; then
  read -r -p "Deploy $IMAGE to PRODUCTION? Type 'prod' to continue: " answer
  [ "$answer" = prod ] || die "Cancelled."
fi

# ── Build ───────────────────────────────────────────────────────────────────

step "Building the image (UI + API) for linux/amd64"
run docker buildx build --platform linux/amd64 \
  --label "org.opencontainers.image.revision=$GIT_SHA" \
  -t "$IMAGE" -t "$LATEST" --load .

[ "$COMMAND" = build ] && { echo; echo "$($DRY_RUN && echo 'Dry run finished.' || echo "Done. Built $IMAGE")"; exit 0; }

# ── Push ────────────────────────────────────────────────────────────────────

step "Letting Docker push to $REGION-docker.pkg.dev"
run gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

step "Pushing $IMAGE"
run docker push "$IMAGE"
run docker push "$LATEST"

[ "$COMMAND" = push ] && { echo; echo "$($DRY_RUN && echo 'Dry run finished.' || echo "Done. Pushed $IMAGE (also tagged latest)")"; exit 0; }

# ── Deploy ──────────────────────────────────────────────────────────────────

step "Filling in deploy/cloudrun/service.yaml"
TEMPLATE="$ROOT/deploy/cloudrun/service.yaml"
rendered="$(cat "$TEMPLATE")"
for name in ENV IMAGE SERVICE_NAME SERVICE_ACCOUNT PROJECT_NUMBER REGION \
            BQ_PROJECT BQ_DATASET ADMIN_EMAILS; do
  rendered="${rendered//\$\{$name\}/${!name}}"
done
case "$rendered" in
  *'${'*) die "service.yaml still has an unfilled \${...} placeholder." ;;
esac
SERVICE_FILE="$(mktemp -t access-control-ui-service).yaml"
trap 'rm -f "$SERVICE_FILE"' EXIT
printf '%s\n' "$rendered" > "$SERVICE_FILE"
$DRY_RUN && { echo "  Rendered service spec:"; sed 's/^/    /' "$SERVICE_FILE"; }

step "Deploying $SERVICE_NAME to Cloud Run"
run gcloud run services replace "$SERVICE_FILE" --region="$REGION" --project="$PROJECT_ID"

echo
if $DRY_RUN; then
  echo "Dry run finished. Nothing was built, pushed or deployed."
  exit 0
fi
echo "Done. $SERVICE_NAME is running $IMAGE"
url="$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" \
  --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)"
[ -z "$url" ] || echo "URL: $url"
