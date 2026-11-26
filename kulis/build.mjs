// esbuild -> single self-contained dist/kulis.html (CSS + JS inlined, works from file://).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const r = (...p) => resolve(root, ...p);
const html = readFileSync(r('index.html'), 'utf8');

// Engine may not exist yet: alias it to a stub that throws on import (store.init() catches it).
const engineStub = {
  name: 'engine-stub',
  setup(b) {
    if (existsSync(r('src/engine/game.js'))) return;
    console.warn('! src/engine/game.js not found — bundling a stub (game will boot into the gallery).');
    b.onResolve({ filter: /engine\/game\.js$/ }, () => ({ path: 'engine-stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'throw new Error("engine missing");', loader: 'js' }));
  },
};

const out = await build({
  entryPoints: [r('src/ui/main.js')], bundle: true, write: false, format: 'iife', minify: true, target: 'es2020', legalComments: 'none', plugins: [engineStub],
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const cssFiles = [...html.matchAll(/<link rel="stylesheet" href="(src\/[^"]+\.css)">/g)].map((m) => m[1]);
const css = cssFiles.map((f) => readFileSync(r(f), 'utf8')).join('\n');
const cssMin = (await build({ stdin: { contents: css, loader: 'css' }, write: false, minify: true, loader: { '.css': 'css' } })).outputFiles[0].text;

let page = html
  .replace(/<link rel="stylesheet" href="src\/[^"]+\.css">\n?/g, '')
  .replace('</head>', `<style>${cssMin}</style>\n</head>`)
  .replace(/<script type="module" src="src\/ui\/main\.js"><\/script>/, () => `<script>${js}</script>`);
mkdirSync(r('dist'), { recursive: true });
writeFileSync(r('dist/kulis.html'), page);
console.log(`dist/kulis.html  ${(page.length / 1024).toFixed(1)} KB  (${cssFiles.length} css files)`);
