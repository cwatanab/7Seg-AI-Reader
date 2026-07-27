import type * as ort from 'onnxruntime-web';
import * as ortModule from 'onnxruntime-web';

// CDN 版 window.ort があれば優先使用 (Vite / bundle パーサーバグの完全回避)
const getOrt = () => {
  const globalOrt = (typeof window !== 'undefined' && (window as any).ort) ? (window as any).ort : ortModule;
  if (globalOrt.env && globalOrt.env.wasm) {
    globalOrt.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
  }
  return globalOrt;
};

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  normX1?: number;
  normY1?: number;
  normX2?: number;
  normY2?: number;
  score: number;
  classId: number;
  label: string;
}

export interface LineResult {
  lineIndex: number;
  digits: string;
  boxes: BoundingBox[];
}

export interface InferenceResult {
  boxes: BoundingBox[];
  lines: LineResult[];
  digitsString: string;
  inferenceTimeMs: number;
}

let session: any = null;
let isLoadingSession = false;
export let activeProvider: string = '初期化中...';

/**
 * ONNX モデルをロードする
 */
export async function loadYoloModel(
  modelPath: string = '/7-segment-digits-yolo26n.onnx',
  onProgress?: (msg: string) => void
): Promise<{ session: any; provider: string }> {
  if (session) return { session, provider: activeProvider };
  if (isLoadingSession) {
    while (isLoadingSession) {
      await new Promise((r) => setTimeout(r, 100));
      if (session) return { session, provider: activeProvider };
    }
  }

  isLoadingSession = true;
  try {
    const ort = getOrt();
    // WASM マルチスレッド (CPU 最大4コア) & SIMD 設定
    if (navigator.hardwareConcurrency && ort.env && ort.env.wasm) {
      ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency);
      ort.env.wasm.simd = true;
    }

    // ONNX モデルデータの取得 (ブラウザキャッシュ完全無視オプション付与)
    if (onProgress) onProgress('モデルデータを読み込み中...');
    const cacheBuster = `?t=${Date.now()}`;
    let response = await fetch(`${modelPath}${cacheBuster}`, { cache: 'no-store' });
    if (!response.ok && modelPath !== '/7-segment-digits-yolo26n.onnx') {
      console.warn(`Fallback to default model /7-segment-digits-yolo26n.onnx due to ${response.status}`);
      response = await fetch(`/7-segment-digits-yolo26n.onnx${cacheBuster}`, { cache: 'no-store' });
    }
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const modelBuffer = new Uint8Array(arrayBuffer);

    // .ort フォーマットおよび INT8 量子化モデルは WASM 専用最適化フォーマットのため最初から WASM を使用
    // 標準の .onnx モデルの場合は WebGPU -> WebGL -> WASM の順で試行
    const isOrtOrInt8 = modelPath.endsWith('.ort') || modelPath.includes('int8');
    const providersToTry = isOrtOrInt8
      ? [{ name: 'WASM', provider: 'wasm' }]
      : [
          { name: 'WebGPU', provider: 'webgpu' },
          { name: 'WebGL', provider: 'webgl' },
          { name: 'WASM', provider: 'wasm' },
        ];

    const modelUrlWithCacheBuster = `${modelPath}?t=${Date.now()}`;

    for (const item of providersToTry) {
      try {
        if (onProgress) onProgress(`${item.name} を初期化中...`);
        
        // 1. まずメモリ上の modelBuffer からセッション生成を試行 (slice(0)でArrayBuffer detach防止)
        try {
          session = await ort.InferenceSession.create(modelBuffer.slice(0), {
            executionProviders: [item.provider],
            graphOptimizationLevel: 'all',
          });
        } catch (bufErr) {
          // 2. バッファパース失敗時は URL 直接指定ローダーへフォールバック
          console.warn(`Buffer load failed for ${item.name}, trying direct URL load...`, bufErr);
          session = await ort.InferenceSession.create(modelUrlWithCacheBuster, {
            executionProviders: [item.provider],
            graphOptimizationLevel: 'all',
          });
        }

        activeProvider = item.name;
        console.log(`✅ ONNX Session created with ${item.name}. Warming up shaders...`);
        
        // ウォームアップ推論 (初回シェーダーコンパイル & 動作検証)
        const dummyData = new Float32Array(1 * 3 * 640 * 640);
        const dummyTensor = new (getOrt().Tensor)('float32', dummyData, [1, 3, 640, 640]);
        const inputName = session.inputNames[0] || 'images';
        const warmStart = performance.now();
        await session.run({ [inputName]: dummyTensor });
        const warmTime = (performance.now() - warmStart).toFixed(1);
        console.log(`🚀 ONNX Warmup completed for ${item.name} in ${warmTime}ms`);

        // ロードされたモデルに応じてクラス名マップを自動設定
        if (modelPath.includes('yolo26n')) {
          YOLO_CLASS_NAMES = [...YOLO_CLASS_NAMES_12];
          console.log('🏷️ Loaded 12-class model map (-, ., 0-9) for yolo26n:', YOLO_CLASS_NAMES);
        } else {
          YOLO_CLASS_NAMES = [...YOLO_CLASS_NAMES_16];
          console.log('🏷️ Loaded 16-class model map for yolo26s:', YOLO_CLASS_NAMES);
        }

        if (onProgress) onProgress(`${item.name} 準備完了！ (${warmTime}ms)`);
        return { session, provider: activeProvider };
      } catch (err) {
        console.warn(`⚠️ Provider ${item.name} failed during init/warmup, falling back...`, err);
        session = null;
      }
    }

    throw new Error('All ONNX execution providers failed to initialize');
  } catch (error) {
    console.error('❌ ONNX Session initialization failed:', error);
    activeProvider = 'エラー';
    throw error;
  } finally {
    isLoadingSession = false;
  }
}

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;
let sharedFloat32Data: Float32Array | null = null;

/**
 * 画像 / キャンバス / ビデオフレームから ONNX テンソルを作成する (640x640 RGB float32)
 */
export function preprocessImage(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  targetWidth = 640,
  targetHeight = 640,
  convertMono = true
): { tensor: ort.Tensor; canvas: HTMLCanvasElement; padX: number; padY: number; scale: number; scaledW: number; scaledH: number; srcWidth: number; srcHeight: number } {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
    sharedCanvas.width = targetWidth;
    sharedCanvas.height = targetHeight;
    sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
    sharedFloat32Data = new Float32Array(3 * targetWidth * targetHeight);
  }

  const ctx = sharedCtx!;
  const float32Data = sharedFloat32Data!;

  // アスペクト比を維持しながらリサイズ & パディング (Letterbox)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  let srcWidth = 0;
  let srcHeight = 0;
  if (source instanceof HTMLVideoElement) {
    srcWidth = source.videoWidth;
    srcHeight = source.videoHeight;
  } else if (source instanceof HTMLImageElement) {
    srcWidth = source.naturalWidth;
    srcHeight = source.naturalHeight;
  } else {
    srcWidth = source.width;
    srcHeight = source.height;
  }

  let scale = 1;
  let padX = 0;
  let padY = 0;
  let scaledW = targetWidth;
  let scaledH = targetHeight;

  if (srcWidth > 0 && srcHeight > 0) {
    scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
    scaledW = srcWidth * scale;
    scaledH = srcHeight * scale;
    padX = (targetWidth - scaledW) / 2;
    padY = (targetHeight - scaledH) / 2;

    ctx.drawImage(source, padX, padY, scaledW, scaledH);
  } else {
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  }

  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;

  const area = targetWidth * targetHeight;
  const channelGOffset = area;
  const channelBOffset = area * 2;

  // 高速バッチ転送
  if (convertMono) {
    for (let i = 0; i < area; i++) {
      const idx = i * 4;
      const gray = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255.0;
      float32Data[i] = gray;
      float32Data[channelGOffset + i] = gray;
      float32Data[channelBOffset + i] = gray;
    }
  } else {
    for (let i = 0; i < area; i++) {
      const idx = i * 4;
      float32Data[i] = data[idx] / 255.0;
      float32Data[channelGOffset + i] = data[idx + 1] / 255.0;
      float32Data[channelBOffset + i] = data[idx + 2] / 255.0;
    }
  }

  const tensor = new (getOrt().Tensor)('float32', float32Data, [1, 3, targetWidth, targetHeight]);
  return {
    tensor,
    canvas: sharedCanvas,
    padX,
    padY,
    scale,
    scaledW,
    scaledH,
    srcWidth: srcWidth || targetWidth,
    srcHeight: srcHeight || targetHeight,
  };
}

/**
 * NMS (Non-Maximum Suppression)
 */
function applyNMS(boxes: BoundingBox[], iouThreshold = 0.45): BoundingBox[] {
  // スコアの降順でソート
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const selected: BoundingBox[] = [];

  for (const box of sorted) {
    let keep = true;
    for (const sel of selected) {
      const iou = calculateIoU(box, sel);
      if (iou > iouThreshold) {
        keep = false;
        break;
      }
    }
    if (keep) {
      selected.push(box);
    }
  }

  return selected;
}

function calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const xA = Math.max(boxA.x1, boxB.x1);
  const yA = Math.max(boxA.y1, boxB.y1);
  const xB = Math.min(boxA.x2, boxB.x2);
  const yB = Math.min(boxA.y2, boxB.y2);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const boxAArea = (boxA.x2 - boxA.x1) * (boxA.y2 - boxA.y1);
  const boxBArea = (boxB.x2 - boxB.x1) * (boxB.y2 - boxB.y1);

  const unionArea = boxAArea + boxBArea - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

let isFloat16Model = false;

/**
 * Float32Array を IEEE 754 半精度 (float16 / Uint16Array) テンソルデータに高速変換する
 */
function float32ToFloat16Array(float32Array: Float32Array): Uint16Array {
  const float16Array = new Uint16Array(float32Array.length);
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);

  for (let i = 0; i < float32Array.length; i++) {
    const val = float32Array[i];
    f32[0] = val;
    const x = u32[0];
    const sign = (x >> 31) & 0x0001;
    let exp = (x >> 23) & 0x00ff;
    let mant = x & 0x007fffff;

    if (exp === 0) {
      float16Array[i] = sign << 15;
    } else if (exp === 0xff) {
      float16Array[i] = (sign << 15) | 0x7c00 | (mant ? 0x0200 : 0);
    } else {
      exp = exp - 127 + 15;
      if (exp >= 31) {
        float16Array[i] = (sign << 15) | 0x7c00;
      } else if (exp <= 0) {
        if (exp < -10) {
          float16Array[i] = sign << 15;
        } else {
          mant = (mant | 0x00800000) >> (1 - exp);
          float16Array[i] = (sign << 15) | (mant >> 13);
        }
      } else {
        float16Array[i] = (sign << 15) | (exp << 10) | (mant >> 13);
      }
    }
  }
  return float16Array;
}

export const YOLO_CLASS_NAMES_12: string[] = [
  '-', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
];

export const YOLO_CLASS_NAMES_16: string[] = [
  '-', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'dot', 'h', 'kW', 'null'
];

export let YOLO_CLASS_NAMES: string[] = [...YOLO_CLASS_NAMES_12];

/**
 * YOLO26 推論実行
 */
export async function runInference(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  confThreshold = 0.40,
  convertMono = true
): Promise<InferenceResult> {
  if (!session) {
    throw new Error('Model session is not loaded yet');
  }

  const startTime = performance.now();

  // 前処理 (Letterbox パラメータを取得)
  const { tensor, padX, padY, scale, scaledW, scaledH, srcWidth, srcHeight } = preprocessImage(source, 640, 640, convertMono);

  const inputName = session.inputNames[0] || 'images';
  let tensorToUse = tensor;

  if (isFloat16Model && sharedFloat32Data) {
    tensorToUse = new (getOrt().Tensor)('float16', float32ToFloat16Array(sharedFloat32Data), [1, 3, 640, 640]);
  }

  let feeds: Record<string, any> = { [inputName]: tensorToUse };
  let outputMap: any;

  try {
    outputMap = await session.run(feeds);
  } catch (err: any) {
    if (err && String(err).includes('float16') && !isFloat16Model && sharedFloat32Data) {
      isFloat16Model = true;
      console.log('🔄 Session expects float16 input, converting tensor to float16...');
      const float16Tensor = new (getOrt().Tensor)('float16', float32ToFloat16Array(sharedFloat32Data), [1, 3, 640, 640]);
      feeds = { [inputName]: float16Tensor };
      outputMap = await session.run(feeds);
    } else if (err && (String(err).includes('JSEP') || String(err).includes('DequantizeLinear') || String(err).includes('webgpu'))) {
      console.warn('⚠️ WebGPU / JSEP kernel execution failed during inference. Falling back to WASM...', err);
      // セッションをクリアして WASM プロバイダーで再生成
      session = null;
      const ort = getOrt();
      if (sharedFloat32Data) {
        // WASM でセッション再生成
        const cacheBuster = `?t=${Date.now()}`;
        const modelUrl = `/7-segment-digits-yolo26n.onnx${cacheBuster}`;
        session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
        activeProvider = 'WASM';
        outputMap = await session.run(feeds);
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  const outputTensor = outputMap['output0'] || Object.values(outputMap)[0];

  const data = outputTensor.data as Float32Array; // shape: [1, 300, 6]
  const rawBoxes: BoundingBox[] = [];

  // [1, 300, 6] を解析し、0.0~1.0の正規化座標および元画像解像度のピクセル座標に逆換算 (Un-letterbox)
  const numDetections = 300;
  for (let i = 0; i < numDetections; i++) {
    const offset = i * 6;
    const boxX1 = data[offset];
    const boxY1 = data[offset + 1];
    const boxX2 = data[offset + 2];
    const boxY2 = data[offset + 3];
    const score = data[offset + 4];
    const classId = Math.round(data[offset + 5]);

    if (score >= confThreshold && classId >= 0 && classId < YOLO_CLASS_NAMES.length) {
      const label = YOLO_CLASS_NAMES[classId] || String(classId);

      // 'null' および 単位記号 ('h', 'kW') を除外
      if (['null', 'h', 'kW'].includes(label)) continue;

      // 0.0 ~ 1.0 の正規化座標 (Letterboxパディング除去後の相対位置)
      const normX1 = Math.max(0, Math.min(1, (boxX1 - padX) / scaledW));
      const normY1 = Math.max(0, Math.min(1, (boxY1 - padY) / scaledH));
      const normX2 = Math.max(0, Math.min(1, (boxX2 - padX) / scaledW));
      const normY2 = Math.max(0, Math.min(1, (boxY2 - padY) / scaledH));

      // 元画像解像度の絶対ピクセル座標
      const realX1 = normX1 * srcWidth;
      const realY1 = normY1 * srcHeight;
      const realX2 = normX2 * srcWidth;
      const realY2 = normY2 * srcHeight;

      rawBoxes.push({
        x1: realX1,
        y1: realY1,
        x2: realX2,
        y2: realY2,
        normX1,
        normY1,
        normX2,
        normY2,
        score,
        classId,
        label,
      });
    }
  }

  // NMS 処理
  const finalBoxes = applyNMS(rawBoxes, 0.45);

  // Y軸の位置関係に基づいて行（Line 1, Line 2, Line 3）ごとにグループ化
  const lines = groupBoxesIntoLines(finalBoxes);

  // 全行の数字列（改行区切り）
  const digitsString = lines.map((l) => l.digits).join('\n');

  const inferenceTimeMs = performance.now() - startTime;

  return {
    boxes: finalBoxes,
    lines,
    digitsString,
    inferenceTimeMs,
  };
}

/**
 * 検出されたバウンディングボックスを垂直方向（Y軸）の位置に基づいて行（Line）ごとに分割・整理する
 */
export function groupBoxesIntoLines(boxes: BoundingBox[]): LineResult[] {
  if (boxes.length === 0) return [];

  // 平均的なボックスの高さを算出
  const totalHeight = boxes.reduce((sum, b) => sum + (b.y2 - b.y1), 0);
  const avgHeight = totalHeight / boxes.length;
  const lineThreshold = avgHeight * 0.55; // 高さの約半分以内のY重心差なら同一行

  // Y軸の中心値でソート
  const sortedByY = [...boxes].sort((a, b) => (a.y1 + a.y2) / 2 - (b.y1 + b.y2) / 2);

  const lineGroups: BoundingBox[][] = [];

  for (const box of sortedByY) {
    const boxCenterY = (box.y1 + box.y2) / 2;
    let addedToLine = false;

    for (const group of lineGroups) {
      const groupCenterY = group.reduce((sum, b) => sum + (b.y1 + b.y2) / 2, 0) / group.length;
      if (Math.abs(boxCenterY - groupCenterY) < lineThreshold) {
        group.push(box);
        addedToLine = true;
        break;
      }
    }

    if (!addedToLine) {
      lineGroups.push([box]);
    }
  }

  // 上から下の順で行をソート
  lineGroups.sort((lineA, lineB) => {
    const avgYA = lineA.reduce((sum, b) => sum + (b.y1 + b.y2) / 2, 0) / lineA.length;
    const avgYB = lineB.reduce((sum, b) => sum + (b.y1 + b.y2) / 2, 0) / lineB.length;
    return avgYA - avgYB;
  });

  return lineGroups.map((lineBoxes, index) => {
    // 各行内ではX座標（左から右）へソート
    const sortedInLine = [...lineBoxes].sort((a, b) => a.x1 - b.x1);
    return {
      lineIndex: index + 1,
      digits: sortedInLine.map((b) => b.label).join(''),
      boxes: sortedInLine,
    };
  });
}


