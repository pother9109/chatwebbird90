import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Paperclip, Shield, Flame, LogOut, Copy, Check, 
  Hourglass, FileText, Download, CheckCheck, HelpCircle, EyeOff, AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Simple synthesizer for audio feedback without external assets
const playTone = (freq, type, duration) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio context blocked or not supported
  }
};

// Formatter for file size
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Disappearing message wrapper component to handle countdown timers
function DisappearingMessage({ message, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(message.timer);
  const timerIdRef = useRef(null);

  useEffect(() => {
    if (!message.timer) return;

    const intervalTime = 100; // Tick every 100ms for smooth progress bar
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

  const percentage = message.timer ? (timeLeft / message.timer) * 100 : 100;

  const isMe = message.sender === 'me';

  const downloadFile = () => {
    if (!message.fileBlob) return;
    const url = URL.createObjectURL(message.fileBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = message.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className={`message-bubble-wrapper ${isMe ? 'msg-me' : 'msg-peer'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMe ? 'flex-end' : 'flex-start',
        margin: '10px 0',
        position: 'relative',
        maxWidth: '75%',
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        animation: 'fadeIn 0.25s ease-out forwards',
      }}
    >
      <div 
        className="glass-panel"
        style={{
          padding: '12px 16px',
          borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
          background: isMe 
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0.1) 100%)' 
            : 'rgba(255, 255, 255, 0.05)',
          borderColor: isMe ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)',
          boxShadow: isMe ? '0 4px 15px rgba(139, 92, 246, 0.1)' : 'none',
          position: 'relative',
          overflow: 'hidden',
          width: '100%'
        }}
      >
        {/* Render text or file content */}
        {message.type === 'text' ? (
          <p style={{ wordBreak: 'break-word', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{message.content}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* If image, show preview */}
            {message.fileType?.startsWith('image/') && message.fileBlob ? (
              <img 
                src={URL.createObjectURL(message.fileBlob)} 
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
              >
                <Download size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Self-destruct indicator and progress bar */}
        {message.timer && (
          <>
            <div 
              className="msg-timer-bar" 
              style={{ width: `${percentage}%` }}
            />
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
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px', padding: '0 4px' }}>
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}

export default function ChatRoom({ roomId, peerState, onLeave }) {
  const {
    peerId,
    isConnected,
    isConnecting,
    isPeerTyping,
    error,
    messages,
    sendMessage,
    sendFile,
    sendTyping,
    burn,
    disconnect
  } = peerState;

  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [destructTimer, setDestructTimer] = useState(0); // 0 means disabled
  const [dragOver, setDragOver] = useState(false);
  const [expiredIds, setExpiredIds] = useState(new Set());

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const inviteLink = `${window.location.origin}/?room=${roomId}&join=true`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=255-255-255&bgcolor=10-15-30&data=${encodeURIComponent(inviteLink)}`;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  // Audio trigger on connection & message
  const prevMessagesLength = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      const latestMsg = messages[messages.length - 1];
      if (latestMsg.sender === 'peer') {
        if (latestMsg.type === 'status') {
          playTone(523.25, 'sine', 0.2); // C5 tone for connection
          confetti({
            particleCount: 80,
            spread: 50,
            origin: { y: 0.6 },
            colors: ['#8b5cf6', '#06b6d4', '#ec4899']
          });
        } else {
          playTone(659.25, 'sine', 0.1); // E5 chime for new text
        }
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  const handleSendText = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    sendMessage(inputText.trim(), destructTimer > 0 ? destructTimer : null);
    setInputText('');
    handleTyping(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sendFile(file, destructTimer > 0 ? destructTimer : null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTyping = (typing) => {
    if (typing) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendTyping(false);
      }, 2000);
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        sendTyping(false);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Drag and Drop files
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      sendFile(file, destructTimer > 0 ? destructTimer : null);
    }
  };

  const handleExpireMessage = (msgId) => {
    setExpiredIds((prev) => {
      const next = new Set(prev);
      next.add(msgId);
      return next;
    });
  };

  // Filter out expired messages
  const visibleMessages = messages.filter(msg => !expiredIds.has(msg.id));

  return (
    <div 
      className="container flex-center" 
      style={{ 
        height: 'calc(100vh - 40px)', 
        padding: '10px',
        maxWidth: '900px'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div 
        className="glass-panel" 
        style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          borderColor: dragOver ? 'var(--color-secondary)' : 'var(--glass-border)',
          boxShadow: dragOver ? '0 0 25px rgba(6, 182, 212, 0.2)' : 'var(--glass-shadow)'
        }}
      >
        
        {/* DRAG OVER OVERLAY */}
        {dragOver && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px',
            color: 'var(--color-secondary)',
            border: '2px dashed var(--color-secondary)',
            borderRadius: '24px',
            margin: '10px',
            pointerEvents: 'none'
          }}>
            <Paperclip size={48} className="pulse-badge" style={{ padding: '10px', borderRadius: '50%' }} />
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Suelta tu archivo aquí</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Se enviará directamente al otro navegador de forma cifrada.</p>
          </div>
        )}

        {/* HEADER */}
        <div style={{ 
          padding: '18px 24px', 
          borderBottom: '1px solid var(--glass-border)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Title & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '24px' }}>👻</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>GhostRoom</h2>
                {isConnected && (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    color: 'var(--color-success)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '3px 8px',
                    borderRadius: '99px',
                    fontWeight: 600
                  }}>
                    <Shield size={10} /> P2P
                  </span>
                )}
              </div>
              <p style={{ 
                fontSize: '0.75rem', 
                color: isConnected ? 'var(--color-success)' : isConnecting ? 'var(--color-secondary)' : 'var(--text-secondary)'
              }}>
                {isConnected 
                  ? 'Conexión segura P2P' 
                  : isConnecting 
                    ? 'Esperando conexión...' 
                    : 'Estableciendo sala...'
                }
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Destruct Timer Selector */}
            {isConnected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Hourglass size={16} style={{ color: destructTimer > 0 ? 'var(--color-accent)' : 'var(--text-muted)' }} />
                <select
                  value={destructTimer}
                  onChange={(e) => setDestructTimer(Number(e.target.value))}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-primary)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                  title="Temporizador de autodestrucción de mensajes"
                >
                  <option value={0}>Guardar (local)</option>
                  <option value={5}>Autodestruir en 5s</option>
                  <option value={10}>Autodestruir en 10s</option>
                  <option value={30}>Autodestruir en 30s</option>
                  <option value={60}>Autodestruir en 1m</option>
                </select>
              </div>
            )}

            {/* Burn All Button */}
            {isConnected && visibleMessages.some(m => m.sender !== 'system') && (
              <button
                onClick={burn}
                className="btn-glass"
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
                title="Quemar historial para ambos"
              >
                <Flame size={14} />
                Quemar
              </button>
            )}

            {/* Exit Room */}
            <button
              onClick={onLeave}
              className="btn-glass"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem'
              }}
            >
              <LogOut size={14} />
              Salir
            </button>
          </div>
        </div>

        {/* MAIN BODY: WAITING OR CHAT */}
        {!isConnected ? (
          /* WAITING / SHARING SCREEN */
          <div className="flex-center" style={{ 
            flex: 1, 
            flexDirection: 'column', 
            padding: '30px', 
            textAlign: 'center',
            overflowY: 'auto' 
          }}>
            <div className="pulse-badge flex-center" style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(6, 182, 212, 0.1)',
              color: 'var(--color-secondary)',
              border: '1px solid var(--color-secondary)',
              marginBottom: '20px',
              fontSize: '24px'
            }}>
              📡
            </div>

            {error ? (
              <div style={{ maxWidth: '450px' }}>
                <h3 style={{ color: 'var(--color-danger)', fontSize: '1.25rem', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <AlertCircle /> Error en la sala
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '25px' }}>
                  {error}
                </p>
                <button onClick={onLeave} className="btn-glow">Regresar al Inicio</button>
              </div>
            ) : (
              <div className="fade-in" style={{ maxWidth: '500px', width: '100%' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Esperando a la otra persona...</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '30px' }}>
                  Para iniciar la conexión directa P2P, comparte este enlace de invitación. La sala se activará automáticamente al ingresar el otro participante.
                </p>

                {/* QR Code Container */}
                <div className="flex-center" style={{ marginBottom: '25px' }}>
                  <div className="glass-panel flex-center" style={{
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                  }}>
                    <img 
                      src={qrCodeUrl} 
                      alt="Código QR de invitación" 
                      style={{ 
                        width: '140px', 
                        height: '140px', 
                        borderRadius: '8px',
                        display: 'block' 
                      }} 
                    />
                  </div>
                </div>

                {/* Link Box */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="glass-input"
                    style={{ fontSize: '0.85rem', fontFamily: 'monospace', textOverflow: 'ellipsis' }}
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="btn-glow"
                    style={{ padding: '0 18px', borderRadius: '12px', flexShrink: 0 }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                {copied && (
                  <span style={{ color: 'var(--color-success)', fontSize: '0.8rem', fontWeight: 600 }}>
                    ¡Enlace de invitación copiado!
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* SECURE CHAT SCREEN */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0, 0, 0, 0.15)' }}>
            
            {/* MESSAGES LIST */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '20px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              
              {visibleMessages.length === 0 ? (
                /* Empty state */
                <div className="flex-center" style={{ flex: 1, flexDirection: 'column', color: 'var(--text-muted)', gap: '10px' }}>
                  <EyeOff size={32} />
                  <p style={{ fontSize: '0.9rem' }}>El chat está vacío. Los mensajes no se guardarán en ningún lugar.</p>
                </div>
              ) : (
                visibleMessages.map((msg) => {
                  if (msg.type === 'status') {
                    return (
                      <div 
                        key={msg.id} 
                        style={{ 
                          alignSelf: 'center', 
                          margin: '15px 0', 
                          fontSize: '0.8rem',
                          color: 'var(--color-secondary)',
                          background: 'rgba(6, 182, 212, 0.06)',
                          padding: '6px 14px',
                          borderRadius: '99px',
                          border: '1px solid rgba(6, 182, 212, 0.1)',
                          textAlign: 'center',
                          maxWidth: '85%'
                        }}
                      >
                        {msg.content}
                      </div>
                    );
                  }
                  
                  return (
                    <DisappearingMessage 
                      key={msg.id} 
                      message={msg} 
                      onExpire={handleExpireMessage} 
                    />
                  );
                })
              )}

              {/* Typing indicator */}
              {isPeerTyping && (
                <div style={{ 
                  alignSelf: 'flex-start', 
                  margin: '10px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '8px 14px',
                  borderRadius: '12px 12px 12px 2px',
                  border: '1px solid rgba(255, 255, 255, 0.04)'
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Escribiendo</span>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '10px' }}>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* MESSAGE INPUT BAR */}
            <form 
              onSubmit={handleSendText}
              style={{ 
                padding: '16px 20px', 
                borderTop: '1px solid var(--glass-border)',
                background: 'rgba(10, 15, 30, 0.4)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              {/* File Attachment Input (hidden) */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-glass flex-center"
                style={{ 
                  width: '46px', 
                  height: '46px', 
                  padding: 0, 
                  borderRadius: '12px',
                  flexShrink: 0,
                  borderColor: 'rgba(255,255,255,0.1)'
                }}
                title="Adjuntar archivo P2P (imágenes, documentos...)"
              >
                <Paperclip size={18} />
              </button>

              {/* Text Input */}
              <input
                type="text"
                placeholder="Escribe un mensaje de forma segura..."
                className="glass-input"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  handleTyping(e.target.value.length > 0);
                }}
                onBlur={() => handleTyping(false)}
                style={{ borderRadius: '12px', height: '46px' }}
                id="input-chat-message"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="btn-glow flex-center"
                style={{ 
                  width: '46px', 
                  height: '46px', 
                  padding: 0, 
                  borderRadius: '12px',
                  flexShrink: 0
                }}
              >
                <Send size={18} />
              </button>
            </form>

          </div>
        )}

      </div>
    </div>
  );
}
