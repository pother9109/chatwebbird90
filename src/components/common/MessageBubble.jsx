import React, { useEffect, useRef, useState } from 'react';
import { Download, Eye, EyeOff, FileText, Hourglass, Reply } from 'lucide-react';
import { formatBytes } from '../../utils/formatBytes.js';
import { REACTION_OPTIONS } from '../../utils/messageInteractions.js';

export default function MessageBubble({
  message,
  onExpire,
  onBurn,
  showAuthor = false,
  isSelected = false,
  onSelect,
  onReply,
  onReact
}) {
  const [timeLeft, setTimeLeft] = useState(message.timer);
  const [imageUrl, setImageUrl] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTimer, setModalTimer] = useState(10);
  const timerIdRef = useRef(null);
  const modalIntervalRef = useRef(null);

  useEffect(() => {
    if (message.type === 'file' && message.fileType?.startsWith('image/') && message.fileBlob) {
      try {
        const url = URL.createObjectURL(message.fileBlob);
        setImageUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to create Object URL for image:', err);
      }
    }

    setImageUrl(null);
    return undefined;
  }, [message.fileBlob, message.type, message.fileType]);

  useEffect(() => {
    if (!message.timer) return undefined;

    const intervalTime = 100;
    const totalTimeMs = message.timer * 1000;
    let elapsedMs = 0;

    timerIdRef.current = setInterval(() => {
      elapsedMs += intervalTime;
      const remaining = Math.max(0, message.timer - elapsedMs / 1000);
      setTimeLeft(remaining);

      if (elapsedMs >= totalTimeMs) {
        clearInterval(timerIdRef.current);
        onExpire(message.id);
      }
    }, intervalTime);

    return () => {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
    };
  }, [message.timer, message.id, onExpire]);

  useEffect(() => () => {
    if (modalIntervalRef.current) clearInterval(modalIntervalRef.current);
  }, []);

  if (message.sender === 'system') {
    return (
      <div style={{
        alignSelf: 'center',
        margin: '12px 0',
        padding: '6px 14px',
        borderRadius: '99px',
        background: showAuthor ? 'rgba(255, 255, 255, 0.04)' : 'rgba(6, 182, 212, 0.06)',
        border: showAuthor ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(6, 182, 212, 0.1)',
        color: showAuthor ? 'var(--text-secondary)' : 'var(--color-secondary)',
        fontSize: '0.8rem',
        textAlign: 'center',
        maxWidth: '85%'
      }}>
        {message.content}
      </div>
    );
  }

  const isMe = message.sender === 'me';
  const percentage = message.timer ? (timeLeft / message.timer) * 100 : 100;
  const nickname = isMe ? 'Tu' : (message.nickname || 'Anonimo');
  const userColor = message.color || '#06B6D4';
  const maxWidth = showAuthor ? '78%' : '75%';
  const reactionEntries = Object.entries(message.reactions || {})
    .map(([emoji, actors]) => [emoji, Object.keys(actors || {}).length])
    .filter(([, count]) => count > 0);
  const canInteract = Boolean(onSelect || onReply || onReact);

  const downloadFile = () => {
    if (!message.fileBlob) return;
    try {
      const url = URL.createObjectURL(message.fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = message.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const closeAndBurn = () => {
    if (modalIntervalRef.current) clearInterval(modalIntervalRef.current);
    setModalOpen(false);
    if (onBurn) onBurn(message.id);
  };

  const openModal = () => {
    setModalOpen(true);
    setModalTimer(10);
    if (modalIntervalRef.current) clearInterval(modalIntervalRef.current);
    modalIntervalRef.current = setInterval(() => {
      setModalTimer((prev) => {
        if (prev <= 1) {
          clearInterval(modalIntervalRef.current);
          closeAndBurn();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <>
      <div
        className={`message-bubble-wrapper ${isMe ? 'msg-me' : 'msg-peer'}`}
        onClick={() => onSelect?.(message)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMe ? 'flex-end' : 'flex-start',
          margin: '10px 0',
          position: 'relative',
          maxWidth,
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          animation: 'fadeIn 0.25s ease-out forwards',
          cursor: canInteract ? 'pointer' : 'default',
        }}
      >
        {showAuthor && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: userColor
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: userColor,
              display: 'inline-block'
            }} />
            <span>{nickname}</span>
          </div>
        )}

        <div
          className="glass-panel"
          style={{
            padding: message.type === 'sticker' ? '0' : '12px 16px',
            borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
            background: message.type === 'sticker'
              ? 'transparent'
              : isMe
                ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0.1) 100%)'
                : 'rgba(255, 255, 255, 0.05)',
            borderColor: message.type === 'sticker' ? 'transparent' : isMe ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)',
            boxShadow: message.type === 'sticker' ? 'none' : isMe ? '0 4px 15px rgba(139, 92, 246, 0.1)' : 'none',
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            outline: isSelected ? '1px solid rgba(6, 182, 212, 0.45)' : 'none'
          }}
        >
          {message.replyTo && (
            <div style={{
              padding: '7px 10px',
              marginBottom: message.type === 'sticker' ? '8px' : '10px',
              borderLeft: '3px solid var(--color-secondary)',
              borderRadius: '8px',
              background: 'rgba(6, 182, 212, 0.08)',
              maxWidth: '100%'
            }}>
              <span style={{ display: 'block', color: 'var(--color-secondary)', fontSize: '0.72rem', fontWeight: 800 }}>
                {message.replyTo.label || 'Mensaje'}
              </span>
              <span style={{
                display: 'block',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {message.replyTo.text}
              </span>
            </div>
          )}

          {message.type === 'text' ? (
            <p style={{ wordBreak: 'break-word', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{message.content}</p>
          ) : message.type === 'sticker' ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '5px 0' }}>
              <img
                src={message.content}
                alt="Sticker"
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'contain',
                  animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              />
            </div>
          ) : message.viewOnceBurned ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', color: 'var(--text-secondary)' }}>
              <EyeOff size={16} />
              <span style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>Foto vista y autodestruida</span>
            </div>
          ) : message.viewOnce ? (
            isMe ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', color: 'var(--text-secondary)' }}>
                <Eye size={16} />
                <span style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>Foto de un solo uso (Enviada)</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', padding: '6px 0' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(6, 182, 212, 0.1)',
                  color: 'var(--color-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(6, 182, 212, 0.2)'
                }}>
                  <Eye size={18} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>Foto de un solo uso</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Toca para revelarla
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openModal}
                  className="btn-glow"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    borderRadius: '8px',
                    boxShadow: showAuthor ? undefined : '0 4px 10px rgba(6, 182, 212, 0.2)',
                    marginTop: '4px'
                  }}
                >
                  Revelar Foto
                </button>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={message.fileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
              ) : null}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={18} style={{ color: 'var(--color-secondary)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {message.fileName}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {formatBytes(message.fileSize)}
                  </span>
                </div>
                <button
                  onClick={downloadFile}
                  type="button"
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.2)',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-secondary)',
                    transition: 'var(--transition-smooth)'
                  }}
                  title="Descargar archivo"
                  aria-label="Descargar archivo"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          )}

          {message.timer && !message.viewOnce && (
            <>
              <div className="msg-timer-bar" style={{ width: `${percentage}%` }} />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.7rem',
                color: 'var(--color-accent)',
                marginTop: '6px',
                justifyContent: 'flex-end',
                opacity: 0.8
              }}>
                <Hourglass size={10} />
                <span>Desaparece en {Math.ceil(timeLeft)}s</span>
              </div>
            </>
          )}
        </div>

        {reactionEntries.length > 0 && (
          <div style={{
            display: 'inline-flex',
            gap: '4px',
            alignItems: 'center',
            marginTop: '-2px',
            padding: '3px 6px',
            borderRadius: '99px',
            background: 'rgba(10, 15, 30, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.22)'
          }}>
            {reactionEntries.map(([emoji, count]) => (
              <span key={emoji} style={{ fontSize: '0.78rem', lineHeight: 1 }}>
                {emoji}{count > 1 ? ` ${count}` : ''}
              </span>
            ))}
          </div>
        )}

        {isSelected && (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              marginTop: '7px',
              padding: '5px',
              borderRadius: '99px',
              background: 'rgba(10, 15, 30, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 22px rgba(0,0,0,0.25)'
            }}
          >
            {REACTION_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact?.(message.id, emoji)}
                aria-label={`Reaccionar con ${emoji}`}
                title={`Reaccionar con ${emoji}`}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1
                }}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onReply?.(message)}
              aria-label="Responder mensaje"
              title="Responder"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                background: 'rgba(6, 182, 212, 0.08)',
                color: 'var(--color-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Reply size={15} />
            </button>
          </div>
        )}

        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px', padding: '0 4px' }}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(3, 7, 18, 0.95)',
          backdropFilter: 'blur(20px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '500px',
            marginBottom: '20px',
            color: 'var(--text-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} style={{ color: 'var(--color-secondary)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                Foto de un solo uso{showAuthor ? ` (${nickname})` : ''}
              </span>
            </div>
            <div style={{
              background: 'rgba(236, 72, 153, 0.1)',
              color: 'var(--color-accent)',
              border: '1px solid rgba(236, 72, 153, 0.2)',
              borderRadius: '99px',
              padding: '4px 12px',
              fontSize: '0.8rem',
              fontWeight: 700
            }}>
              Se destruye en {modalTimer}s
            </div>
          </div>

          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '500px',
            maxHeight: '70%',
            width: '100%',
            position: 'relative'
          }}>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Foto temporal"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  borderRadius: '16px',
                  objectFit: 'contain',
                  boxShadow: showAuthor ? undefined : '0 10px 30px rgba(0,0,0,0.5)',
                  border: showAuthor ? undefined : '1px solid rgba(255,255,255,0.1)'
                }}
              />
            )}
          </div>

          <button
            onClick={closeAndBurn}
            className="btn-glow"
            style={{
              marginTop: '30px',
              width: '100%',
              maxWidth: '300px',
              background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-danger) 100%)',
              boxShadow: showAuthor ? undefined : '0 4px 15px rgba(236, 72, 153, 0.3)'
            }}
          >
            Cerrar y Destruir Foto
          </button>
        </div>
      )}
    </>
  );
}
