import React from 'react';
import { Sliders } from 'lucide-react';

interface HeaderBarProps {
  fps: number;
  inferenceTime: number;
  providerName: string;
  showSettings: boolean;
  onToggleSettings: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  fps,
  inferenceTime,
  providerName,
  showSettings,
  onToggleSettings,
}) => {
  return (
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
          デジタルメーター読取
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
        onClick={onToggleSettings}
        className="apple-unified-bar-action"
        aria-label="Settings"
        style={{ width: '30px', height: '30px' }}
      >
        <Sliders size={15} />
      </button>
    </div>
  );
};
