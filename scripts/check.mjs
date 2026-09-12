import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['js/portfolio.js','js/stadium.js','scripts/serve.mjs','scripts/browser-check.mjs']) {
  const check = spawnSync(process.execPath, ['--check',resolve(root,file)], { encoding:'utf8' });
  assert.equal(check.status,0,file+': '+check.stderr);
}
const html = await readFile(resolve(root,'index.html'),'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
assert.equal((html.match(/<h1\b/g)||[]).length,1,'Expected one h1');
for (const [,value] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  if (value.startsWith('#')) assert(ids.includes(value.slice(1)),'Missing fragment '+value);
  else if (!/^(?:https?:|mailto:|data:)/.test(value)) assert((await stat(resolve(root,value))).isFile(),'Missing local asset '+value);
}
for (const [,body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(body);
const packageData = JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const lockData = JSON.parse(await readFile(resolve(root,'package-lock.json'),'utf8'));
assert.equal(packageData.name,lockData.name);
assert.equal(packageData.version,lockData.version);
assert.equal(Object.keys(packageData.dependencies||{}).length,0);
console.log('PASS: JavaScript syntax, local assets, section links, unique IDs, heading, structured data, package metadata.');
