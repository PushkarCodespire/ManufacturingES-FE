import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { MobileOutlined, CloseOutlined } from '@ant-design/icons';

const DISMISSED_KEY = 'pwa_install_dismissed';

/**
 * PwaInstallPrompt — bottom slide-in card that prompts the user to install
 * the app to their home screen. Uses the browser's beforeinstallprompt event.
 *
 * - Shown once per session (dismissed state persists in sessionStorage)
 * - Hides itself if the app is already installed (display-mode: standalone)
 * - Hides on iOS (no beforeinstallprompt support) — shows manual tip instead
 */
const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible,        setVisible]        = useState(false);
  const [isIos,          setIsIos]          = useState(false);
  const [installing,     setInstalling]     = useState(false);

  useEffect(() => {
    // Already installed as standalone PWA — no prompt needed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Already dismissed this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (ios) {
      setIsIos(true);
      setVisible(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
    setInstalling(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position:        'fixed',
        bottom:          20,
        left:            '50%',
        transform:       'translateX(-50%)',
        zIndex:          9998,
        width:           'min(420px, calc(100vw - 32px))',
        background:      '#1d4ed8',
        borderRadius:    16,
        padding:         '14px 16px',
        boxShadow:       '0 8px 24px rgba(29,78,216,0.35)',
        display:         'flex',
        alignItems:      'center',
        gap:             12,
        color:           '#ffffff',
        animation:       'slideUp 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <MobileOutlined style={{ fontSize: 28, flexShrink: 0, opacity: 0.9 }} />

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Install Dynatech ONE</div>
        {isIos ? (
          <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.4, marginTop: 2 }}>
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install
          </div>
        ) : (
          <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.4, marginTop: 2 }}>
            Add to home screen for faster access — works offline too
          </div>
        )}
      </div>

      {!isIos && (
        <Button
          size="small"
          loading={installing}
          onClick={handleInstall}
          style={{
            background:   '#ffffff',
            color:        '#1d4ed8',
            borderColor:  'transparent',
            fontWeight:   600,
            borderRadius: 8,
            flexShrink:   0,
          }}
        >
          Install
        </Button>
      )}

      <CloseOutlined
        onClick={handleDismiss}
        style={{ fontSize: 13, opacity: 0.7, cursor: 'pointer', flexShrink: 0 }}
      />
    </div>
  );
};

export default PwaInstallPrompt;
