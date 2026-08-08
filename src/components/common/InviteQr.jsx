import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function InviteQr({ value, alt = 'Codigo QR de invitacion' }) {
  const [qrSrc, setQrSrc] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;

    setHasError(false);
    setQrSrc('');

    QRCode.toDataURL(value, {
      width: 180,
      margin: 1,
      color: {
        dark: '#f8fafc',
        light: '#0a0f1e'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (active) setQrSrc(url);
      })
      .catch((err) => {
        console.error('Failed to generate local QR code:', err);
        if (active) setHasError(true);
      });

    return () => {
      active = false;
    };
  }, [value]);

  if (hasError) {
    return (
      <div className="qr-fallback" role="img" aria-label={alt}>
        QR
      </div>
    );
  }

  return qrSrc ? (
    <img
      src={qrSrc}
      alt={alt}
      className="invite-qr"
      width="140"
      height="140"
    />
  ) : (
    <div className="qr-fallback" aria-hidden="true" />
  );
}
