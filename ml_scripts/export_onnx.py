import sys
from pathlib import Path
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def export_to_onnx(model_path=None):
    models_dir = PROJECT_ROOT / "models"

    if not model_path:
        possible_weights = list(models_dir.glob("*.pt"))
        if possible_weights:
            model_path = str(possible_weights[0])

    if not model_path or not Path(model_path).exists():
        print(f"エラー: モデルファイル '{model_path}' が見つかりません。")
        return

    print(f"モデル '{model_path}' を ONNX 形式に変換中...")
    model = YOLO(model_path)

    # ONNX 形式へエクスポート (Webブラウザ/onnxruntime-web 互換のため opset=17 を指定)
    onnx_file = model.export(
        format="onnx",
        imgsz=640,
        dynamic=False,
        simplify=True,
        opset=17
    )

    models_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = Path(onnx_file)
    target_path = models_dir / onnx_path.name
    if onnx_path.resolve() != target_path.resolve() and onnx_path.exists():
        if target_path.exists():
            target_path.unlink()
        onnx_path.rename(target_path)
        onnx_file = str(target_path)

    # Web アプリ用 public ディレクトリにも自動コピー
    public_dir = PROJECT_ROOT / "public"
    if public_dir.exists():
        import shutil
        public_target = public_dir / onnx_path.name
        shutil.copy2(target_path, public_target)
        print(f"public ディレクトリへコピーしました: {public_target}")

    print(f"\n変換完了！ ONNXモデルファイル: {onnx_file}")
    return onnx_file

if __name__ == "__main__":
    m_path = sys.argv[1] if len(sys.argv) > 1 else None
    export_to_onnx(m_path)
