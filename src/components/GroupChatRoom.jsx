import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Paperclip, Flame, LogOut, Copy, Check, 
  Hourglass, FileText, Download, Eye, EyeOff, AlertCircle, Users, Smile
} from 'lucide-react';
import { STICKER_PACKS } from '../constants/stickers.js';
import { formatBytes } from '../utils/formatBytes.js';
import InviteQr from './common/InviteQr.jsx';

// Group Message bubble component
function GroupMessageItem({ message, onExpire, onBurn }) {
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
        console.error('Group image URL error:', err);
      }
    }
  }, [message.fileBlob, message.type, message.fileType]);

  useEffect(() => {
    if (!message.timer) return;
    const intervalTime = 100;
    const totalTimeMs = message.timer * 1000;
    let elapsedMs = 0;

    timerIdRef.current = setInterval(() => {
      elapsedMs += intervalTime;
      const remaining = Math.max(0, message.timer - (elapsedMs / 1000));
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

  if (message.sender === 'system') {
    return (
      <div style={{
        alignSelf: 'center',
        margin: '12px 0',
        padding: '6px 14px',
        borderRadius: '99px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: 'var(--text-secondary)',
        fontSize: '0.8rem',
        textAlign: 'center'
      }}>
        {message.content}
      </div>
    );
  }

  const percentage = message.timer ? (timeLeft / message.timer) * 100 : 100;
  const isMe = message.sender === 'me';

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
      console.error('Failed to download group file:', err);
    }
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

  const closeAndBurn = () => {
    if (modalIntervalRef.current) clearInterval(modalIntervalRef.current);
    setModalOpen(false);
    if (onBurn) onBurn(message.id);
  };

  const nickname = isMe ? 'Tú' : (message.nickname || 'Anónimo');
  const userColor = message.color || '#06B6D4';

  return (
    <>
      <div 
        className={`message-bubble-wrapper ${isMe ? 'msg-me' : 'msg-peer'}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMe ? 'flex-end' : 'flex-start',
          margin: '10px 0',
          position: 'relative',
          maxWidth: '78%',
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          animation: 'fadeIn 0.25s ease-out forwards',
        }}
      >
        {/* User Nickname & Badge */}
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
            width: '100%'
          }}
        >
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
                  style={{ padding: '6px 14px', fontSize: '0.75rem', borderRadius: '8px', marginTop: '4px' }}
                >
                  Revelar Foto
                </button>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {imageUrl && (
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
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
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
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--color-secondary)'
                  }}
                  title="Descargar archivo"
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
                display: 'flex', alignItems: 'center', gap: '4px', 
                fontSize: '0.7rem', color: 'var(--color-accent)', 
                marginTop: '6px', justifyContent: 'flex-end', opacity: 0.8 
              }}>
                <Hourglass size={10} />
                <span>Desaparece en {Math.ceil(timeLeft)}s</span>
              </div>
            </>
          )}
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px', padding: '0 4px' }}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(3, 7, 18, 0.95)', backdropFilter: 'blur(20px)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '500px', marginBottom: '20px', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} style={{ color: 'var(--color-secondary)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Foto de un solo uso ({nickname})</span>
            </div>
            <div style={{ background: 'rgba(236, 72, 153, 0.1)', color: 'var(--color-accent)', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: '99px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
              Se destruye en {modalTimer}s
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '500px', maxHeight: '70%', width: '100%' }}>
            {imageUrl && (
              <img src={imageUrl} alt="Foto temporal" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '16px', objectFit: 'contain' }} />
            )}
          </div>
          <button onClick={closeAndBurn} className="btn-glow" style={{ marginTop: '30px', width: '100%', maxWidth: '300px', background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-danger) 100%)' }}>
            Cerrar y Destruir Foto
          </button>
        </div>
      )}
    </>
  );
}

export default function GroupChatRoom({ roomId, groupPeerState, onLeave }) {
  const {
    peerId,
    isHost,
    isConnected,
    isConnecting,
    error,
    messages,
    members,
    typingUsers,
    sendMessage,
    sendFile,
    sendSticker,
    sendTyping,
    burn,
    burnMessage,
    disconnect
  } = groupPeerState;

  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [destructTimer, setDestructTimer] = useState(0);
  const [pendingFile, setPendingFile] = useState(null);
  const [viewOnceChecked, setViewOnceChecked] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [expiredIds, setExpiredIds] = useState(new Set());

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inviteLink = `${window.location.origin}/?room=${roomId}&mode=group&join=true`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (pendingFile) {
      sendFile(pendingFile, destructTimer > 0 ? destructTimer : null, viewOnceChecked);
      setPendingFile(null);
      setViewOnceChecked(false);
    }
    if (inputText.trim()) {
      sendMessage(inputText.trim(), destructTimer > 0 ? destructTimer : null);
      setInputText('');
      sendTyping(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setViewOnceChecked(false);
    }
  };

  const visibleMessages = messages.filter(msg => !expiredIds.has(msg.id));

  return (
    <div className="container flex-center" style={{ height: 'calc(100vh - 40px)', padding: '10px', maxWidth: '950px' }}>
      <div className="glass-panel" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {/* GROUP HEADER */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(10, 15, 30, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Users size={20} style={{ color: 'var(--color-secondary)' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Chat Grupal P2P</h2>
                {isConnected && (
                  <span style={{
                    fontSize: '0.75rem', color: 'var(--color-success)',
                    background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '99px', fontWeight: 600
                  }}>
                    👥 {members.length} {members.length === 1 ? 'persona' : 'personas'}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Sala: <code style={{ color: 'var(--color-secondary)' }}>{roomId}</code>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isConnected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Hourglass size={16} style={{ color: destructTimer > 0 ? 'var(--color-accent)' : 'var(--text-muted)' }} />
                <select
                  aria-label="Temporizador de autodestruccion del grupo"
                  value={destructTimer}
                  onChange={(e) => setDestructTimer(Number(e.target.value))}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  title="Autodestrucción para el grupo"
                >
                  <option value={0}>Guardar (local)</option>
                  <option value={5}>5 segundos</option>
                  <option value={10}>10 segundos</option>
                  <option value={30}>30 segundos</option>
                </select>
              </div>
            )}

            {isConnected && visibleMessages.some(m => m.sender !== 'system') && (
              <button onClick={burn} className="btn-glass" aria-label="Quemar historial del grupo" style={{ padding: '8px 12px', borderRadius: '10px', color: 'var(--color-danger)' }}>
                <Flame size={14} /> Quemar
              </button>
            )}

            <button onClick={onLeave} className="btn-glass" aria-label="Salir del grupo" style={{ padding: '8px 12px', borderRadius: '10px' }}>
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>

        {/* MAIN BODY */}
        {!isConnected ? (
          <div className="flex-center" style={{ flex: 1, flexDirection: 'column', padding: '30px', textAlign: 'center', overflowY: 'auto' }}>
            <div className="pulse-badge flex-center" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', marginBottom: '20px', fontSize: '24px' }}>
              👥
            </div>

            {error ? (
              <div style={{ maxWidth: '450px' }}>
                <h3 style={{ color: 'var(--color-danger)', fontSize: '1.25rem', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <AlertCircle /> Error en el Grupo
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '25px' }}>{error}</p>
                <button onClick={onLeave} className="btn-glow">Regresar al Inicio</button>
              </div>
            ) : isHost ? (
              <div className="fade-in" style={{ maxWidth: '500px', width: '100%' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Esperando integrantes...</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '25px' }}>
                  Comparte este enlace o código QR para que múltiples personas se unan a la sala grupal P2P.
                </p>

                <div className="flex-center" style={{ marginBottom: '20px' }}>
                  <div className="glass-panel flex-center" style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <InviteQr value={inviteLink} alt="QR grupal" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                  <input type="text" readOnly value={inviteLink} aria-label="Enlace de invitacion grupal" className="glass-input" style={{ fontSize: '0.85rem', fontFamily: 'monospace' }} onClick={(e) => e.target.select()} />
                  <button onClick={handleCopyLink} className="btn-glow" aria-label="Copiar enlace de invitacion grupal" style={{ padding: '0 18px', borderRadius: '12px' }}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                {copied && <span style={{ color: 'var(--color-success)', fontSize: '0.8rem', fontWeight: 600 }}>¡Enlace copiado!</span>}
              </div>
            ) : (
              <div className="fade-in" style={{ maxWidth: '500px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '3px solid rgba(6, 182, 212, 0.1)', borderTopColor: 'var(--color-secondary)', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Ingresando a la sala grupal...</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '30px' }}>
                  Conectando con el anfitrión de la sala y sincronizando integrantes.
                </p>
                <button onClick={onLeave} className="btn-glass">Cancelar y Salir</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0, 0, 0, 0.15)' }}>
            
            {/* MEMBERS BADGES TRAY */}
            <div style={{
              padding: '8px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(10, 15, 30, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>Integrantes:</span>
              {members.map((m) => (
                <div key={m.peerId} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 8px',
                  borderRadius: '99px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${m.color}40`,
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.color }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.nickname}</span>
                  {m.isHost && <span style={{ fontSize: '0.65rem', color: 'var(--color-secondary)', opacity: 0.8 }}>(Host)</span>}
                </div>
              ))}
            </div>

            {/* MESSAGES LIST */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              {visibleMessages.map((msg) => (
                <GroupMessageItem 
                  key={msg.id} 
                  message={msg} 
                  onExpire={(id) => setExpiredIds(prev => new Set(prev).add(id))} 
                  onBurn={burnMessage} 
                />
              ))}

              {typingUsers.length > 0 && (
                <div style={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: 'var(--color-secondary)', fontStyle: 'italic', margin: '5px 0' }}>
                  ✏️ {typingUsers.join(', ')} {typingUsers.length === 1 ? 'está escribiendo...' : 'están escribiendo...'}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* PENDING FILE PREVIEW */}
            {pendingFile && (
              <div className="glass-panel fade-in" style={{ margin: '10px 20px 0 20px', padding: '12px 16px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={18} style={{ color: 'var(--color-secondary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{pendingFile.name} ({formatBytes(pendingFile.size)})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {pendingFile.type?.startsWith('image/') && (
                    <button 
                      type="button" 
                      onClick={() => setViewOnceChecked(!viewOnceChecked)}
                      aria-pressed={viewOnceChecked}
                      aria-label="Alternar foto de un solo uso"
                      style={{
                        padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem',
                        color: viewOnceChecked ? 'var(--color-secondary)' : 'var(--text-primary)',
                        background: viewOnceChecked ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: viewOnceChecked ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <Eye size={14} /> {viewOnceChecked ? 'Ver una vez: SÍ' : 'Ver una vez'}
                    </button>
                  )}
                  <button onClick={() => setPendingFile(null)} type="button" aria-label="Cancelar archivo adjunto" style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            )}

            {/* STICKER PICKER */}
            {stickerPickerOpen && (
              <div className="glass-panel fade-in" style={{ margin: '10px 20px 0 20px', padding: '16px', borderRadius: '16px', background: 'rgba(10, 15, 30, 0.85)', maxHeight: '240px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Stickers para el Grupo</span>
                  <button onClick={() => setStickerPickerOpen(false)} aria-label="Cerrar stickers" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cerrar</button>
                </div>
                {Object.keys(STICKER_PACKS).map((pack) => (
                  <div key={pack} style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-secondary)', display: 'block', marginBottom: '6px' }}>
                      {pack === 'Google' ? 'Animados 2D (Google)' : 'Animados 3D (Microsoft)'}
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: '10px' }}>
                      {STICKER_PACKS[pack].map((stk) => (
                        <button key={stk.id} type="button" aria-label={`Enviar sticker ${stk.id}`} onClick={() => sendSticker(stk.url, destructTimer > 0 ? destructTimer : null)} className="sticker-btn" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '6px' }}>
                          <img src={stk.url} alt={stk.alt} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* INPUT FORM */}
            <form onSubmit={handleSend} style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', background: 'rgba(10, 15, 30, 0.4)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} aria-label="Adjuntar archivo al grupo" style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-glass flex-center" aria-label="Adjuntar archivo al grupo" style={{ width: '46px', height: '46px', borderRadius: '12px' }}>
                <Paperclip size={18} />
              </button>
              <button type="button" onClick={() => setStickerPickerOpen(!stickerPickerOpen)} className="btn-glass flex-center" aria-label={stickerPickerOpen ? 'Cerrar stickers' : 'Abrir stickers'} aria-expanded={stickerPickerOpen} style={{ width: '46px', height: '46px', borderRadius: '12px', color: stickerPickerOpen ? 'var(--color-secondary)' : 'var(--text-primary)' }}>
                <Smile size={18} />
              </button>
              <input 
                type="text" 
                placeholder="Enviar mensaje a todos los integrantes..." 
                className="glass-input" 
                aria-label="Mensaje para el grupo"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  sendTyping(e.target.value.length > 0);
                }}
                onBlur={() => sendTyping(false)}
                style={{ borderRadius: '12px', height: '46px' }} 
              />
              <button type="submit" disabled={!inputText.trim() && !pendingFile} className="btn-glow flex-center" aria-label="Enviar mensaje al grupo" style={{ width: '46px', height: '46px', borderRadius: '12px' }}>
                <Send size={18} />
              </button>
            </form>

          </div>
        )}

      </div>
    </div>
  );
}
