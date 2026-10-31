// Package the generated sheets; gameplay builds only need the checked-in WebP files.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
// --source 指向另一批图集的生成目录（默认沿用 2026-10-29 那批）。
const sourceAt = argv.indexOf('--source');
const source = sourceAt >= 0 ? argv.splice(sourceAt, 2)[1] : 'docs/art-2026-10-29/production';
const sharp = argv[0] ? require(resolve(argv[0], 'sharp')) : require('sharp');
const output = 'src/assets/storybook';
const layouts = JSON.parse(await readFile(`${source}/layouts.json`, 'utf8'));
const selected = argv.slice(1);
for (const name of selected) if (!layouts[name]) throw Error(`Unknown sheet: ${name}`);
await mkdir(output, {recursive:true});
const manifest = selected.length ? JSON.parse(await readFile(`${output}/manifest.json`, 'utf8')) : {};
for (const [name, layout] of Object.entries(layouts)) {
  if (selected.length && !selected.includes(name)) continue;
  const input = await readFile(`${source}/${name}.png`);
  const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width, height} = info;
  const frames = [];
  for (let i = 0; i < (layout.items?.length ?? 0); i++) {
    // grid 缺省为 4×4；新图集按 3×3 排列同一建筑的三个等级。
    const n = layout.grid ?? 4, col = i % n, row = Math.floor(i / n);
    const custom = layout.cells?.[i];
    const left = Math.round((custom?.[0] ?? layout.columns?.[col] ?? col/n) * width);
    const right = Math.round((custom?.[2] ?? layout.columns?.[col+1] ?? (col+1)/n) * width);
    const top = Math.round((custom?.[1] ?? layout.rows?.[row] ?? row/n) * height);
    const bottom = Math.round((custom?.[3] ?? layout.rows?.[row+1] ?? (row+1)/n) * height);
    let x1 = right, y1 = bottom, x2 = left, y2 = top;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      if (data[(y*width+x)*4+3] < 18) continue;
      x1 = Math.min(x1,x); y1 = Math.min(y1,y); x2 = Math.max(x2,x); y2 = Math.max(y2,y);
    }
    if (x1 > x2 || y1 > y2) throw Error(`Empty sprite: ${name}/${i}`);
    x1 = Math.max(left,x1-2); y1 = Math.max(top,y1-2);
    x2 = Math.min(right-1,x2+2); y2 = Math.min(bottom-1,y2+2);
    frames.push([x1,y1,x2-x1+1,y2-y1+1]);
  }
  await sharp(input).webp({quality:88,alphaQuality:100,effort:5}).toFile(`${output}/${name}.webp`);
  await Promise.all(frames.map(([left,top,width,height],i)=>sharp(input).extract({left,top,width,height}).webp({quality:88,alphaQuality:100,effort:5}).toFile(`${output}/${name}-${i}.webp`)));
  manifest[name] = {width,height,frames};
  console.log(`${name}: ${width}x${height}, ${frames.length} sprites`);
}
await writeFile(`${output}/manifest.json`, JSON.stringify(manifest,null,2)+'\n');
