#!/usr/bin/env bash
# Idempotent dependency setup for the Gemel Invest CRM dev environment.
# The repository is a static (GitHub Pages) front-end with no package.json;
# its Node test scripts (_test-*.js) and Python form audits need a couple of
# extra libraries available on the module search path.
set -euo pipefail

# --- pdf-lib (Node) -----------------------------------------------------------
# Several form-fill test scripts do `require("pdf-lib")`. Install it into a
# user-writable global prefix and expose it on Node's home module path so
# `require("pdf-lib")` resolves from any directory without setting NODE_PATH.
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
npm install -g pdf-lib@1.17.1

mkdir -p "$HOME/.node_modules"
ln -sfn "$HOME/.npm-global/lib/node_modules/pdf-lib" "$HOME/.node_modules/pdf-lib"

# --- pypdf (Python) -----------------------------------------------------------
# Used by the Python-based form-audit test(s).
python3 -m pip install --user --quiet --upgrade pypdf

echo "install.sh: dependencies ready"
