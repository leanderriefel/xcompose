from PIL import Image, ImageDraw, ImageFont
import os

def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    # Use draw.rounded_rectangle if available (Pillow 8+)
    try:
        draw.rounded_rectangle(xy, radius=radius, fill=fill)
    except:
        draw.rectangle(xy, fill=fill)

def gen(size, out):
    # black background with rounded corners
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    # outer rounded square black
    pad = 0
    radius = int(size * 0.24)
    rounded_rect(draw, (pad, pad, size-pad, size-pad), radius, fill=(0,0,0,255))
    # subtle border
    # inner blue dot / accent
    # Draw blue circle in center upper
    # For larger sizes, add text
    blue = (29, 155, 240, 255)
    # blue dot at center
    cx, cy = size//2, size//2
    # size-dependent dot radius
    r = max(2, int(size * 0.14))
    # glow: draw lighter outer circle
    if size >= 48:
        glow_r = int(r * 1.8)
        draw.ellipse((cx-glow_r, cy-glow_r, cx+glow_r, cy+glow_r), fill=(29,155,240,40))
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=blue)
    # Add subtle "X" monogram for larger icons
    if size >= 48:
        # Try to draw X letter below dot? Actually keep minimal — add small white spark
        # Draw sparkle: 4-point star
        # Simple: draw tiny white diamond inside blue dot
        sr = max(1, int(r * 0.45))
        # diamond
        points = [(cx, cy - sr), (cx + sr, cy), (cx, cy + sr), (cx - sr, cy)]
        draw.polygon(points, fill=(255,255,255,255))
    # border stroke
    try:
        draw.rounded_rectangle((0.5,0.5,size-0.5,size-0.5), radius=radius, outline=(47,51,54,255), width=max(1, int(size*0.02)))
    except:
        pass
    img.save(out, "PNG")
    print(f"wrote {out} {size}x{size}")

os.makedirs("icons", exist_ok=True)
for s in [16,48,128]:
    gen(s, f"icons/icon{s}.png")
# also 32, 96 optional
gen(32, "icons/icon32.png")
