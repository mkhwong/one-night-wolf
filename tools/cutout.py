"""Cut the role characters out of the clipart sheets into transparent PNGs (art/cut_*.png).

art/sheet.png  : 5 x 3 grid, 1024 x 1024 (the Seer appears twice; the second pose is used as an alternate)
art/sheet2.png : 5 x 3 grid, 1024 x 572, used for the Troublemaker
Run from the repository root:  python3 tools/cutout.py  then  python3 tools/encode_art.py
"""
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

# sheet.png card boxes (inner area, label strip excluded)
COLS = [(28, 214), (225, 410), (420, 605), (616, 801), (812, 997)]
ROWS = [(27, 332), (353, 670), (690, 1002)]
ART_BOTTOM = {0: 255, 1: 267, 2: 262}          # where the Chinese label starts, per row
NAMES = [['werewolf', 'mysticwolf', 'minion', 'mason', 'seer'],
         ['seer2', 'apprenticeseer', 'robber', 'witch', 'gremlin'],
         ['drunk', 'insomniac', 'hunter', 'tanner', 'villager']]
# sheet2.png: the Troublemaker card (row 2, column 4), label excluded
TROUBLEMAKER_BOX = (632, 204, 806, 347)


def knock_out(im: Image.Image, tol: float = 14) -> Image.Image:
    """Flood-fill the card's navy background from the edges and make it transparent."""
    a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    corners = np.array([a[4, 4], a[4, W - 5], a[H - 4, 4], a[H - 4, W - 5]])
    bg = np.median(corners, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))
    mask = np.zeros((H, W), bool)
    q = deque([(y, x) for x in range(W) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, W - 1)])
    while q:
        y, x = q.popleft()
        if mask[y, x] or d[y, x] > tol:
            continue
        mask[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and not mask[ny, nx] and d[ny, nx] <= tol:
                q.append((ny, nx))
    # rounded-corner remnants of the card border
    R = 16
    yy, xx = np.mgrid[0:H, 0:W]
    for cy, cx in ((R, R), (R, W - 1 - R), (H - 1 - R, R), (H - 1 - R, W - 1 - R)):
        inq = ((yy < R) if cy == R else (yy > H - 1 - R)) & ((xx < R) if cx == R else (xx > W - 1 - R))
        mask |= inq & (((yy - cy) ** 2 + (xx - cx) ** 2) > (R - 3) ** 2)
    # tiny opaque islands
    lab, n = ndimage.label(~mask)
    if n:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        for i, sz in enumerate(sizes, 1):
            if sz < 120:
                mask[lab == i] = True
    alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = im.convert('RGBA')
    rgba.putalpha(alpha)
    return rgba.crop(rgba.getbbox())


def main():
    sheet = Image.open('art/sheet.png').convert('RGB')
    for ri, (y0, y1) in enumerate(ROWS):
        for ci, (x0, x1) in enumerate(COLS):
            card = sheet.crop((x0 + 5, y0 + 5, x1 - 5, y1 - 5))
            art = card.crop((0, 0, card.width, ART_BOTTOM[ri]))
            knock_out(art).save(f'art/cut_{NAMES[ri][ci]}.png')
    sheet2 = Image.open('art/sheet2.png').convert('RGB')
    knock_out(sheet2.crop(TROUBLEMAKER_BOX)).save('art/cut_troublemaker.png')
    print('wrote art/cut_*.png')


if __name__ == '__main__':
    main()
