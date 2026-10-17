const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.cloudflare', 'site');
// Replace only the fixed generated directory; never publish the repo root.
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const assets = ['index.html', 'css', 'js', 'data', 'generate_weights.py', 'THIRD_PARTY_NOTICES.md'];
for (const asset of assets) {
  fs.cpSync(path.join(root, asset), path.join(output, asset), { recursive: true });
}
console.log('Prepared website assets in .cloudflare/site');
