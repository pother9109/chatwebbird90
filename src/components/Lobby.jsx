import React, { useState, useEffect } from 'react';
import { Shield, Paperclip, Flame, ArrowRight, Sparkles, AlertCircle, Copy, Check, Users, User } from 'lucide-react';
import MysteryBanner from './common/MysteryBanner.jsx';

const ADJECTIVES = [
  'etereo', 'fantasma', 'silencioso', 'secreto', 'veloz', 'oculto', 
  'fugaz', 'mistico', 'cosmico', 'cuantico', 'brillante', 'nomada', 
  'astral', 'efimero', 'silvestre', 'sombrio', 'clandestino'
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

function generateRandomNickname() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj.charAt(0).toUpperCase() + adj.slice(1)}-${num}`;
}

export default function Lobby({ onCreateRoom, onJoinRoom }) {
  const [createdRoomId, setCreatedRoomId] = useState('');
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState('private'); // 'private' or 'group'
  const [copied, setCopied] = useState(false);
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    setCreatedRoomId(generateRandomRoomId());
    setNickname(generateRandomNickname());
  }, []);

  const handleCreate = () => {
    const finalNickname = nickname.trim() || generateRandomNickname();
    onCreateRoom(createdRoomId, mode, finalNickname);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!joinRoomInput.trim()) {
      setInputError('Por favor ingresa un código o enlace de sala válido.');
      return;
    }

    let targetRoomId = joinRoomInput.trim();
    let detectedMode = mode;

    try {
      if (targetRoomId.includes('http://') || targetRoomId.includes('https://')) {
        const url = new URL(targetRoomId);
        const modeParam = url.searchParams.get('mode');
        if (modeParam === 'group') detectedMode = 'group';
        const roomParam = url.searchParams.get('room');
        if (roomParam) targetRoomId = roomParam;
      }
    } catch (err) {}

    const finalNickname = nickname.trim() || generateRandomNickname();
    onJoinRoom(targetRoomId, detectedMode, finalNickname);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/?room=${createdRoomId}&mode=${mode}&join=true`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container flex-center" style={{ minHeight: 'calc(100vh - 80px)', flexDirection: 'column', gap: '30px' }}>
      
      {/* Hero Section */}
      <div className="fade-in text-center" style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <MysteryBanner />

        {/* MODE SWITCHER TABS */}
        <div style={{
          display: 'inline-flex',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '99px',
          padding: '4px',
          gap: '4px',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => setMode('private')}
            aria-pressed={mode === 'private'}
            aria-label="Seleccionar chat privado uno a uno"
            style={{
              padding: '8px 20px',
              borderRadius: '99px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: mode === 'private' ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' : 'transparent',
              color: mode === 'private' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'private' ? '0 4px 15px rgba(139, 92, 246, 0.3)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            <Shield size={15} /> 1 a 1 Privado
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            aria-pressed={mode === 'group'}
            aria-label="Seleccionar chat grupal"
            style={{
              padding: '8px 20px',
              borderRadius: '99px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: mode === 'group' ? 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-accent) 100%)' : 'transparent',
              color: mode === 'group' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'group' ? '0 4px 15px rgba(6, 182, 212, 0.3)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            <Users size={15} /> Chat Grupal
          </button>
        </div>

        {/* USER NICKNAME INPUT CARD */}
        <div className="glass-panel" style={{
          width: '100%',
          maxWidth: '450px',
          padding: '12px 18px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <User size={18} style={{ color: 'var(--color-secondary)', flexShrink: 0 }} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>
              TU APODO O NOMBRE DE USUARIO:
            </span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Escribe tu apodo..."
              aria-label="Tu apodo o nombre de usuario"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                fontWeight: 600,
                width: '100%',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Control Cards */}
      <div className="fade-in" style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr', 
        gap: '24px', 
        width: '100%', 
        maxWidth: '850px'
      }}>
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
                <Sparkles size={24} style={{ color: mode === 'group' ? 'var(--color-secondary)' : 'var(--color-primary)' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {mode === 'group' ? 'Crear Sala Grupal' : 'Crear Sala Privada'}
                </h2>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '25px' }}>
                {mode === 'group' 
                  ? 'Genera una sala P2P para invitar a múltiples participantes. Cada persona podrá identificarse con su apodo.' 
                  : 'Genera una sala temporal P2P entre dos personas. Cero registros en servidores.'}
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
                    aria-label="Copiar enlace de invitacion"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
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
              aria-label={mode === 'group' ? 'Iniciar chat grupal' : 'Iniciar sala temporal privada'}
              style={{ width: '100%', marginTop: '10px' }}
            >
              {mode === 'group' ? 'Iniciar Chat Grupal' : 'Iniciar Sala Temporal'}
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
                ¿Has recibido un enlace o código de sala? Introdúcelo aquí para conectarte.
              </p>
              
              <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Código de la sala o URL completa..." 
                    className="glass-input"
                    aria-label="Codigo de sala o URL completa"
                    aria-describedby={inputError ? 'room-code-error' : undefined}
                    aria-invalid={Boolean(inputError)}
                    value={joinRoomInput}
                    onChange={(e) => {
                      setJoinRoomInput(e.target.value);
                      setInputError('');
                    }}
                    id="input-room-code"
                  />
                </div>
                {inputError && (
                  <div id="room-code-error" role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              aria-label="Conectarse al chat"
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
        marginTop: '10px'
      }}>
        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Shield size={18} style={{ color: 'var(--color-secondary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>1 a 1 y Grupal P2P</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Soporta chats privados de 2 personas o salas grupales multi-usuario.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <User size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Identificación por Apodo</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Elige tu apodo antes de ingresar para identificarte fácilmente con el grupo.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Paperclip size={18} style={{ color: 'var(--color-accent)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Stickers y Archivos</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Stickers animados de Google y Microsoft, fotos de un solo uso y archivos.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Flame size={18} style={{ color: 'var(--color-danger)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Sin Historial Central</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Sin base de datos propia ni historial guardado. Todo se desvanece al salir.
          </p>
        </div>
      </div>
    </div>
  );
}
