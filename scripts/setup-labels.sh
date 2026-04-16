#!/usr/bin/env bash
# scripts/setup-labels.sh
# Bulk-creates/updates all labels from .github/labels.yml via the GitHub REST API.
# Requires: gh CLI authenticated, GITHUB_REPOSITORY env var set.

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q '.nameWithOwner')}"
echo "Setting up labels for ${REPO}..."

python3 - <<'EOF'
import json
import subprocess
import sys
import os
import re

with open('.github/labels.yml', 'r') as f:
    content = f.read()

# Parse label blocks from the simple YAML structure
label_blocks = re.findall(
    r'- name: "([^"]+)"\n\s+color: "([^"]+)"\n\s+description: "([^"]+)"',
    content
)

repo = os.environ.get('GITHUB_REPOSITORY', '')
created = 0
updated = 0
errors = 0

for name, color, description in label_blocks:
    # Try to create
    result = subprocess.run([
        'gh', 'api', f'/repos/{repo}/labels',
        '--method', 'POST',
        '-f', f'name={name}',
        '-f', f'color={color}',
        '-f', f'description={description}'
    ], capture_output=True, text=True)

    if result.returncode == 0:
        print(f"  [created] {name}")
        created += 1
    elif '422' in result.stderr or '422' in result.stdout:
        # Label already exists — update it
        encoded = name.replace(' ', '%20').replace('/', '%2F')
        upd = subprocess.run([
            'gh', 'api', f'/repos/{repo}/labels/{encoded}',
            '--method', 'PATCH',
            '-f', f'color={color}',
            '-f', f'description={description}'
        ], capture_output=True, text=True)
        if upd.returncode == 0:
            print(f"  [updated] {name}")
            updated += 1
        else:
            print(f"  [error]   {name}: {upd.stderr.strip()}", file=sys.stderr)
            errors += 1
    else:
        print(f"  [error]   {name}: {result.stderr.strip()}", file=sys.stderr)
        errors += 1

print(f"\nDone: {created} created, {updated} updated, {errors} errors")
if errors > 0:
    sys.exit(1)
EOF
