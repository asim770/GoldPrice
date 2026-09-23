import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("assets", exist_ok=True)

# 1. Icon Background (1024x1024) - Obsidian #030509
bg_color = (3, 5, 9)
bg_img = Image.new("RGBA", (1024, 1024), bg_color)
bg_img.save("assets/icon-background.png")

# 2. Icon (1024x1024) with Gold Crest & Scales
icon_img = Image.new("RGBA", (1024, 1024), bg_color)
draw = ImageDraw.Draw(icon_img)

# Radial gold halo
for r in range(460, 200, -10):
    alpha = int(45 * (1 - (r - 200) / 260))
    draw.ellipse((512 - r, 512 - r, 512 + r, 512 + r), fill=(245, 158, 11, alpha))

# Center golden badge with rounded rectangle
badge_box = (256, 256, 768, 768)
draw.rounded_rectangle(badge_box, radius=110, fill=(217, 119, 6), outline=(251, 191, 36), width=16)

# Inner squircle
inner_box = (276, 276, 748, 748)
draw.rounded_rectangle(inner_box, radius=96, fill=(245, 158, 11))

# Balance scale glyph in dark obsidian center
# Center beam
draw.rectangle((502, 340, 522, 680), fill=(10, 13, 22))
# Top triangle / hanger
draw.polygon([(512, 330), (480, 365), (544, 365)], fill=(10, 13, 22))
# Horizontal beam
draw.rectangle((360, 390, 664, 408), fill=(10, 13, 22))
# Left string & pan
draw.line((370, 408, 340, 480), fill=(10, 13, 22), width=6)
draw.line((420, 408, 450, 480), fill=(10, 13, 22), width=6)
draw.chord((330, 470, 460, 520), 0, 180, fill=(10, 13, 22))
# Right string & pan
draw.line((604, 408, 574, 480), fill=(10, 13, 22), width=6)
draw.line((654, 408, 684, 480), fill=(10, 13, 22), width=6)
draw.chord((564, 470, 694, 520), 0, 180, fill=(10, 13, 22))
# Base stand
draw.chord((432, 650, 592, 700), 180, 360, fill=(10, 13, 22))
draw.rectangle((412, 675, 612, 695), fill=(10, 13, 22))

icon_img.save("assets/icon.png")
icon_img.save("assets/icon-only.png")

# Foreground for adaptive icon (centered, transparent bg)
fg_img = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
fg_draw = ImageDraw.Draw(fg_img)
fg_box = (312, 312, 712, 712)
fg_draw.rounded_rectangle(fg_box, radius=85, fill=(245, 158, 11), outline=(251, 191, 36), width=12)

# Scale in foreground
fg_draw.rectangle((504, 380, 520, 640), fill=(10, 13, 22))
fg_draw.polygon([(512, 370), (488, 398), (536, 398)], fill=(10, 13, 22))
fg_draw.rectangle((390, 420, 634, 435), fill=(10, 13, 22))
fg_draw.line((400, 435, 375, 490), fill=(10, 13, 22), width=5)
fg_draw.line((440, 435, 465, 490), fill=(10, 13, 22), width=5)
fg_draw.chord((365, 480, 475, 520), 0, 180, fill=(10, 13, 22))
fg_draw.line((584, 435, 559, 490), fill=(10, 13, 22), width=5)
fg_draw.line((624, 435, 649, 490), fill=(10, 13, 22), width=5)
fg_draw.chord((549, 480, 659, 520), 0, 180, fill=(10, 13, 22))
fg_draw.chord((448, 620, 576, 660), 180, 360, fill=(10, 13, 22))
fg_draw.rectangle((430, 640, 594, 655), fill=(10, 13, 22))

fg_img.save("assets/icon-foreground.png")

# 3. Splash Screen (2732x2732) - Deep Obsidian with Centered Bullion Emblem
splash_img = Image.new("RGBA", (2732, 2732), bg_color)
splash_draw = ImageDraw.Draw(splash_img)

# Ambient golden aura in center
for r in range(900, 300, -25):
    alpha = int(35 * (1 - (r - 300) / 600))
    splash_draw.ellipse((1366 - r, 1366 - r, 1366 + r, 1366 + r), fill=(245, 158, 11, alpha))

# Resize icon to paste in center
center_icon = icon_img.resize((512, 512), Image.Resampling.LANCZOS)
splash_img.paste(center_icon, (1366 - 256, 1366 - 256), center_icon)

splash_img.save("assets/splash.png")
splash_img.save("assets/splash-dark.png")
print("Native branding assets successfully generated!")
