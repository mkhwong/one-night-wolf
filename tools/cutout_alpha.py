"""Cut the Alpha Wolf (頭狼) out of art/alpha.png (white background, label at the bottom) into art/cut_alphawolf.png.

The light area connected to the image edge (white page plus the pale edges of the red smoke) is
turned into transparency with a colour-to-alpha step, so the smoke fades out cleanly on the dark
game background; everything inside the character's outline stays opaque (fangs, eye glints).
Run from the repository root:  python3 tools/cutout_alpha.py
"""
from collections import deque
import numpy as np
from PIL import Image
from scipy import ndimage

ART_BOTTOM = 672          # the 頭狼 label starts below this row
LIGHT = 150               # pixels lighter than this (every channel) can belong to the background

im = Image.open('art/alpha.png').convert('RGB')
im = im.crop((0, 0, im.width, ART_BOTTOM))
a = np.asarray(im).astype(float)
H, W, _ = a.shape
light = a.min(axis=2) > LIGHT
bg = np.zeros((H, W), bool)
q = deque([(y, x) for x in range(W) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, W - 1)])
while q:
    y, x = q.popleft()
    if bg[y, x] or not light[y, x]:
        continue
    bg[y, x] = True
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and not bg[ny, nx] and light[ny, nx]:
            q.append((ny, nx))
# pale pockets enclosed by smoke (not the small white of fangs and eye glints)
pale = a.min(axis=2) > 205
lab, n = ndimage.label(pale & ~bg)
if n:
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    for i, sz in enumerate(sizes, 1):
        if sz > 250:
            bg |= ndimage.binary_dilation(lab == i, iterations=2) & light
# also treat a 1px ring just outside the outline as background so no white seam remains
ring = ndimage.binary_dilation(bg, iterations=1) & (a.min(axis=2) > 110)
region = bg | ring
# colour-to-alpha against white inside the background region
alpha = np.where(region, np.clip((255 - a).max(axis=2) / 255.0, 0, 1), 1.0)
safe = np.maximum(alpha, 1e-3)[..., None]
rgb = np.where(region[..., None], np.clip((a - (1 - alpha[..., None]) * 255) / safe, 0, 255), a)
alpha[alpha < 0.04] = 0
out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
img = Image.fromarray(out, 'RGBA')
img = img.crop(img.getbbox())
# match the other cutouts' scale (roughly 250px tall)
k = 300 / img.height
img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
img.save('art/cut_alphawolf.png')
print('wrote art/cut_alphawolf.png', img.size)
