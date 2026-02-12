#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1:-../tbd}"
PACKAGE_PREFIX="packages/tbd"
SPLIT_BRANCH="tbd-history"

cd "$ROOT_DIR"

git subtree split --prefix="$PACKAGE_PREFIX" -b "$SPLIT_BRANCH"
git worktree add "$TARGET_DIR" "$SPLIT_BRANCH"

echo "Created standalone framework repo worktree at: $TARGET_DIR"
echo "You can now 'cd $TARGET_DIR' and continue as an independent repository."
