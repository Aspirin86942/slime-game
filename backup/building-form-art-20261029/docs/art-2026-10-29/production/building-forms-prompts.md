# 设施升级形态 · 生图提示词

三张图集，每张 4×4 共 16 格，放 8 座设施的 2 级、3 级形态。

## 生成方法

1. 每次生成一张。把下面对应的整段英文提示词粘贴给生图工具（ChatGPT / Codex 等）。
2. 同时上传 `facilities-a.png` 和 `facilities-b.png` 作参考图，让新形态和原建筑保持同一画风、同一配色。
3. 要求输出**正方形透明背景 PNG**，至少 2048×2048。
4. 按标题里的文件名保存到本目录 `docs/art-2026-10-29/production/`。
5. 检查：16 个物件各在一格，没有跨格、没有文字、背景透明。不合格就重新生成这一张。

每格的位置固定，代码按位置取图，所以顺序不能改。

## facilities-c.png

设施：house、kitchen、table、spa、bed、greenhouse、pollen、seedbank

```text
Production assets for an existing Chinese cozy slime homestead game. Match the reference EXACTLY: painterly gouache storybook, warm cream plaster, terracotta tiles, honey timber, moss/fern green foliage, muted teal water, amber lantern glow. Polished dimensional hand-painted sprites, visible fine brush texture, no black outlines. Elevated front-facing orthographic view with screen-aligned bases, no diamond isometric projection. Light from upper left, gentle contact shadow. No terrain pedestals and no mini-scenes around an object. Each silhouette isolated and completely visible. This is a sprite atlas for real interactive gameplay.
Make ONE SQUARE transparent PNG sprite atlas: EXACTLY FOUR ROWS and FOUR COLUMNS, 16 cells of identical dimensions. Every object centered in its own cell; leave at least 15% transparent padding on ALL four sides of each cell. This regular arrangement is crucial: row boundaries at exactly 25%,50%,75% of image height, column boundaries at 25%,50%,75% of width. No object crosses its cell. All objects fit inside cells without clipping. No letters, numbers, labels, gridlines, watermark, frames or backgrounds. True alpha transparency, clean antialiased silhouettes, no colored fringing. Objects fill roughly 65%-75% of their own cell. Front faces point straight at viewer, bases horizontal. Do not rotate individual objects diagonally. Cells come in PAIRS of the SAME building, matching the attached reference sprite of that building: the LEFT cell of each pair is the level 2 expanded form, the RIGHT cell is the level 3 grand form. Keep each building recognisable across both forms: same main colors, materials and signature shape. Level 2 is bigger and better crafted (extra wing or annex, stone footing, carved eaves, flower boxes, lanterns). Level 3 is the most magnificent (second storey or tower, gilded trim, stained glass, banners, a softly glowing elemental crystal) yet stays in the same warm gouache storybook style, never sci-fi or neon. Each line states the silhouette proportion; follow it, because the sprite is fitted into a larger map plot without stretching. Render these exact objects in reading order, left to right row by row:
1. house level 2: the same cream cottage expanded: a side wing with a second terracotta roof, small timber porch with two lanterns, flower boxes under two warm windows, stone chimney. About as wide as tall
2. house level 3: grand two-storey storybook manor version of the same cottage: cream plaster upper floor with honey timber framing, terracotta roofs with one small round turret, gilded trim on the eaves, an arched stained-glass window, climbing roses, warm glowing windows. Somewhat taller than wide
3. kitchen level 2: the same outdoor kitchen enlarged into a timber cookhouse: the cream canvas awning becomes a shingled half-roof, brick stove with chimney, hanging copper pans, herb strings, prep counter. Somewhat taller than wide
4. kitchen level 3: festive feast kitchen pavilion: carved timber frame, terracotta roof, two stone ovens glowing amber, long counter with pies and bread, string of warm lanterns, small gilded weathervane. About as wide as tall
5. table level 2: longer wooden dining table for four with two long benches, linen runner, small vase of flowers, two little lanterns. Clearly wider than tall
6. table level 3: elegant garden banquet table under a carved timber pergola with climbing flowers and hanging lanterns, gilded chair backs, cake stand and teapots. About as wide as tall
7. spa level 2: larger natural stone hot spring with two connected teal pools, wooden deck edge, bamboo water spout, small bench with folded towels, soft steam kept inside the cell. About as wide as tall
8. spa level 3: luxurious hot spring retreat: terraced stone pools, a small timber bathhouse with terracotta roof and paper lanterns, softly glowing turquoise crystals at the edge, gentle steam inside the cell. Somewhat taller than wide
9. bed level 2: wider raised wooden seedbed with three rows of sprouting seedlings, little picket border, watering can, plain wooden marker posts WITHOUT text. Clearly wider than tall
10. bed level 3: grand tiered garden bed: two levels of timber planters with lush seedlings and blossoms, small arched trellis with lanterns, tiny dew-collecting glass bulbs glowing softly. About as wide as tall
11. greenhouse level 2: the same timber glass greenhouse widened with a side wing, moss green pitched roofs, potted plants visible inside, small door with brass handle. About as wide as tall
12. greenhouse level 3: grand storybook conservatory: domed glass roof with moss green ribs and a gilded finial, two glass wings, hanging ferns, warm glowing interior. Somewhat taller than wide
13. pollen level 2: larger pollination shelter: timber frame with small shingled roof, five hanging flower baskets, one wooden beehive box, two butterflies. Somewhat taller than wide
14. pollen level 3: ornate flower pavilion: carved arched timber gazebo with terracotta roof, cascading flower baskets, two beehives, softly glowing pollen motes, gilded trim. About as wide as tall
15. seedbank level 2: wider timber seed cabinet: two columns of small drawers WITHOUT text, little roof with carved brackets, seed jars on top, small ladder. Somewhat taller than wide
16. seedbank level 3: tall seed library tower: narrow two-storey timber tower with terracotta roof, many tiny drawers WITHOUT text, round window, brass lantern, small balcony with seed jars. Clearly taller than wide
```

## facilities-d.png

设施：grove、compost、insects、observe、channel、pond、filter、waterbed

```text
Production assets for an existing Chinese cozy slime homestead game. Match the reference EXACTLY: painterly gouache storybook, warm cream plaster, terracotta tiles, honey timber, moss/fern green foliage, muted teal water, amber lantern glow. Polished dimensional hand-painted sprites, visible fine brush texture, no black outlines. Elevated front-facing orthographic view with screen-aligned bases, no diamond isometric projection. Light from upper left, gentle contact shadow. No terrain pedestals and no mini-scenes around an object. Each silhouette isolated and completely visible. This is a sprite atlas for real interactive gameplay.
Make ONE SQUARE transparent PNG sprite atlas: EXACTLY FOUR ROWS and FOUR COLUMNS, 16 cells of identical dimensions. Every object centered in its own cell; leave at least 15% transparent padding on ALL four sides of each cell. This regular arrangement is crucial: row boundaries at exactly 25%,50%,75% of image height, column boundaries at 25%,50%,75% of width. No object crosses its cell. All objects fit inside cells without clipping. No letters, numbers, labels, gridlines, watermark, frames or backgrounds. True alpha transparency, clean antialiased silhouettes, no colored fringing. Objects fill roughly 65%-75% of their own cell. Front faces point straight at viewer, bases horizontal. Do not rotate individual objects diagonally. Cells come in PAIRS of the SAME building, matching the attached reference sprite of that building: the LEFT cell of each pair is the level 2 expanded form, the RIGHT cell is the level 3 grand form. Keep each building recognisable across both forms: same main colors, materials and signature shape. Level 2 is bigger and better crafted (extra wing or annex, stone footing, carved eaves, flower boxes, lanterns). Level 3 is the most magnificent (second storey or tower, gilded trim, stained glass, banners, a softly glowing elemental crystal) yet stays in the same warm gouache storybook style, never sci-fi or neon. Each line states the silhouette proportion; follow it, because the sprite is fitted into a larger map plot without stretching. Render these exact objects in reading order, left to right row by row:
1. grove level 2: nursery grove of five young leafy trees in a wooden border, stacked log pile, small chopping stump. About as wide as tall
2. grove level 3: majestic grove: one great old broadleaf tree with a small treehouse platform and rope ladder, surrounded by saplings and log stacks, hanging lanterns. Somewhat taller than wide
3. compost level 2: double timber compost bins with hinged lids, a pile of fallen leaves, small shovel. About as wide as tall
4. compost level 3: tidy compost station: three timber bins under a small shingled roof, mushroom clusters, wheelbarrow of rich dark soil, a few glowing fireflies. Somewhat taller than wide
5. insects level 2: taller two-storey insect hotel with bamboo, pinecone and log sections and a tiny terracotta roof. Narrow, clearly taller than wide
6. insects level 3: grand insect sanctuary: wide insect hotel with three gabled terracotta roofs, flower boxes, bee and butterfly visitors, small gilded weathervane. Somewhat taller than wide
7. observe level 2: raised timber lookout platform with railing, binoculars on a tripod, field notebook, small canvas shade. Somewhat taller than wide
8. observe level 3: observation tower: two-level timber tower with an outside stair, brass spyglass, small banner flag, map table, terracotta roof. Clearly taller than wide
9. channel level 2: longer narrow stone-lined water channel receding upward in the elevated view, two bamboo spouts, tiny wooden footbridge. Narrow, clearly taller than wide
10. channel level 3: two parallel stone water channels joined by a small stone arch, a little wooden water wheel, moss and ferns. Somewhat taller than wide
11. pond level 2: larger natural teal pond with stepping stones, lily pads, reeds and a small wooden dock. About as wide as tall
12. pond level 3: grand lotus pond: wide teal pond with a curved wooden bridge, blooming lotuses, a little stone lantern, a few glowing fireflies. Somewhat taller than wide
13. filter level 2: three cascading stone water-filter basins with mossy rims connected by bamboo spouts. Somewhat taller than wide
14. filter level 3: ornate purification fountain: tiered carved stone basins with a softly glowing turquoise crystal at the top, water cascading. Clearly taller than wide
15. waterbed level 2: longer raised wood aquatic planter with two lotuses and water lilies, small wooden steps. Clearly wider than tall
16. waterbed level 3: elegant water garden: two-tier wooden aquatic planters with lotus and iris blooms, small bamboo fountain, floating lanterns. About as wide as tall
```

## facilities-e.png

设施：woodshop、alchemy、training、archive、stars、memorial、trough、toys

```text
Production assets for an existing Chinese cozy slime homestead game. Match the reference EXACTLY: painterly gouache storybook, warm cream plaster, terracotta tiles, honey timber, moss/fern green foliage, muted teal water, amber lantern glow. Polished dimensional hand-painted sprites, visible fine brush texture, no black outlines. Elevated front-facing orthographic view with screen-aligned bases, no diamond isometric projection. Light from upper left, gentle contact shadow. No terrain pedestals and no mini-scenes around an object. Each silhouette isolated and completely visible. This is a sprite atlas for real interactive gameplay.
Make ONE SQUARE transparent PNG sprite atlas: EXACTLY FOUR ROWS and FOUR COLUMNS, 16 cells of identical dimensions. Every object centered in its own cell; leave at least 15% transparent padding on ALL four sides of each cell. This regular arrangement is crucial: row boundaries at exactly 25%,50%,75% of image height, column boundaries at 25%,50%,75% of width. No object crosses its cell. All objects fit inside cells without clipping. No letters, numbers, labels, gridlines, watermark, frames or backgrounds. True alpha transparency, clean antialiased silhouettes, no colored fringing. Objects fill roughly 65%-75% of their own cell. Front faces point straight at viewer, bases horizontal. Do not rotate individual objects diagonally. Cells come in PAIRS of the SAME building, matching the attached reference sprite of that building: the LEFT cell of each pair is the level 2 expanded form, the RIGHT cell is the level 3 grand form. Keep each building recognisable across both forms: same main colors, materials and signature shape. Level 2 is bigger and better crafted (extra wing or annex, stone footing, carved eaves, flower boxes, lanterns). Level 3 is the most magnificent (second storey or tower, gilded trim, stained glass, banners, a softly glowing elemental crystal) yet stays in the same warm gouache storybook style, never sci-fi or neon. Each line states the silhouette proportion; follow it, because the sprite is fitted into a larger map plot without stretching. Render these exact objects in reading order, left to right row by row:
1. woodshop level 2: covered carpenter workshop: workbench under a shingled lean-to roof, tool wall, stacked planks, sawhorse. Somewhat taller than wide
2. woodshop level 3: master woodshop: small timber workshop house with terracotta roof, big carved door open showing tools, finished furniture outside, hanging lantern, carved sign WITHOUT text. About as wide as tall
3. alchemy level 2: larger alchemy station: workbench with a copper still, shelves of amber glass flasks, hanging herbs under a small canvas roof. Somewhat taller than wide
4. alchemy level 3: alchemist workshop: small round tower with terracotta conical roof, glowing colored flasks in the window, copper still with soft amber glow, little herb garden. About as wide as tall
5. training level 2: larger fenced practice yard with two straw targets, a rack of wooden practice sticks, small flag. About as wide as tall
6. training level 3: grand training arena: round timber-fenced arena with banners, three straw targets, small wooden viewing stand with roof, softly glowing rune stones. Somewhat taller than wide
7. archive level 2: the same cream plaster library cottage with a side wing, bay window full of books, flower boxes, porch lantern. About as wide as tall
8. archive level 3: grand storybook library: two-storey cream plaster library with terracotta roofs, round rose window WITHOUT numerals, tall arched windows full of books, gilded trim. Somewhat taller than wide
9. stars level 2: raised star-gazing platform with railing, a larger brass telescope, star chart table, small canvas canopy. Somewhat taller than wide
10. stars level 3: observatory tower: cream stone tower with an open domed copper roof holding a big brass telescope, star-pattern banner, softly glowing star lamps. Clearly taller than wide
11. memorial level 2: larger memory pavilion: timber pavilion with shingled roof, framed pictures with NO readable content, flower wreaths, two lanterns. Somewhat taller than wide
12. memorial level 3: grand memorial hall: open carved timber hall with terracotta roof, gilded trim, flower garlands, keepsakes on shelves, warm lantern glow, NO readable text. About as wide as tall
13. trough level 2: longer double wooden feeding trough filled with golden grain, one small grain sack. About as wide as tall
14. trough level 3: cozy feeding pavilion: wooden feeding troughs under a small shingled roof, grain sacks, hanging feed scoop, flowers around. Somewhat taller than wide
15. toys level 2: toy corner: wooden block tower, two cloth balls, small wooden slide, toy chest. About as wide as tall
16. toys level 3: little playground: wooden slide and swing set, toy chest, colorful pennant bunting, soft balls. Somewhat taller than wide
```
