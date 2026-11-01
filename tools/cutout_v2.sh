#!/bin/sh
# Rebuild the role cutouts from the v2 character art (art/v2/*.png). Minion and Mason keep the v1 art.
set -e
for r in gremlin insomniac villager mysticwolf witch seer robber drunk tanner; do python3 tools/cutout_sticker.py art/v2/$r.png art/cut_$r.png; done
python3 tools/cutout_sticker.py art/v2/werewolf.png art/cut_werewolf.png "0.37,0.57"
python3 tools/cutout_sticker.py art/v2/apprenticeseer.png art/cut_apprenticeseer.png "0.74,0.35"
python3 tools/cutout_sticker.py art/v2/troublemaker.png art/cut_troublemaker.png "0.35,0.32"
python3 tools/cutout_sticker.py art/v2/hunter.png art/cut_hunter.png "0.2,0.45;0.31,0.70"
python3 tools/cutout_alpha.py art/v2/alphawolf.png art/cut_alphawolf.png 1200
python3 tools/cutout_alpha.py art/v2/ravenwatch.png art/cut_ravenwatch.png 1200
cp art/cut_seer.png art/cut_seer2.png
python3 tools/encode_art.py
