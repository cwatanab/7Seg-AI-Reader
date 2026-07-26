import sys
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def convert_to_ort(target_path: str | None = None):
    models_dir = PROJECT_ROOT / "models"
    if not target_path:
        target = models_dir
    else:
        target = Path(target_path)

    if not target.exists():
        print(f"エラー: 指定されたパス '{target}' が見つかりません。")
        sys.exit(1)

    print(f"🔄 ONNX モデル (.onnx) から ORT フォーマット (.ort) への変換を開始します: {target}")
    
    cmd = [
        sys.executable,
        "-m",
        "onnxruntime.tools.convert_onnx_models_to_ort",
        str(target)
    ]
    
    res = subprocess.run(cmd, check=True)
    if res.returncode == 0:
        print("\n✅ ORT フォーマット (.ort) への変換が完了しました！")


if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else None
    convert_to_ort(inp)
