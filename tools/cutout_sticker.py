"""Cut a clean sticker-style character (white page, thick outline) into a transparent PNG.

Only the white connected to the image edge becomes transparent, so white inside the
character (beards, masks, chest fur, face paint) stays.
  python3 tools/cutout_sticker.py art/v2/seer.png art/cut_seer.png
Background trapped inside the outline (e.g. inside the Hunter's bow) is removed by giving
the centre of each pocket as fractions of the image size:
  python3 tools/cutout_sticker.py art/v2/hunter.png art/cut_hunter.png "0.2,0.45;0.31,0.70"
"""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(int)
H, W, _ = a.shape
white = a.min(axis=2) > 228
bg = np.zeros((H, W), bool)
q = deque([(y, x) for x in range(W) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, W - 1)])
while q:
    y, x = q.popleft()
    if bg[y, x] or not white[y, x]:
        continue
    bg[y, x] = True
    if y > 0: q.append((y - 1, x))
    if y < H - 1: q.append((y + 1, x))
    if x > 0: q.append((y, x - 1))
    if x < W - 1: q.append((y, x + 1))
if len(sys.argv) > 3 and sys.argv[3]:
    from scipy import ndimage
    lab, n = ndimage.label(white & ~bg)
    cents = ndimage.center_of_mass(np.ones_like(lab), lab, range(1, n + 1))
    for pt in sys.argv[3].split(';'):
        fx, fy = (float(v) for v in pt.split(','))
        # the trapped white region whose centre is nearest the given point
        best = min(range(n), key=lambda i: (cents[i][1] / W - fx) ** 2 + (cents[i][0] / H - fy) ** 2)
        bg |= lab == best + 1
alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
rgba = im.convert('RGBA'); rgba.putalpha(alpha)
rgba = rgba.crop(rgba.getbbox())
k = 420 / rgba.height
rgba = rgba.resize((round(rgba.width * k), 420), Image.LANCZOS)
rgba.save(out)
print('wrote', out, rgba.size)
