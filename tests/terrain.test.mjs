import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';

// 生成器只在制作期跑；优先用 DSH_PYTHON，否则在已知安装位置里找第一个存在的 Python。
const PY = process.env.DSH_PYTHON || [
  'C:\\ProgramData\\miniforge3\\python.exe',
  'C:\\Users\\lcf\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe',
].find(existsSync);
const run = out => execFileSync(PY, ['scripts/terrain-gen.py', '--out', out], {encoding: 'utf8'});
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');

test('a Python with Pillow and NumPy drives the terrain generator', () => {
  assert.ok(PY, 'set DSH_PYTHON to a Python that has Pillow and NumPy installed');
  execFileSync(PY, ['-c', 'import PIL, numpy'], {encoding: 'utf8'});
});

test('terrain detail textures are byte-identical across runs', () => {
  const a = 'src/assets/storybook/.terrain-a', b = 'src/assets/storybook/.terrain-b';
  run(a); run(b);
  for (const name of ['terrain-moss', 'terrain-crystal', 'terrain-spore', 'terrain-frost', 'terrain-water']) {
    assert.equal(sha(`${a}/${name}.png`), sha(`${b}/${name}.png`), `${name} is not reproducible`);
  }
  rmSync(a, {recursive: true, force: true}); rmSync(b, {recursive: true, force: true});
});

test('terrain tiles are square, 1024 and seamlessly tileable', () => {
  run('src/assets/storybook/.terrain-c');
  for (const name of ['terrain-moss', 'terrain-crystal', 'terrain-spore', 'terrain-frost', 'terrain-water']) {
    const buf = readFileSync(`src/assets/storybook/.terrain-c/${name}.png`);
    assert.equal(buf.toString('ascii', 1, 4), 'PNG');
    // IHDR 宽高位于字节 16..24
    assert.equal(buf.readUInt32BE(16), 1024); assert.equal(buf.readUInt32BE(20), 1024);
  }
  rmSync('src/assets/storybook/.terrain-c', {recursive: true, force: true});
});
