import React from 'react';
import { Sliders, X } from 'lucide-react';

interface SettingsPanelProps {
  confThreshold: number;
  onConfThresholdChange: (val: number) => void;
  convertMono: boolean;
  onToggleMono: () => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  confThreshold,
  onConfThresholdChange,
  convertMono,
  onToggleMono,
  onClose,
}) => {
  return (
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
          onClick={onClose}
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
            onChange={(e) => onConfThresholdChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--apple-primary)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="typo-caption">モノクロ変換フィルター:</span>
          <button
            onClick={onToggleMono}
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
  );
};
