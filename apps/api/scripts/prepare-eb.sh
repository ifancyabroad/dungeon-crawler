#!/usr/bin/env bash
set -euo pipefail

echo "=== Packing workspace packages ==="
mkdir -p /tmp/packs
(cd packages/shared && npm pack --pack-destination /tmp/packs)
(cd packages/content && npm pack --pack-destination /tmp/packs)
echo "Tarballs created:"
ls -la /tmp/packs/

SHARED_TGZ=$(basename "$(ls /tmp/packs/app-shared-*.tgz)")
CONTENT_TGZ=$(basename "$(ls /tmp/packs/app-content-*.tgz)")
echo "shared: $SHARED_TGZ"
echo "content: $CONTENT_TGZ"

echo "=== Setting up staging directory ==="
mkdir -p eb-staging
cp -r apps/api/dist eb-staging/
cp apps/api/Procfile eb-staging/
cp -r apps/api/.ebextensions eb-staging/
cp /tmp/packs/*.tgz eb-staging/

echo "=== Generating package.json ==="
python3 - <<PYEOF
import json, os, sys

with open('apps/api/package.json') as f:
    pkg = json.load(f)

tarballs = os.listdir('/tmp/packs')
shared_tgz = next((t for t in tarballs if t.startswith('app-shared-')), None)
content_tgz = next((t for t in tarballs if t.startswith('app-content-')), None)

if not shared_tgz:
    sys.exit('ERROR: could not find app-shared tarball in /tmp/packs')
if not content_tgz:
    sys.exit('ERROR: could not find app-content tarball in /tmp/packs')

pkg['dependencies']['@app/shared'] = 'file:./' + shared_tgz
pkg['dependencies']['@app/content'] = 'file:./' + content_tgz
pkg.pop('devDependencies', None)

with open('eb-staging/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)

print('Generated eb-staging/package.json with:')
print('  @app/shared  ->', pkg['dependencies']['@app/shared'])
print('  @app/content ->', pkg['dependencies']['@app/content'])
PYEOF

echo "=== Installing production dependencies ==="
cd eb-staging
npm install --omit=dev
cd ..

echo "=== Zipping for Elastic Beanstalk ==="
cd eb-staging && zip -r ../api-bundle.zip . && cd ..
echo "Done. api-bundle.zip created."
