#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 20 or newer from https://nodejs.org, then run this script again."
  exit 1
fi

if ! node -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)'; then
  echo "Node.js 20 or newer is required. Update Node.js, then run this script again."
  exit 1
fi

if [ ! -f node_modules/ws/package.json ]; then
  npm install
fi

echo "Starting SEMAG on this PC..."
npm start
