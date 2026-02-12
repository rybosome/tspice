#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cliPath = path.join(__dirname, '..', 'dist', 'cli.js');

if (!fs.existsSync(cliPath)) {
  console.error('tspice-repo-standards: run build first (missing dist/cli.js)');
  process.exit(2);
}

const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
