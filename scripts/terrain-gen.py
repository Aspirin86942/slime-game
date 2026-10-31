"""Create deterministic, seamless 1024px terrain detail tiles with Pillow and NumPy."""

import argparse
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SIZE = 1024


class Mulberry32:
    """The unsigned 32-bit mulberry32 generator used by the texture recipe."""

    def __init__(self, seed):
        self.state = seed & 0xFFFFFFFF

    def random(self):
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def hsl(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h % 360 / 360, max(0, min(100, l)) / 100,
                                  max(0, min(100, s)) / 100)
    return np.array([r, g, b], dtype=np.float32) * 255


def canvas(color):
    return np.broadcast_to(color, (SIZE, SIZE, 3)).copy()


def wrap_draw(draw, x, y):
    """Nine translated copies; the central tile receives all boundary crossings."""
    for ox in (-SIZE, 0, SIZE):
        for oy in (-SIZE, 0, SIZE):
            draw(x + ox, y + oy)


def glow(arr, x, y, radius, color, alpha, stretch=1):
    """Blend a radial patch on its clipped local NumPy grid, never on the whole tile."""
    rx, ry = radius, radius * stretch
    x0, x1 = max(0, int(x - rx)), min(SIZE, int(x + rx) + 1)
    y0, y1 = max(0, int(y - ry)), min(SIZE, int(y + ry) + 1)
    if x1 <= x0 or y1 <= y0:
        return
    dx = (np.arange(x0, x1, dtype=np.float32) + .5 - x) / rx
    dy = (np.arange(y0, y1, dtype=np.float32) + .5 - y) / ry
    falloff = np.maximum(0, 1 - np.sqrt(dy[:, None] ** 2 + dx[None, :] ** 2))
    opacity = (falloff * alpha)[..., None]
    patch = arr[y0:y1, x0:x1]
    patch *= 1 - opacity
    patch += color * opacity


def dots(image, rng, count, light, dark, min_size=1, max_size=3, chance=.6):
    draw = ImageDraw.Draw(image)
    for _ in range(count):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        sz = min_size + rng.random() * (max_size - min_size)
        color = tuple(int(v) for v in (light if rng.random() < chance else dark))
        wrap_draw(lambda xx, yy: draw.rectangle((xx, yy, xx + sz, yy + sz), fill=color), x, y)


def image_of(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def grass(h, s, l, rng):
    arr = canvas(hsl(h, s, l))
    for _ in range(420):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        radius = (10 + rng.random() * 40) * 2
        bright = rng.random() > .26
        color = hsl(h, s + (14 if bright else -10), l + (28 if bright else -16))
        wrap_draw(lambda xx, yy: glow(arr, xx, yy, radius, color, .24 if bright else .12), x, y)
    image = image_of(arr)
    draw = ImageDraw.Draw(image)
    for _ in range(6000):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        length, angle = (7 + rng.random() * 16) * 2, (rng.random() - .5)
        width = (.9 + rng.random() * 1.3) * 2
        shade = hsl(h - 14 + rng.random() * 34, s - 6 + rng.random() * 30,
                    l - 8 + rng.random() * 26)
        color = tuple(int(v) for v in shade)
        tip_x, tip_y = -length * np.sin(angle), -length * np.cos(angle)
        points = [(0, 0), (tip_x + width, tip_y * .53), (tip_x, tip_y),
                  (tip_x - width, tip_y * .53)]
        wrap_draw(lambda xx, yy: draw.polygon([(xx + px, yy + py) for px, py in points], fill=color), x, y)
    dots(image, rng, 10000, hsl(h, s + 10, l + 18), hsl(h, s - 6, l - 11), 1, 3, .64)
    return image


def soil(h, s, l, rng):
    arr = canvas(hsl(h, s, l))
    for _ in range(180):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        radius, kind = (30 + rng.random() * 90) * 2, rng.random()
        delta, alpha = (-14, .15) if kind < .46 else ((18, .11) if kind < .76 else (8, .12))
        wrap_draw(lambda xx, yy: glow(arr, xx, yy, radius, hsl(h, s, l + delta), alpha), x, y)
    for _ in range(4400):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        radius = (1.4 + rng.random() * 3.2) * 2
        alpha = .045 + rng.random() * .075
        wrap_draw(lambda xx, yy: glow(arr, xx, yy - radius * .35, radius, hsl(h, s - 6, l + 26), alpha), x, y)
        wrap_draw(lambda xx, yy: glow(arr, xx, yy + radius * .35, radius, hsl(h, s, l - 18), alpha * 1.15), x, y)
    for _ in range(360):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        radius = (10 + rng.random() * 32) * 2
        wrap_draw(lambda xx, yy: glow(arr, xx, yy, radius, hsl(h, s - 4, l + 22), .04 + rng.random() * .06), x, y)
    for _ in range(3800):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        radius = (0.8 + rng.random() * 2.1) * 2
        wrap_draw(lambda xx, yy: glow(arr, xx, yy, radius, hsl(h, s - 10, l + 44), .07 + rng.random() * .15), x, y)
    image = image_of(arr)
    dots(image, rng, 6400, hsl(h, s - 6, l + 17), hsl(h, s, l - 8), 1, 3, .38)
    return image


def clip_half_plane(poly, mx, my, dx, dy):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        va, vb = (a[0] - mx) * dx + (a[1] - my) * dy, (b[0] - mx) * dx + (b[1] - my) * dy
        if va <= 0:
            out.append(a)
        if (va < 0 < vb) or (va > 0 > vb):
            t = va / (va - vb)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def inset_polygon(poly, gap):
    cx, cy = np.mean(poly, axis=0)
    result = []
    for i, p in enumerate(poly):
        p0, p2 = poly[i - 1], poly[(i + 1) % len(poly)]
        d1, d2 = np.array(p0) - p, np.array(p2) - p
        d1 /= max(np.linalg.norm(d1), 1e-6)
        d2 /= max(np.linalg.norm(d2), 1e-6)
        bisector = d1 + d2
        bisector /= max(np.linalg.norm(bisector), 1e-6)
        if np.dot(np.array((cx, cy)) - p, bisector) < 0:
            bisector = -bisector
        # 二维叉积的标量形式：numpy 2.x 的 np.cross 不再接受二维向量。
        distance = gap / max(.3, abs(d1[0] * bisector[1] - d1[1] * bisector[0]))
        result.append(tuple(p + bisector * distance))
    return result


def stone(h, s, l, rng, frost=False):
    """Periodic Voronoi paving: neighboring sites include all nine wrapped copies."""
    points = []
    while len(points) < 78:
        x, y = rng.random() * SIZE, rng.random() * SIZE
        if all(((min(abs(x - px), SIZE - abs(x - px)) / (SIZE * .075)) ** 2 +
                (min(abs(y - py), SIZE - abs(y - py)) / (SIZE * .062)) ** 2) >= 1
               for px, py in points):
            points.append((x, y))
    image = Image.new('RGB', (SIZE, SIZE), tuple(int(v) for v in hsl(h, s, l - (12 if frost else 20))))
    draw = ImageDraw.Draw(image)
    for i, (x, y) in enumerate(points):
        poly = [(x - 250, y - 250), (x + 250, y - 250),
                (x + 250, y + 250), (x - 250, y + 250)]
        for j, (qx, qy) in enumerate(points):
            for ox in (-SIZE, 0, SIZE):
                for oy in (-SIZE, 0, SIZE):
                    if i == j and ox == 0 and oy == 0:
                        continue
                    dx, dy = qx + ox - x, qy + oy - y
                    if dx * dx + dy * dy > 750 * 750:
                        continue
                    poly = clip_half_plane(poly, x + dx / 2, y + dy / 2, dx, dy)
                    if len(poly) < 3:
                        break
                if len(poly) < 3:
                    break
            if len(poly) < 3:
                break
        if len(poly) < 3:
            continue
        inner = inset_polygon(poly, 2.7 if frost else 6.8)
        shade = hsl(h + (rng.random() - .5) * 6, s - 4 + (rng.random() - .5) * 8,
                    l + (17 if frost else 14) + (rng.random() - .5) * 12)
        color = tuple(int(v) for v in shade)
        wrap_draw(lambda xx, yy: draw.polygon([(vx + xx - x, vy + yy - y) for vx, vy in inner], fill=color), x, y)
        # Sparse mineral flecks inside each paved cell.
        for _ in range(85):
            px = x + (rng.random() - .5) * 90
            py = y + (rng.random() - .5) * 90
            if not (0 <= px < SIZE and 0 <= py < SIZE):
                px %= SIZE
                py %= SIZE
            tone = hsl(h, s, l + (24 if rng.random() > .55 else -20))
            draw.point((px, py), fill=tuple(int(v) for v in tone))
    dots(image, rng, 18000, hsl(h, s - 6, l + 20), hsl(h, s, l - 15), 1, 2, .55)
    return image


def water(h, s, l, rng):
    arr = canvas(hsl(h, s, l))
    for _ in range(130):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        radius, kind = (30 + rng.random() * 110) * 2, rng.random()
        delta, alpha = (14, .17) if kind < .55 else ((-6, .045) if kind < .72 else (26, .14))
        wrap_draw(lambda xx, yy: glow(arr, xx, yy, radius, hsl(h, s + 8, l + delta), alpha), x, y)
    for _ in range(160):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        radius = (5 + rng.random() * 24) * 2
        alpha = .12 + rng.random() * .28
        wrap_draw(lambda xx, yy: glow(arr, xx, yy, radius, hsl(h, s - 20, 97), alpha, .32), x, y)
    for _ in range(1120):
        x, y = rng.random() * SIZE, rng.random() * SIZE
        radius = (2.2 + rng.random() * 7) * 2
        wrap_draw(lambda xx, yy: glow(arr, xx, yy, radius, hsl(h, s - 24, 96), .10 + rng.random() * .24, .4), x, y)
    image = image_of(arr)
    dots(image, rng, 4800, hsl(h, s - 30, 85), hsl(h, s - 15, 51), 2, 6, .85)
    return image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', default='src/assets/storybook')
    parser.add_argument('--seed', type=int, default=20261101)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    recipes = [('moss', grass, (95, 18, 30)),
               ('crystal', stone, (185, 26, 34)),
               ('spore', soil, (28, 22, 26)),
               ('frost', stone, (200, 14, 62)),
               ('water', water, (186, 34, 30))]
    for index, (name, create, params) in enumerate(recipes):
        rng = Mulberry32(args.seed + index * 0x9E3779B9)
        image = create(*params, rng, frost=True) if name == 'frost' else create(*params, rng)
        image.save(out / f'terrain-{name}.png')


if __name__ == '__main__':
    main()
