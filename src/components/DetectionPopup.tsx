import React from 'react';
import { Check, X } from 'lucide-react';
import { InferenceResult } from '../utils/yoloInference';

interface DetectionPopupProps {
  popupResult: InferenceResult;
  onClose: () => void;
}

export const DetectionPopup: React.FC<DetectionPopupProps> = ({ popupResult, onClose }) => {
  return (
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
          onClick={onClose}
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
  );
};
