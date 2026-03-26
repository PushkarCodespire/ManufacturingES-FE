import React, { useState, useEffect } from 'react';
import { WifiOutlined, DisconnectOutlined } from '@ant-design/icons';

/**
 * OfflineIndicator — fixed bottom banner shown when the browser loses network.
 * Disappears automatically when connectivity is restored.
 */
const OfflineIndicator = () => {
  const [isOnline, setIsOnline]   = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showBack, setShowBack]   = useState(false);

  useEffect(() => {
    const handleOnline  = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowBack(true);
        setTimeout(() => setShowBack(false), 3000);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline && !showBack) return null;

  return (
    <div
      style={{
        position:       'fixed',
        bottom:         16,
        left:           '50%',
        transform:      'translateX(-50%)',
        zIndex:         9999,
        borderRadius:   24,
        padding:        '10px 20px',
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        fontSize:       13,
        fontWeight:     500,
        boxShadow:      '0 4px 16px rgba(0,0,0,0.18)',
        whiteSpace:     'nowrap',
        transition:     'all 0.3s',
        background:     isOnline ? '#16a34a' : '#1f2937',
        color:          '#ffffff',
      }}
    >
      {isOnline ? (
        <>
          <WifiOutlined style={{ fontSize: 15 }} />
          Back online
        </>
      ) : (
        <>
          <DisconnectOutlined style={{ fontSize: 15 }} />
          You are offline — some features may be unavailable
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
