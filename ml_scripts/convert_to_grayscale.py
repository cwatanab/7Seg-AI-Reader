import os
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def convert_dataset_to_grayscale(dataset_dir=None):
    if dataset_dir is None:
        dataset_path = PROJECT_ROOT / "datasets" / "LCD-1"
    else:
        dataset_path = Path(dataset_dir)

    print(f"データセット '{dataset_path}' 内の画像をグレースケール（モノクロ）に変換中...")

    image_extensions = {".jpg", ".jpeg", ".png", ".bmp"}
    converted_count = 0

    for split in ["train", "valid", "test"]:
        images_dir = dataset_path / split / "images"
        if not images_dir.exists():
            images_dir = dataset_path / split
        
        if not images_dir.exists():
            continue

        for img_path in images_dir.glob("*.*"):
            if img_path.suffix.lower() in image_extensions:
                try:
                    with Image.open(img_path) as img:
                        gray_img = img.convert("L").convert("RGB")
                        gray_img.save(img_path)
                        converted_count += 1
                except Exception as e:
                    print(f"エラー ({img_path}): {e}")

    print(f"完了: 計 {converted_count} 枚の画像をモノクロ化しました。")

if __name__ == "__main__":
    convert_dataset_to_grayscale()
