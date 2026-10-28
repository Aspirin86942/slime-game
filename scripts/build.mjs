import { readFile, readdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
const bundle = await build({entryPoints:['src/world/index.ts'], bundle:true, write:false, format:'iife', globalName:'LivingWorld', target:'es2022', legalComments:'none'});
const files=(await readdir('src/legacy')).filter(f=>f.endsWith('.js')).sort();
const legacy=(await Promise.all(files.map(f=>readFile('src/legacy/'+f,'utf8')))).join('\n');
const css=await readFile('src/world/home.css','utf8');
const html=(await readFile('src/shell.html','utf8')).replace('</head>',`<style>${css}</style>\n</head>`)
  .replace('<!-- WORLD_SCRIPT -->',()=>`<script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script>`)
  .replace('/* LEGACY_SCRIPT */',()=>legacy);
await writeFile('史莱姆.html',html);
console.log(`Built standalone 史莱姆.html (${Buffer.byteLength(html)} bytes)`);
