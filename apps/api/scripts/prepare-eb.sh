#!/usr/bin/env bash
set -euo pipefail

echo "=== Setting up staging directory ==="
mkdir -p eb-staging/node_modules/@app

# Pre-populate workspace packages directly from their built dist/.
# This sidesteps npm needing to resolve workspace:* protocol entirely.

echo "Copying @app/shared..."
mkdir -p eb-staging/node_modules/@app/shared
cp -r packages/shared/dist eb-staging/node_modules/@app/shared/
python3 - <<'PYEOF'
import json
with open('packages/shared/package.json') as f:
    pkg = json.load(f)
pkg.pop('devDependencies', None)
# Strip any workspace:* refs from shared's own deps (shouldn't have any, but be safe)
for dep in list(pkg.get('dependencies', {}).keys()):
    if pkg['dependencies'][dep].startswith('workspace:'):
        del pkg['dependencies'][dep]
with open('eb-staging/node_modules/@app/shared/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
print('  package.json written')
PYEOF

echo "Copying @app/content..."
mkdir -p eb-staging/node_modules/@app/content
cp -r packages/content/dist eb-staging/node_modules/@app/content/
python3 - <<'PYEOF'
import json
with open('packages/content/package.json') as f:
    pkg = json.load(f)
pkg.pop('devDependencies', None)
# Strip workspace:* refs (@app/shared dep uses workspace:* — npm can't resolve this)
for dep in list(pkg.get('dependencies', {}).keys()):
    if pkg['dependencies'][dep].startswith('workspace:'):
        del pkg['dependencies'][dep]
with open('eb-staging/node_modules/@app/content/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
print('  package.json written')
PYEOF

echo "Copying API build output..."
cp -r apps/api/dist eb-staging/
cp apps/api/Procfile eb-staging/
cp -r apps/api/.ebextensions eb-staging/

echo "=== Generating package.json ==="
python3 - <<'PYEOF'
import json
with open('apps/api/package.json') as f:
    pkg = json.load(f)
# Remove workspace packages — already placed in node_modules above
pkg['dependencies'].pop('@app/shared', None)
pkg['dependencies'].pop('@app/content', None)
pkg.pop('devDependencies', None)
# Ensure Node.js treats output as CommonJS (tsc compiles to CJS)
pkg.pop('type', None)
with open('eb-staging/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
print('External deps to install:', list(pkg.get('dependencies', {}).keys()))
PYEOF

echo "=== Installing production dependencies ==="
cd eb-staging
npm install --omit=dev
cd ..

echo "=== Done. eb-staging/ is ready for deployment. ==="
