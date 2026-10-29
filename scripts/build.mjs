import { readFile, readdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
const art = JSON.parse(await readFile('src/assets/storybook/manifest.json','utf8'));
for (const [name,atlas] of Object.entries(art)) {
  if(atlas.frames.length) atlas.images = await Promise.all(atlas.frames.map(async (_,i)=>'data:image/webp;base64,'+(await readFile(`src/assets/storybook/${name}-${i}.webp`)).toString('base64')));
  else atlas.image = 'data:image/webp;base64,'+(await readFile(`src/assets/storybook/${name}.webp`)).toString('base64');
}
const bundle = await build({entryPoints:['src/world/index.ts'], bundle:true, write:false, format:'iife', globalName:'LivingWorld', target:'es2022', legalComments:'none', define:{__HOME_ART__:JSON.stringify(art)}});
const files=(await readdir('src/legacy')).filter(f=>f.endsWith('.js')).sort();
const legacy=(await Promise.all(files.map(f=>readFile('src/legacy/'+f,'utf8')))).join('\n');
const css=await readFile('src/world/home.css','utf8');
const html=(await readFile('src/shell.html','utf8')).replace('</head>',`<style>${css}</style>\n</head>`)
  .replace('<!-- WORLD_SCRIPT -->',()=>`<script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script>`)
  .replace('/* LEGACY_SCRIPT */',()=>legacy);
await writeFile('史莱姆.html',html);
console.log(`Built standalone 史莱姆.html (${Buffer.byteLength(html)} bytes)`);
