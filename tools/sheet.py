# Compose lab renders into one sheet: python3 tools/sheet.py TAG [face|prof|body ...]
import sys
from PIL import Image
tag = sys.argv[1]
kinds = sys.argv[2:] or ['face', 'prof']
rows = []
for kind in kinds:
    ims = []
    for i in range(12):
        name = ('.snaps/%s%d%s.jpg' if kind == 'pose' else '.snaps/lab_%s%d%s.jpg') % (kind, i, tag)
        try: ims.append(Image.open(name))
        except FileNotFoundError: break
    rows.append(ims)
W = 512 if 'pose' not in kinds else 300
H = [max(im.size[1] * W // im.size[0] for im in r) for r in rows]
sheet = Image.new('RGB', (W * max(len(r) for r in rows), sum(H)))
y = 0
for r, h in zip(rows, H):
    for i, im in enumerate(r): sheet.paste(im.resize((W, im.size[1] * W // im.size[0])), (i * W, y))
    y += h
sheet.save('.snaps/sheet_%s.jpg' % tag, quality=88)
print(sheet.size)
