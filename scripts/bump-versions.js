#!/usr/bin/env node
/**
 * Bump version in all published packages (lockstep).
 * Usage: node scripts/bump-versions.js <newVersion>
 * Example: node scripts/bump-versions.js 0.2.2
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const newVersion = process.argv[2];

if (!newVersion || !/^\d+\.\d+\.\d+(-[a-z0-9.-]+)?$/i.test(newVersion)) {
  console.error('Usage: node scripts/bump-versions.js <newVersion>');
  console.error('Example: node scripts/bump-versions.js 0.2.2');
  process.exit(1);
}

const packagePaths = [
  'packages/core/package.json',
  'packages/interpolation/package.json',
  'packages/config/package.json',
  'packages/content/package.json',
  'packages/aerobuilt/package.json',
  'packages/create-aerobuilt/package.json',
  'packages/create-aerobuilt/package/package.json',
  'packages/templates/minimal/package.json',
  'packages/aero-vscode/package.json',
];

for (const rel of packagePaths) {
  const path = join(root, rel);
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`Could not read ${rel}:`, err.message);
    process.exit(1);
  }
  if (!content.includes('"version":')) {
    console.error(`${rel}: no "version" field, skipping`);
    continue;
  }
  const updated = content.replace(
    /^(\s*"version":\s*)"[^"]*"/m,
    `$1"${newVersion}"`
  );
  if (updated === content) {
    console.error(`${rel}: version pattern not found`);
    process.exit(1);
  }
  writeFileSync(path, updated);
  console.log(`Updated ${rel} -> ${newVersion}`);
}

console.log(`\nBumped ${packagePaths.length} packages to ${newVersion}`);
