"""Local-only premium previews; never writes to the publishing queue."""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from moviepy.editor import VideoClip

ROOT = Path(__file__).resolve().parents[3]
SHOTS = [ROOT / "Screenshot" / f"PCTWEAK{n}.png" for n in (1, 3, 5)]
OUT = ROOT / "marketing" / "reel-generator" / "output" / "previews"
W, H, DURATION = 1080, 1920, 10
BOLD, REGULAR = "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"

def f(size, bold=False): return ImageFont.truetype(BOLD if bold else REGULAR, size)

def frame(style, t):
    i = min(2, int(t / (DURATION / 3))); p = (t % (DURATION / 3)) / (DURATION / 3)
    base = Image.new("RGBA", (W,H), (14, 9, 30, 255))
    src = Image.open(SHOTS[i]).convert("RGB").crop((0,32,900,680))
    bg = src.resize((W, int(src.height * W / src.width))).filter(ImageFilter.GaussianBlur(32)).convert("RGBA"); bg.putalpha(35)
    base.alpha_composite(bg, (0, (H-bg.height)//2)); base.alpha_composite(Image.new("RGBA", (W,H), (12,8,27,195)))
    d = ImageDraw.Draw(base); accent = (205,255,61) if style == "cinematic" else (255,120,157)
    d.rounded_rectangle((68,92,82,128),7,fill=accent); d.text((104,88),"PC TWEAKER",font=f(28,True),fill="white")
    title = "CONTROL WHAT RUNS\nBEHIND YOUR GAME" if style == "cinematic" else "YOUR PC.\nON PURPOSE."
    d.multiline_text((68,180),title,font=f(64,True),spacing=8,fill="white"); d.text((70,355),"Real Windows tweaks. One-click rollback.",font=f(28),fill=(187,181,204))
    scale = .94 + p*.025 + math.sin(p*math.pi)*.01; cardw=int(W*scale); cardh=int(src.height*cardw/src.width); card=src.resize((cardw,cardh),Image.Resampling.LANCZOS).convert("RGBA")
    mask=Image.new("L",card.size,0); ImageDraw.Draw(mask).rounded_rectangle((0,0,*card.size),28,fill=255); clipped=Image.new("RGBA",card.size); clipped.paste(card,mask=mask)
    base.alpha_composite(clipped,((W-cardw)//2,int(610-p*25)))
    labels=("SYSTEM OVERVIEW","GAMING CONTROL","CLEANER MAINTENANCE"); d=ImageDraw.Draw(base)
    d.text((70,1540),labels[i],font=f(25,True),fill=accent); d.text((70,1590),"See the change. Keep the control.",font=f(33,True),fill="white"); d.text((70,1765),"PC Tweaker  ·  Link in bio",font=f(27),fill=(184,178,198))
    return np.asarray(base.convert("RGB"))

def render(style):
    OUT.mkdir(parents=True,exist_ok=True); target=OUT/f"pc-tweaker-premium-{style}.mp4"
    clip=VideoClip(lambda t:frame(style,t),duration=DURATION); clip.write_videofile(str(target),fps=24,codec="libx264",audio=False,bitrate="7000k",threads=2); clip.close(); print(target)

if __name__ == "__main__":
    render("cinematic"); render("editorial")
