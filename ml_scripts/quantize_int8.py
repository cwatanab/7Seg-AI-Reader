import sys
from pathlib import Path

import cv2
import numpy as np
from onnxruntime.quantization import (
    CalibrationDataReader,
    QuantFormat,
    QuantType,
    quantize_dynamic,
    quantize_static,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class YoloCalibrationDataReader(CalibrationDataReader):
    """640x640 のデータセット画像を用いて QDQ 量子化用のキャリブレーションを行う"""

    def __init__(self, image_folder: Path, input_name: str = "images", max_count: int = 30):
        super().__init__()
        self.input_name = input_name
        self.image_paths = (
            list(image_folder.glob("*.jpg"))
            + list(image_folder.glob("*.png"))
            + list(image_folder.glob("*.jpeg"))
        )[:max_count]
        self.data_list = []
        self._prepare()
        self.enum_data = iter(self.data_list)

    def _prepare(self):
        print(f"📸 {len(self.image_paths)} 枚の画像でキャリブレーションデータを作成中...")
        for p in self.image_paths:
            img = cv2.imread(str(p))
            if img is None:
                continue
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            h, w, _ = img_rgb.shape
            scale = min(640 / w, 640 / h)
            nw, nh = int(w * scale), int(h * scale)
            resized = cv2.resize(img_rgb, (nw, nh))

            canvas = np.zeros((640, 640, 3), dtype=np.uint8)
            pad_x = (640 - nw) // 2
            pad_y = (640 - nh) // 2
            canvas[pad_y : pad_y + nh, pad_x : pad_x + nw] = resized

            chw = canvas.astype(np.float32) / 255.0
            chw = np.transpose(chw, (2, 0, 1))
            batch = np.expand_dims(chw, axis=0)
            self.data_list.append({self.input_name: batch})

    def get_next(self):
        if self.enum_data is None:
            self.enum_data = iter(self.data_list)
        return next(self.enum_data, None)

    def rewind(self):
        self.enum_data = iter(self.data_list)


def quantize_to_int8(input_path: str | None = None, output_path: str | None = None):
    models_dir = PROJECT_ROOT / "models"

    if not input_path:
        input_path = str(models_dir / "7-segment-digits-yolo26s.onnx")

    input_p = Path(input_path)
    if not input_p.exists():
        print(f"エラー: 入力モデルファイル '{input_path}' が見つかりません。")
        sys.exit(1)

    if not output_path:
        output_path = str(input_p.parent / f"{input_p.stem}-int8{input_p.suffix}")

    print(f"入力モデル:  {input_path}  ({input_p.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"出力先:      {output_path}")
    print(f"量子化方式:  Static Quantization (INT8 - QuantFormat.QDQ)")
    print()

    # キャリブレーション画像の検索
    dataset_dirs = [
        PROJECT_ROOT / "datasets" / "test" / "images",
        PROJECT_ROOT / "datasets" / "valid" / "images",
        PROJECT_ROOT / "datasets" / "LCD-1" / "test" / "images",
    ]
    calib_folder = None
    for d in dataset_dirs:
        if d.exists() and len(list(d.glob("*.*"))) > 0:
            calib_folder = d
            break

    if calib_folder:
        try:
            reader = YoloCalibrationDataReader(calib_folder, max_count=30)
            quantize_static(
                model_input=input_path,
                model_output=output_path,
                calibration_data_reader=reader,
                quant_format=QuantFormat.QDQ,
                weight_type=QuantType.QUInt8,
                activation_type=QuantType.QUInt8,
            )
            print("✅ QDQ 形式の静的量子化に成功しました！")
        except Exception as e:
            print(f"⚠️ QDQ 静的量子化で例外が発生したため動的量子化へフォールバックします: {e}")
            quantize_dynamic(
                model_input=input_path,
                model_output=output_path,
                weight_type=QuantType.QUInt8,
            )
    else:
        print("⚠️ キャリブレーション画像が見つからないため動的量子化を実行します...")
        quantize_dynamic(
            model_input=input_path,
            model_output=output_path,
            weight_type=QuantType.QUInt8,
        )

    output_p = Path(output_path)
    print(f"\n✅ 量子化完了！")
    print(f"   出力ファイル: {output_path}  ({output_p.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"   圧縮率: {input_p.stat().st_size / output_p.stat().st_size:.1f}x")

    return output_path


if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else None
    out = sys.argv[2] if len(sys.argv) > 2 else None
    quantize_to_int8(inp, out)