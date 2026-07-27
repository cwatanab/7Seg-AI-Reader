import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Sliders, Check, X, Moon, Power, Play } from 'lucide-react';
import {
  loadYoloModel,
  runInference,
  BoundingBox,
  InferenceResult,
} from '../utils/yoloInference';

export const LcdReader: React.FC = () => {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('モデルを準備中...');
  const [modelError, setModelError] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('読み込み中');

  // カメラ & 設定
  const [isStreaming, setIsStreaming] = useState(false);
  const [confThreshold, setConfThreshold] = useState<number>(0.40);
  const [convertMono, setConvertMono] = useState<boolean>(true);
  const zoomLevel = 1.0; // 拡大なし (x1.0)
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // スリープ & カメラ解放ステート
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepReason, setSleepReason] = useState<'timeout' | 'background' | null>(null);
  const lastDetectionTimeRef = useRef<number>(performance.now());

  // 検出ステート
  const [inferenceTime, setInferenceTime] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<InferenceResult | null>(null);

  // 1秒間固定判定 ＆ 4秒自動クローズ ポップアップ設定
  const [popupResult, setPopupResult] = useState<InferenceResult | null>(null);
  const lastDetectedValueRef = useRef<string>('');
  const valueHoldStartTimeRef = useRef<number>(0);
  const lastPoppedValueRef = useRef<string>('');
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(performance.now());
  const frameCount = useRef<number>(0);

  // カメラ停止＆トラック解放
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // スリープモードへ移行
  const enterSleepMode = useCallback(
    (reason: 'timeout' | 'background') => {
      stopCamera();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      setIsSleeping(true);
      setSleepReason(reason);
    },
    [stopCamera]
  );

  // カメラ起動
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
        setIsStreaming(true);
        lastDetectionTimeRef.current = performance.now();
      }
    } catch (err) {
      console.error('Camera access denied or unavailable:', err);
      alert('カメラへのアクセスに失敗しました。ブラウザの設定でカメラのアクセス権限を許可してください。');
    }
  }, []);

  // スリープからの復帰 (Wake up)
  const wakeUp = useCallback(async () => {
    setIsSleeping(false);
    setSleepReason(null);
    lastDetectionTimeRef.current = performance.now();
    await startCamera();
  }, [startCamera]);

  // モデル初期化＆自動カメラ起動
  useEffect(() => {
    let isMounted = true;
    loadYoloModel('/7-segment-digits-yolo26n.onnx', (msg) => {
      if (isMounted) setLoadingMsg(msg);
    })
      .then(({ provider }) => {
        if (isMounted) {
          setModelLoaded(true);
          setProviderName(provider);
          setLoadingMsg('');
          setTimeout(() => {
            startCamera();
          }, 300);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setModelError('モデルの読み込みに失敗しました。ファイルが存在するか確認してください。');
        }
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // カメラデバイスの光学/ハードウェアズーム適用
  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.zoom) {
          const minZ = capabilities.zoom.min || 1;
          const maxZ = capabilities.zoom.max || 4;
          const targetZ = Math.max(minZ, Math.min(maxZ, zoomLevel));
          track.applyConstraints({ advanced: [{ zoom: targetZ } as any] }).catch(() => {});
        }
      }
    }
  }, [zoomLevel, isStreaming]);

  // オーバーレイ描画 (Apple Action Blue #0066cc スタイル)
  const drawDetections = (
    boxes: BoundingBox[],
    videoW: number,
    videoH: number,
    canvas: HTMLCanvasElement,
    imageSource?: HTMLImageElement | HTMLCanvasElement
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const containerW = canvas.parentElement?.clientWidth || videoW;
    const containerH = canvas.parentElement?.clientHeight || videoH;

    canvas.width = containerW;
    canvas.height = containerH;
    ctx.clearRect(0, 0, containerW, containerH);

    const scale = videoW > 0 && videoH > 0 ? Math.max(containerW / videoW, containerH / videoH) : 1;
    const renderedW = videoW * scale;
    const renderedH = videoH * scale;
    const offsetX = (containerW - renderedW) / 2;
    const offsetY = (containerH - renderedH) / 2;

    if (imageSource) {
      ctx.drawImage(imageSource, offsetX, offsetY, renderedW, renderedH);
    }

    boxes.forEach((box) => {
      const nX1 = box.normX1 ?? (videoW > 0 ? Math.max(0, Math.min(1, box.x1 / videoW)) : 0);
      const nY1 = box.normY1 ?? (videoH > 0 ? Math.max(0, Math.min(1, box.y1 / videoH)) : 0);
      const nX2 = box.normX2 ?? (videoW > 0 ? Math.max(0, Math.min(1, box.x2 / videoW)) : 0);
      const nY2 = box.normY2 ?? (videoH > 0 ? Math.max(0, Math.min(1, box.y2 / videoH)) : 0);

      const bx1 = nX1 * renderedW + offsetX;
      const by1 = nY1 * renderedH + offsetY;
      const bw = Math.max(1, (nX2 - nX1) * renderedW);
      const bh = Math.max(1, (nY2 - nY1) * renderedH);

      const lineWidth = Math.max(2, Math.round(Math.min(containerW, containerH) * 0.003));

      // Apple Action Blue (#0066cc) 検出枠
      ctx.strokeStyle = '#0066cc';
      ctx.lineWidth = lineWidth;
      ctx.shadowBlur = 0;
      ctx.strokeRect(bx1, by1, bw, bh);

      // ラベルと信頼度（小さく表示）
      const confidencePercent = Math.round(box.score * 100);
      const labelText = box.label;
      const confText = `${confidencePercent}%`;

      const mainFontSize = Math.max(12, Math.min(16, Math.round(bh * 0.18)));
      const smallFontSize = Math.max(9, Math.round(mainFontSize * 0.72));

      ctx.font = `600 ${mainFontSize}px "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;
      const mainWidth = ctx.measureText(labelText).width;

      ctx.font = `400 ${smallFontSize}px "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;
      const confWidth = ctx.measureText(confText).width;

      const paddingX = 6;
      const paddingY = 3;
      const gap = 4;
      const totalWidth = mainWidth + gap + confWidth;
      const tagHeight = mainFontSize + paddingY * 2;

      const labelY = by1 - tagHeight >= 0 ? by1 - tagHeight : by1;

      // Apple Action Blue (#0066cc) ラベル背景タグ
      ctx.fillStyle = '#0066cc';
      ctx.fillRect(bx1, labelY, totalWidth + paddingX * 2, tagHeight);

      // 主文字 (検出ラベル)
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${mainFontSize}px "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(labelText, bx1 + paddingX, labelY + mainFontSize - 1);

      // 小さな文字 (信頼度 %)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `400 ${smallFontSize}px "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText(confText, bx1 + paddingX + mainWidth + gap, labelY + mainFontSize - 1);
    });
  };

  const isInferringRef = useRef(false);
  const latestResultRef = useRef<InferenceResult | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const targetFpsInterval = 1000 / 5; // 5 FPS 制限 (200ms間隔)

  // 推論ループ
  const processLoop = useCallback(() => {
    if (isSleeping || !videoRef.current || !videoRef.current.videoWidth || !modelLoaded) {
      animationFrameId.current = requestAnimationFrame(processLoop);
      return;
    }

    const now = performance.now();

    // 30秒間未検出チェック (30,000 ms)
    const timeSinceLastDetection = now - lastDetectionTimeRef.current;
    if (timeSinceLastDetection >= 30000) {
      console.log('⏰ 30秒間検出がないため、カメラを解放してスリープへ移行します');
      enterSleepMode('timeout');
      return;
    }

    const elapsed = now - lastProcessTimeRef.current;

    if (elapsed < targetFpsInterval) {
      animationFrameId.current = requestAnimationFrame(processLoop);
      return;
    }
    lastProcessTimeRef.current = now - (elapsed % targetFpsInterval);

    const video = videoRef.current;

    if (canvasRef.current && latestResultRef.current) {
      drawDetections(
        latestResultRef.current.boxes,
        video.videoWidth,
        video.videoHeight,
        canvasRef.current
      );
    }

    // FPS計算
    frameCount.current += 1;
    const delta = now - lastFrameTime.current;
    if (delta >= 1000) {
      setFps(Math.round((frameCount.current * 1000) / delta));
      frameCount.current = 0;
      lastFrameTime.current = now;
    }

    if (!isInferringRef.current) {
      isInferringRef.current = true;
      runInference(video, confThreshold, convertMono)
        .then((res) => {
          latestResultRef.current = res;
          setCurrentResult(res);
          setInferenceTime(res.inferenceTimeMs);

          // ボックス検出があった場合は最終検出タイムスタンプを更新
          if (res.boxes && res.boxes.length > 0) {
            lastDetectionTimeRef.current = performance.now();
          }

          const currentVal = res.digitsString.trim();
          const now = performance.now();

          if (currentVal && currentVal.length > 0) {
            if (currentVal === lastDetectedValueRef.current) {
              const heldDuration = now - valueHoldStartTimeRef.current;

              if (heldDuration >= 1000 && currentVal !== lastPoppedValueRef.current) {
                lastPoppedValueRef.current = currentVal;
                valueHoldStartTimeRef.current = now;
                setPopupResult(res);

                if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
                popupTimerRef.current = setTimeout(() => {
                  setPopupResult(null);
                  lastPoppedValueRef.current = '';
                  valueHoldStartTimeRef.current = performance.now();
                }, 4000);
              }
            } else {
              lastDetectedValueRef.current = currentVal;
              valueHoldStartTimeRef.current = now;
            }
          }
        })
        .catch((e) => {
          console.error('Inference frame error:', e);
        })
        .finally(() => {
          isInferringRef.current = false;
        });
    }

    animationFrameId.current = requestAnimationFrame(processLoop);
  }, [modelLoaded, confThreshold, convertMono, isSleeping, enterSleepMode]);

  // バックグラウンド移行時のカメラ解放 & スリープ処理 (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // タブ非表示・バックグラウンド化時に即座にカメラを解放してスリープへ移行
        enterSleepMode('background');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enterSleepMode]);

  useEffect(() => {
    if (isStreaming && modelLoaded && !isSleeping) {
      animationFrameId.current = requestAnimationFrame(processLoop);
    } else if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isStreaming, modelLoaded, isSleeping, processLoop]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: '#000000',
        overflow: 'hidden',
        zIndex: 100,
      }}
    >
      {/* カメラプレビュー & オーバーレイ (フルスクリーン) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          tabIndex={-1}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          onPause={() => {
            if (videoRef.current && isStreaming) {
              videoRef.current.play().catch(() => {});
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isStreaming ? 'block' : 'none',
            pointerEvents: 'none',
          }}
        />

        {/* バウンディングボックス オーバーレイ */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display: isStreaming || currentResult ? 'block' : 'none',
          }}
        />
      </div>

      {/* 上部中央: 単一カプセル型 2行統合ヘッダーバー */}
      <div
        className="apple-unified-bar"
        style={{
          position: 'absolute',
          top: 'calc(10px + env(safe-area-inset-top, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          height: 'auto',
          padding: '7px 8px 7px 16px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          {/* 1行目: アプリケーションタイトル */}
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--apple-ink)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.3px',
              lineHeight: 1.2,
            }}
          >
            7Seg AI Reader
          </span>

          {/* 2行目: ステータス情報 (FPS / 推論時間 / プロバイダー) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.2,
            }}
          >
            <div className="apple-badge-dot" style={{ width: '6px', height: '6px' }} />
            <span style={{ display: 'inline-block', minWidth: '40px', textAlign: 'left' }}>
              FPS: {fps}
            </span>
            <span style={{ color: 'var(--apple-ink-muted-48)' }}>|</span>
            <span style={{ display: 'inline-block', minWidth: '36px', textAlign: 'right' }}>
              {inferenceTime.toFixed(0)}ms
            </span>
            <span style={{ color: 'var(--apple-ink-muted-48)' }}>|</span>
            <span style={{ color: 'var(--apple-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {providerName}
            </span>
          </div>
        </div>

        {/* 右側: 設定ボタン */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="apple-unified-bar-action"
          aria-label="Settings"
          style={{ width: '30px', height: '30px' }}
        >
          <Sliders size={15} />
        </button>
      </div>

      {/* store-utility-card: Settings Panel */}
      {showSettings && (
        <div
          className="apple-store-utility-card"
          style={{
            position: 'absolute',
            top: 'calc(74px + env(safe-area-inset-top, 0px))',
            right: '16px',
            zIndex: 40,
            width: 'calc(100% - 32px)',
            maxWidth: '360px',
            border: '1px solid var(--apple-hairline)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
            <h3 className="typo-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              <Sliders size={18} color="var(--apple-primary)" /> 検出パラメータ設定
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--apple-ink-muted-48)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: 'var(--spacing-xs)' }}>
                <span className="typo-caption">検出確信度 (Confidence):</span>
                <span className="typo-caption" style={{ fontWeight: 600, color: 'var(--apple-primary)' }}>
                  {Math.round(confThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--apple-primary)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="typo-caption">モノクロ変換フィルター:</span>
              <button
                onClick={() => setConvertMono(!convertMono)}
                className={convertMono ? 'apple-button-primary' : 'apple-button-secondary-pill'}
                style={{
                  padding: '6px 16px',
                  fontSize: '14px',
                }}
              >
                {convertMono ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 初期化中スピナー (ダークテーマ統一 & ブラー) */}
      {!modelLoaded && !modelError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            background: 'rgba(10, 12, 16, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: '48px',
              height: '48px',
              border: '3px solid rgba(255, 255, 255, 0.15)',
              borderTopColor: 'var(--apple-primary)',
              borderRadius: '50%',
              marginBottom: 'var(--spacing-lg)',
            }}
          />
          <div className="typo-body-strong" style={{ textAlign: 'center', color: '#ffffff', fontSize: '16px' }}>
            {loadingMsg || 'モデルを準備中...'}
          </div>
        </div>
      )}

      {/* 確定結果ポップアップ (store-utility-card + apple-product-shadow) */}
      {popupResult && (
        <div
          className="apple-store-utility-card"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 80,
            width: 'calc(100% - 48px)',
            maxWidth: '440px',
            boxShadow: 'var(--apple-product-shadow)',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
            <div className="typo-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', color: 'var(--apple-ink)' }}>
              <Check size={20} color="var(--apple-primary)" /> スキャン完了
            </div>
            <button
              onClick={() => {
                if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
                setPopupResult(null);
                lastPoppedValueRef.current = '';
                valueHoldStartTimeRef.current = performance.now();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--apple-ink-muted-48)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
            {popupResult.lines.map((line) => (
              <div
                key={line.lineIndex}
                className="apple-lcd-display-frame"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '2.5rem', fontWeight: 600, letterSpacing: '2px', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                  {line.digits}
                </span>
              </div>
            ))}
          </div>

          <div style={{ width: '100%', height: '4px', background: 'var(--apple-hairline)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'var(--apple-primary)',
                width: '100%',
                animation: 'shrinkBar 4s linear forwards',
              }}
            />
          </div>
        </div>
      )}

      {/* スリープ状態オーバーレイ (30秒無検出 または バックグラウンド移行) */}
      {isSleeping && (
        <div
          onClick={wakeUp}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 90,
            background: 'rgba(10, 12, 16, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'pointer',
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(0, 102, 204, 0.15)',
              border: '1px solid rgba(0, 102, 204, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              color: '#0066cc',
            }}
          >
            <Moon size={36} />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>
            スリープ中
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.65)', marginBottom: '24px' }}>
            タップしてカメラを再開
          </p>

          <button
            onClick={(e) => {
              e.stopPropagation();
              wakeUp();
            }}
            className="apple-button-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              fontSize: '15px',
              borderRadius: '9999px',
              boxShadow: '0 4px 14px rgba(0, 102, 204, 0.4)',
            }}
          >
            <Play size={18} fill="currentColor" /> 再開する
          </button>
        </div>
      )}
    </div>
  );
};

export default LcdReader;
