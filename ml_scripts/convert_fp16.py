import sys
from pathlib import Path
import shutil
import onnx
import onnxruntime as ort
from onnxconverter_common import float16

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def convert_to_fp16(input_path: str | None = None, output_path: str | None = None):
    models_dir = PROJECT_ROOT / "models"
    public_dir = PROJECT_ROOT / "public"

    if not input_path:
        input_path = public_dir / "7-segment-digits-yolo26n.onnx"

    input_p = Path(input_path)
    if not input_p.exists():
        print(f"エラー: 入力モデル '{input_path}' が見つかりません。")
        sys.exit(1)

    if not output_path:
        output_path = public_dir / "7-segment-digits-yolo26n-fp16.onnx"
    else:
        output_path = Path(output_path)

    print(f"🔄 ONNX FP16 (Half Precision) 変換を開始します:")
    print(f"   入力: {input_p} ({input_p.stat().st_size / 1024 / 1024:.2f} MB)")
    print(f"   出力: {output_path}")

    from onnxruntime.transformers.onnx_model import OnnxModel

    model = onnx.load(str(input_p))
    onnx_model = OnnxModel(model)
    onnx_model.convert_float_to_float16()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    onnx_model.save_model_to_file(str(output_path))

    # models/ ディレクトリにもコピー
    models_target = models_dir / output_path.name
    models_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(output_path, models_target)

    # 推論セッション検証テスト
    sess = ort.InferenceSession(str(output_path))
    size_mb = output_path.stat().st_size / 1024 / 1024
    ratio = input_p.stat().st_size / output_path.stat().st_size

    print(f"\n✅ FP16 変換＆検証が成功しました！")
    print(f"   出力ファイル: {output_path} ({size_mb:.2f} MB)")
    print(f"   モデルサイズ削減率: {ratio:.2f}x (約50%軽量化)")
    print(f"   検証済み入力ノード: {[x.name for x in sess.get_inputs()]}")

    return str(output_path)


if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else None
    out = sys.argv[2] if len(sys.argv) > 2 else None
    convert_to_fp16(inp, out)
