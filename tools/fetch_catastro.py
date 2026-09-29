import urllib.request, time, os, sys
LAT0, LAT1 = 38.8460, 38.8700
LON0, LON1 = -6.1200, -6.0740
DLAT, DLON = 0.004, 0.005
out = 'data/cat'
def fetch(kind, la0, lo0, la1, lo1, fn):
    if os.path.exists(fn) and os.path.getsize(fn) > 500: return 'cached'
    url = ("http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=wfs&version=2&request=getfeature"
           f"&typenames={kind}&bbox={la0:.5f},{lo0:.5f},{la1:.5f},{lo1:.5f}&srsname=EPSG::4326")
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 GuarenaGameResearch/1.0'})
            data = urllib.request.urlopen(req, timeout=90).read()
            open(fn, 'wb').write(data)
            return len(data)
        except Exception as e:
            print('  retry', attempt, e, flush=True); time.sleep(3)
    return 'FAIL'
i = 0
la = LAT0
while la < LAT1 - 1e-9:
    lo = LON0
    while lo < LON1 - 1e-9:
        for kind, tag in (('bu:building', 'b'), ('bu:buildingpart', 'p')):
            fn = f"{out}/{tag}_{la:.4f}_{lo:.4f}.gml"
            r = fetch(kind, la, lo, min(la + DLAT, LAT1), min(lo + DLON, LON1), fn)
            print(i, kind, round(la,4), round(lo,4), r, flush=True)
            time.sleep(0.4)
        i += 1
        lo += DLON
    la += DLAT
print('DONE')
