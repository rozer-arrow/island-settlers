#!/usr/bin/env node
/* Builds island.html (one single file) from the parts under src/.
   The order of the parts is in src/manifest.json: a part is either a file path or {"text": "..."}.
   usage:
     node tools/build.js           write island.html
     node tools/build.js --check   do not write; exit 1 if island.html is not what the parts produce
     node tools/build.js --out X   write to X instead of island.html */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'manifest.json'), 'utf8'));

function build() {
  return manifest.parts.map(p => {
    if (typeof p === 'string') {
      const f = path.join(root, p);
      if (!fs.existsSync(f)) { console.error('missing part: ' + p); process.exit(2); }
      return fs.readFileSync(f, 'utf8');
    }
    if (typeof p.text === 'string') return p.text;
    console.error('bad manifest entry: ' + JSON.stringify(p)); process.exit(2);
  }).join('');
}

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const target = path.resolve(root, outIdx >= 0 ? args[outIdx + 1] : manifest.output);
const html = build();

if (args.includes('--check')) {
  const have = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (have === html) { console.log('BUILD OK: ' + path.relative(root, target) + ' matches src/ (' + Buffer.byteLength(html) + ' bytes)'); process.exit(0); }
  console.error('BUILD OUT OF DATE: ' + path.relative(root, target) + ' is not what src/ produces. Run: npm run build');
  process.exit(1);
}
fs.writeFileSync(target, html);
console.log('wrote ' + path.relative(root, target) + ' (' + Buffer.byteLength(html) + ' bytes, ' + manifest.parts.length + ' parts)');
