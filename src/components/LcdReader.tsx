import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  loadYoloModel,
  runInference,
  InferenceResult,
} from '../utils/yoloInference';
import { drawDetections } from '../utils/canvasUtils';
import { HeaderBar } from './HeaderBar';
import { SettingsPanel } from './SettingsPanel';
import { SleepOverlay } from './SleepOverlay';
import { DetectionPopup } from './DetectionPopup';

export const LcdReader: React.FC = () => {
  // モデル＆表示状態
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('モデルを準備中...');
  const [modelError, setModelError] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('読み込み中');

  // カメラ & 設定
  const [isStreaming, setIsStreaming] = useState(false);
  const [confThreshold, setConfThreshold] = useState<number>(0.40);
  const [convertMono, setConvertMono] = useState<boolean>(true);
  const zoomLevel = 1.0;
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // スリープ & カメラ解放ステート
  const [isSleeping, setIsSleeping] = useState(false);
  const lastDetectionTimeRef = useRef<number>(performance.now());

  // 検出ステート
  const [inferenceTime, setInferenceTime] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<InferenceResult | null>(null);

  // 固定判定 ポップアップステート
  const [popupResult, setPopupResult] = useState<InferenceResult | null>(null);
  const lastDetectedValueRef = useRef<string>('');
  const valueHoldStartTimeRef = useRef<number>(0);
  const lastPoppedValueRef = useRef<string>('');
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DOM Refs & Animation Frame
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
  const enterSleepMode = useCallback(() => {
    stopCamera();
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    setIsSleeping(true);
  }, [stopCamera]);

  // カメラ起動
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
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

  // スリープからの復帰
  const wakeUp = useCallback(async () => {
    setIsSleeping(false);
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

  // ハードウェアズーム制御
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

  const isInferringRef = useRef(false);
  const latestResultRef = useRef<InferenceResult | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const targetFpsInterval = 1000 / 5; // 5 FPS (200ms間隔)

  // 推論ループ
  const processLoop = useCallback(() => {
    if (isSleeping || !videoRef.current || !videoRef.current.videoWidth || !modelLoaded) {
      animationFrameId.current = requestAnimationFrame(processLoop);
      return;
    }

    const now = performance.now();

    // 30秒間未検出チェック
    if (now - lastDetectionTimeRef.current >= 30000) {
      console.log('⏰ 30秒間未検出のためスリープ移行');
      enterSleepMode();
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

          if (res.boxes && res.boxes.length > 0) {
            lastDetectionTimeRef.current = performance.now();
          }

          const currentVal = res.digitsString.trim();
          const inferNow = performance.now();

          if (currentVal && currentVal.length > 0) {
            if (currentVal === lastDetectedValueRef.current) {
              const heldDuration = inferNow - valueHoldStartTimeRef.current;

              if (heldDuration >= 1000 && currentVal !== lastPoppedValueRef.current) {
                lastPoppedValueRef.current = currentVal;
                valueHoldStartTimeRef.current = inferNow;
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
              valueHoldStartTimeRef.current = inferNow;
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

  // バックグラウンド移行イベント (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        enterSleepMode();
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
      {/* カメラプレビュー & バウンディングボックス Canvas */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
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

        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display: isStreaming || currentResult ? 'block' : 'none',
          }}
        />
      </div>

      {/* ヘッダーバー (2行統合単一カプセル) */}
      <HeaderBar
        fps={fps}
        inferenceTime={inferenceTime}
        providerName={providerName}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />

      {/* パラメータ設定パネル */}
      {showSettings && (
        <SettingsPanel
          confThreshold={confThreshold}
          onConfThresholdChange={setConfThreshold}
          convertMono={convertMono}
          onToggleMono={() => setConvertMono(!convertMono)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* モデル読み込み中オーバーレイ */}
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

      {/* モデル読み込みエラー表示 */}
      {modelError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 55,
            background: 'rgba(10, 12, 16, 0.96)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            color: '#ff4d4f',
            textAlign: 'center',
          }}
        >
          <div className="typo-body-strong" style={{ fontSize: '16px', maxWidth: '320px' }}>
            {modelError}
          </div>
        </div>
      )}

      {/* スキャン確定判定ポップアップ */}
      {popupResult && (
        <DetectionPopup
          popupResult={popupResult}
          onClose={() => {
            if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
            setPopupResult(null);
            lastPoppedValueRef.current = '';
            valueHoldStartTimeRef.current = performance.now();
          }}
        />
      )}

      {/* スリープ状態オーバーレイ */}
      {isSleeping && <SleepOverlay onWakeUp={wakeUp} />}
    </div>
  );
};

export default LcdReader;
