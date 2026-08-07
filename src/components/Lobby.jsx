import React, { useState, useEffect } from 'react';
import { Shield, Hourglass, Paperclip, Flame, ArrowRight, Sparkles, AlertCircle, Copy, Check } from 'lucide-react';

const ADJECTIVES = [
  'etereo', 'fantasma', 'silencioso', 'secreto', 'veloz', 'oculto', 
  'fugaz', 'mistico', 'cosmico', 'cuantico', 'brillante', 'nomada', 
  'astral', 'efimero', 'oculto', 'silvestre', 'sombrio', 'clandestino'
];

const NOUNS = [
  'dragon', 'lobo', 'zorro', 'panda', 'fenix', 'nebula', 'galaxia', 
  'cometa', 'quantum', 'eco', 'sombra', 'reflejo', 'viento', 'halcon', 
  'jaguar', 'astronave', 'cristal', 'espejismo'
];

function generateRandomRoomId() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}-${noun}-${num}`;
}

export default function Lobby({ onCreateRoom, onJoinRoom }) {
  const [createdRoomId, setCreatedRoomId] = useState('');
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    setCreatedRoomId(generateRandomRoomId());
  }, []);

  const handleCreate = () => {
    onCreateRoom(createdRoomId);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!joinRoomInput.trim()) {
      setInputError('Por favor ingresa un código o enlace de sala válido.');
      return;
    }

    // Extract room ID if the user pasted a full URL
    let targetRoomId = joinRoomInput.trim();
    try {
      if (targetRoomId.includes('http://') || targetRoomId.includes('https://')) {
        const url = new URL(targetRoomId);
        // Assuming path format is /room/roomId
        const pathParts = url.pathname.split('/');
        const idFromPath = pathParts[pathParts.length - 1];
        if (idFromPath) {
          targetRoomId = idFromPath;
        }
      }
    } catch (e) {
      // Not a URL, use raw input
    }

    onJoinRoom(targetRoomId);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/?room=${createdRoomId}&join=true`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container flex-center" style={{ minHeight: 'calc(100vh - 80px)', flexDirection: 'column', gap: '40px' }}>
      
      {/* Hero Section */}
      <div className="fade-in text-center" style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="flex-center" style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '24px', 
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          marginBottom: '20px',
          boxShadow: '0 0 30px rgba(139, 92, 246, 0.2)',
          fontSize: '40px',
          animation: 'bounce 3s infinite ease-in-out'
        }}>
          👻
        </div>
        <h1 className="glow-text" style={{ 
          fontSize: 'clamp(2.5rem, 6vw, 4rem)', 
          fontWeight: 800, 
          letterSpacing: '-0.03em', 
          background: 'linear-gradient(to right, #ffffff, #9ca3af)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          lineHeight: '1.1',
          marginBottom: '15px'
        }}>
          GhostChat
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: 'var(--text-secondary)', fontWeight: 400, maxWidth: '600px', margin: '0 auto 10px auto' }}>
          Establece chats efímeros y seguros entre dos personas en tiempo real. 
        </p>
        <span style={{ 
          fontSize: '0.85rem', 
          color: 'var(--color-secondary)', 
          background: 'rgba(6, 182, 212, 0.1)', 
          padding: '6px 14px', 
          borderRadius: '99px',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          🔒 Conexión 100% P2P Directa (Sin Servidores)
        </span>
      </div>

      {/* Control Cards */}
      <div className="fade-in" style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr', 
        gap: '24px', 
        width: '100%', 
        maxWidth: '850px',
        animationDelay: '0.1s'
      }}>
        {/* Responsive Grid on larger screens */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '24px',
          width: '100%'
        }}>
          
          {/* Card 1: Create Room */}
          <div className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Sparkles size={24} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Crear Nueva Sala</h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '25px' }}>
                Genera una sala temporal protegida por cifrado WebRTC. Comparte el enlace con la otra persona para iniciar el chat.
              </p>
              
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  fontFamily: 'monospace',
                  fontSize: '1.05rem',
                  color: 'var(--color-secondary)',
                  fontWeight: 600,
                  justifyContent: 'space-between'
                }}>
                  <span>{createdRoomId}</span>
                  <button 
                    onClick={copyLink} 
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      borderRadius: '6px',
                      transition: 'var(--transition-smooth)'
                    }}
                    title="Copiar enlace de invitación"
                  >
                    {copied ? <Check size={18} style={{ color: 'var(--color-success)' }} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={handleCreate} 
              id="btn-create-room"
              className="btn-glow" 
              style={{ width: '100%', marginTop: '10px' }}
            >
              Iniciar Sala Temporal
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Card 2: Join Room */}
          <div className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Flame size={24} style={{ color: 'var(--color-accent)' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Unirse a una Sala</h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '25px' }}>
                ¿Has recibido un enlace o código de sala? Introdúcelo aquí abajo para conectarte de forma segura.
              </p>
              
              <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Código de la sala o URL completa..." 
                    className="glass-input"
                    value={joinRoomInput}
                    onChange={(e) => {
                      setJoinRoomInput(e.target.value);
                      setInputError('');
                    }}
                    id="input-room-code"
                  />
                </div>
                {inputError && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    <span>{inputError}</span>
                  </div>
                )}
              </form>
            </div>

            <button 
              onClick={handleJoin} 
              id="btn-join-room"
              className="btn-glass" 
              style={{ width: '100%', border: '1px solid rgba(255, 255, 255, 0.15)', marginTop: '20px' }}
            >
              Conectarse al Chat
            </button>
          </div>

        </div>
      </div>

      {/* Feature Grid */}
      <div className="fade-in" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '20px', 
        width: '100%', 
        maxWidth: '850px',
        animationDelay: '0.2s',
        marginTop: '20px'
      }}>
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Shield size={18} style={{ color: 'var(--color-secondary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Cifrado P2P</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Mensajes directos de navegador a navegador. Cero servidores guardando tus datos.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Hourglass size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Autodestrucción</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Configura el tiempo de vida de tus mensajes. Desaparecerán sin dejar rastro físico.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Paperclip size={18} style={{ color: 'var(--color-accent)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Envío de Archivos</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Comparte fotos o documentos directamente de forma privada e ilimitada.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Flame size={18} style={{ color: 'var(--color-danger)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Cero Registros</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            No hay base de datos. Al cerrar la ventana o pulsar autodestrucción, el chat se evapora.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

    </div>
  );
}
