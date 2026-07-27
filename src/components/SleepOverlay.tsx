import React from 'react';
import { Moon, Play } from 'lucide-react';

interface SleepOverlayProps {
  onWakeUp: () => void;
}

export const SleepOverlay: React.FC<SleepOverlayProps> = ({ onWakeUp }) => {
  return (
    <div
      onClick={onWakeUp}
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
          onWakeUp();
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
  );
};
