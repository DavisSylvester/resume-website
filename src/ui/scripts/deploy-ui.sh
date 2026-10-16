#!/bin/sh
# Builds the Angular site and publishes it to both CloudFront sites
# (www.dsylvester.io and www.dsylvester.ai).
#
#   sh src/ui/scripts/deploy-ui.sh            # from the repo root
#
# Hashed assets are cached for a year; index.html is never cached so new
# deploys show up immediately. Old hashed files are left in place (harmless).
set -eu

# Git Bash on Windows rewrites arguments like "/index.html" into Windows paths,
# which CloudFront rejects as invalid invalidation paths. Turn that off.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

PROFILE="${AWS_PROFILE:-dsylvesteriii}"
# `pwd -W` gives a Windows path under Git Bash (needed with path conversion off); elsewhere use pwd.
UI_DIR="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))"
OUT="$UI_DIR/dist/davis-resume/browser"

# bucket:distribution pairs
SITES="davis-resume-spa:EJ2FDYIEIWV34 davis-resume-spa2:E3LZODQSO3JZTE"

ACCOUNT="$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)"
if [ "$ACCOUNT" != "318205107378" ]; then
  echo "Refusing to deploy: profile $PROFILE resolves to account $ACCOUNT, expected 318205107378." >&2
  exit 1
fi

# SKIP_BUILD=1 reuses an existing dist/ (e.g. to retry an upload).
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  (cd "$UI_DIR" && bun run build)
fi
[ -f "$OUT/index.html" ] || { echo "No build at $OUT" >&2; exit 1; }

for site in $SITES; do
  bucket="${site%%:*}"
  dist="${site##*:}"
  echo "==> s3://$bucket"
  aws s3 sync "$OUT" "s3://$bucket" --profile "$PROFILE" \
    --exclude index.html --cache-control "public, max-age=31536000, immutable" \
    --exclude "data/*"
  aws s3 sync "$OUT/data" "s3://$bucket/data" --profile "$PROFILE" --cache-control "public, max-age=300"
  aws s3 cp "$OUT/index.html" "s3://$bucket/index.html" --profile "$PROFILE" \
    --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html"
  aws cloudfront create-invalidation --distribution-id "$dist" --paths "/index.html" "/" \
    --profile "$PROFILE" --query "Invalidation.Id" --output text
done

echo "Done: https://www.dsylvester.io/activity"
