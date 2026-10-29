// Package the generated sheets; gameplay builds only need the checked-in WebP files.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url);
const sharp = process.argv[2] ? require(resolve(process.argv[2], 'sharp')) : require('sharp');
const source = 'docs/art-2026-10-29/production';
const output = 'src/assets/storybook';
const layouts = JSON.parse(await readFile(`${source}/layouts.json`, 'utf8'));
await mkdir(output, {recursive:true});
const manifest = {};
for (const [name, layout] of Object.entries(layouts)) {
  const input = await readFile(`${source}/${name}.png`);
  const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width, height} = info;
  const frames = [];
  for (let i = 0; i < (layout.items?.length ?? 0); i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const custom = layout.cells?.[i];
    const left = Math.round((custom?.[0] ?? layout.columns?.[col] ?? col/4) * width);
    const right = Math.round((custom?.[2] ?? layout.columns?.[col+1] ?? (col+1)/4) * width);
    const top = Math.round((custom?.[1] ?? layout.rows?.[row] ?? row/4) * height);
    const bottom = Math.round((custom?.[3] ?? layout.rows?.[row+1] ?? (row+1)/4) * height);
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
