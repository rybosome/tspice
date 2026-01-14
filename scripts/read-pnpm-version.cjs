const fs = require('node:fs');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const pm = pkg.packageManager;

if (typeof pm !== 'string') {
  throw new Error('package.json#packageManager must be a string');
}

const m = pm.match(new RegExp('^pnpm@([^\s]+)$'));
if (!m) {
  throw new Error(
    `Expected packageManager to look like "pnpm@<version>", got: ${JSON.stringify(pm)}`
  );
}

process.stdout.write(m[1]);
