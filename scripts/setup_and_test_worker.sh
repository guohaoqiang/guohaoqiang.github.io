#!/usr/bin/env bash
set -euo pipefail

# One-shot helper: validate files, set ORIGIN and PUBLIC_KEY via Wrangler v3 (npx),
# generate a short-lived token using scripts/make_jwt.py (if available), then curl the
# deployed worker endpoint to verify access.
#
# Usage: ./scripts/setup_and_test_worker.sh <WORKER_URL>
# Example: ./scripts/setup_and_test_worker.sh https://admin-proxy.9ohnny.workers.dev

WORKER_URL="${1:-}"
if [[ -z "$WORKER_URL" ]]; then
  echo "Usage: $0 <WORKER_URL>"
  echo "Example: $0 https://admin-proxy.9ohnny.workers.dev"
  exit 2
fi

echo "Using worker URL: $WORKER_URL"

# Read ORIGIN from repo ORIGIN file if present, stripping code fences if any
ORIGIN_FILE="ORIGIN"
if [[ -f "$ORIGIN_FILE" ]]; then
  ORIGIN_RAW=$(sed -n '1,200p' "$ORIGIN_FILE")
  # strip markdown code fences and whitespace
  ORIGIN=$(printf '%s' "$ORIGIN_RAW" | sed -E 's/^```.*$//g' | sed -E 's/^\s+|\s+$//g' | sed '/^$/d' | head -n1)
else
  ORIGIN="guohaoqiang.github.io"
fi

if [[ -z "$ORIGIN" ]]; then
  echo "Could not determine ORIGIN. Please set ORIGIN in the ORIGIN file or pass it as env." >&2
  exit 3
fi

echo "ORIGIN will be set to: $ORIGIN"

# Ensure public.pem exists; if not, try to create from private.pem
if [[ ! -f public.pem ]]; then
  if [[ -f private.pem ]]; then
    echo "public.pem not found but private.pem exists. Generating public.pem..."
    openssl rsa -in private.pem -pubout -out public.pem
  else
    echo "public.pem not found. Please create public.pem (PEM public key) or place private.pem in the repo." >&2
    exit 4
  fi
fi

# Basic sanity check of public.pem header
if ! head -n1 public.pem | grep -q "BEGIN PUBLIC KEY"; then
  echo "public.pem does not look like a PEM public key (missing BEGIN PUBLIC KEY)" >&2
  exit 5
fi

echo "Setting ORIGIN secret via wrangler (npx wrangler@3)..."
printf '%s' "$ORIGIN" | npx wrangler@3 secret put ORIGIN

echo "Uploading PUBLIC_KEY from public.pem..."
cat public.pem | npx wrangler@3 secret put PUBLIC_KEY

echo "Listing secrets for verification:"
npx wrangler@3 secret list || true

# Generate a short-lived token using scripts/make_jwt.py if possible
TOKEN=""
if [[ -x scripts/make_jwt.py || -f scripts/make_jwt.py ]]; then
  if [[ -f private.pem ]]; then
    echo "Generating short-lived JWT (300s) using scripts/make_jwt.py..."
    TOKEN=$(python3 scripts/make_jwt.py --private private.pem --exp 300)
    echo "Token generated (truncated): ${TOKEN:0:40}..."
  else
    echo "private.pem not found; cannot generate test JWT. Skipping token generation." >&2
  fi
else
  echo "scripts/make_jwt.py not found; skipping token generation." >&2
fi

if [[ -z "$TOKEN" ]]; then
  echo "No token available — you can still test by providing a token yourself. Exiting with status 0." 
  exit 0
fi

echo "Testing worker endpoint with generated token..."
curl -v -i -H "Authorization: Bearer $TOKEN" "$WORKER_URL/admin.html"

echo "Done. If the response is 200 with admin HTML, the worker is configured correctly."
