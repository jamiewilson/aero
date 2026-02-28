#!/usr/bin/env node
/**
 * Publish all packages to npm. Temporarily pins @aerobuilt/template-minimal
 * in create-aerobuilt to ^<version> (from packages/core) so the published
 * manifest works for naive npm; restores workspace:* after publish (success or failure).
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();
const depRe = /"@aerobuilt\/template-minimal":\s*"[^"]*"/;

const createAerobuiltPaths = [
  'packages/create-aerobuilt/package.json',
  'packages/create-aerobuilt/package/package.json',
];

function getVersion() {
  const path = join(root, 'packages/core/package.json');
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  return pkg.version;
}

function pin(version) {
  const saved = [];
  for (const rel of createAerobuiltPaths) {
    const path = join(root, rel);
    const content = readFileSync(path, 'utf8');
    saved.push({ path, content });
    const updated = content.replace(depRe, `"@aerobuilt/template-minimal": "^${version}"`);
    writeFileSync(path, updated);
  }
  return saved;
}

function restore(saved) {
  for (const { path, content } of saved) {
    writeFileSync(path, content);
  }
}

const version = getVersion();
console.log(`Pinning @aerobuilt/template-minimal to ^${version} for publish...`);
const saved = pin(version);
try {
  const result = spawnSync('pnpm', ['-r', 'publish', '--access', 'public'], {
    stdio: 'inherit',
    cwd: root,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  restore(saved);
  console.log('Restored @aerobuilt/template-minimal to workspace:*');
}
