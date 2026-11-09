"""Read-only walk of the live ObjPrototype TSet (retail exe, Nov 2026 build: 0x14ad65a28) via NodeBridge /mem.
Flags AgentType (proto+0x5ac) outside 0..16. Usage: python3 -I agenttype-walk.py <out.txt>; start it before
the main menu: the set fills there and the walk takes ~8 s.
"""
import json, struct, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
B="http://127.0.0.1:47811"; REG=0x14ad65a28; VT=0x148e999d0
out=open(sys.argv[1],"a",buffering=1)
def mem(a,n):
    r=json.load(urllib.request.urlopen(f"{B}/mem?addr={a}&n={n}",timeout=3)); return bytes.fromhex(r["hex"].replace(" ",""))
def sid(h):
    base=0x14b10f588 if h>=0 else 0x14b12f618; h=abs(h)
    e=struct.unpack("<Q",mem(base+(h>>10)*8,8))[0]+(h&0x3ff)*0x20
    p,ln=struct.unpack("<Qi",mem(e,12))
    return mem(p,(ln-1)*2).decode("utf-16le","replace") if p and 0<ln<300 else f"?{h}"
# wait for the registry to fill
while True:
    try:
        arr,num=struct.unpack("<Qi",mem(REG,12))
        if arr and num>3000: break
    except Exception: pass
    time.sleep(0.05)
t0=time.time(); raw=b""
for off in range(0,num*0x18,4080): raw+=mem(arr+off,min(4080,num*0x18-off))
ents=[(struct.unpack_from("<i",raw,i*0x18)[0],struct.unpack_from("<Q",raw,i*0x18+8)[0]) for i in range(num)]
ents=[e for e in ents if 0x10000<e[1]<0x7fffffffffff][::-1]
print(f"num={num} valid={len(ents)} array read {time.time()-t0:.2f}s",file=out)
hist={}; fails=0
def one(e):
    h,p=e
    try: b=mem(p+0x5ac,4); return h,p,struct.unpack("<i",b)[0]
    except Exception: return h,p,None
with ThreadPoolExecutor(24) as ex:
    for i,(h,p,at) in enumerate(ex.map(one,ents)):
        if at is None: fails+=1; continue
        hist[at]=hist.get(at,0)+1
        if not 0<=at<=16:
            try: s=sid(h)
            except Exception: s=f"h{h}"
            print(f"BAD {s} AT={at} proto={p:#x} sidh={h}",file=out)
        if i%500==0: print(f"prog {i} fails={fails} t={time.time()-t0:.2f}",file=out)
print(f"DONE t={time.time()-t0:.2f} fails={fails} hist={dict(sorted(hist.items()))}",file=out)
