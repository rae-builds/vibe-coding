import sys
from PIL import Image
import os

img_path = sys.argv[1]
out_dir = "images"
os.makedirs(out_dir, exist_ok=True)

img = Image.open(img_path)
w, h = img.size
col_w = w // 4
row_h = h // 4

mbti_types = [
    "ESTJ", "ESFJ", "ENFJ", "ENTJ",
    "ESTP", "ESFP", "ENFP", "ENTP",
    "ISTJ", "ISFJ", "INFJ", "INTJ",
    "ISTP", "ISFP", "INFP", "INTP"
]

idx = 0
for row in range(4):
    for col in range(4):
        left = col * col_w
        upper = row * row_h
        right = left + col_w
        lower = upper + row_h
        
        box = (left, upper, right, lower)
        cropped = img.crop(box)
        
        out_name = os.path.join(out_dir, f"{mbti_types[idx]}.png")
        cropped.save(out_name)
        print(f"Saved {out_name}")
        idx += 1

print("Successfully sliced 16 images.")
