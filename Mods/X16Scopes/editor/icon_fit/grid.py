import subprocess, sys
def grid(src, dst, step=50):
    m=["stroke '#ff3030' stroke-width 1 fill none"]
    m+= [f"line {x},0 {x},900" for x in range(0,2000,step)]
    m+= [f"line 0,{y} 2000,{y}" for y in range(0,900,step)]
    m.append("stroke none fill yellow font-size 12")
    m+= [f"text {x+2},12 '{x}'" for x in range(0,2000,step*2)]
    m+= [f"text 2,{y-2} '{y}'" for y in range(step,900,step)]
    subprocess.run(["magick", src, "-background", "#555", "-flatten", "-draw", " ".join(m), dst], check=True)
if __name__ == "__main__":
    args=sys.argv[1:]
    for i in range(0,len(args),2): grid(args[i], args[i+1])
