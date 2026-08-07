import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby.jsx';
import ChatRoom from './components/ChatRoom.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import usePeer from './hooks/usePeer.js';

export default function App() {
  const [roomId, setRoomId] = useState(null);

  // Custom hook for PeerJS. Note that if roomId is null, the hook remains inactive.
  const peerState = usePeer(roomId);

  // Check URL parameters on mount to join a room automatically
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  const handleCreateRoom = (newRoomId) => {
    // Update URL without reloading to reflect room state
    const newUrl = `${window.location.origin}/?room=${newRoomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    setRoomId(newRoomId);
  };

  const handleJoinRoom = (targetRoomId) => {
    const newUrl = `${window.location.origin}/?room=${targetRoomId}&join=true`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    setRoomId(targetRoomId);
  };

  const handleLeaveRoom = () => {
    // Clean URL
    const cleanUrl = window.location.origin;
    window.history.pushState({ path: cleanUrl }, '', cleanUrl);
    
    // Disconnect peer first
    peerState.disconnect();
    
    // Reset state
    setRoomId(null);
  };

  return (
    <>
      {/* Premium Floating Orbs Canvas */}
      <div className="bg-canvas">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Main Layout Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 2 }}>
        {roomId ? (
          <ErrorBoundary onReset={handleLeaveRoom}>
            <ChatRoom 
              roomId={roomId} 
              peerState={peerState} 
              onLeave={handleLeaveRoom} 
            />
          </ErrorBoundary>
        ) : (
          <Lobby 
            onCreateRoom={handleCreateRoom} 
            onJoinRoom={handleJoinRoom} 
          />
        )}
      </main>

      {/* Modern Footer */}
      {!roomId && (
        <footer style={{ 
          padding: '25px', 
          textAlign: 'center', 
          fontSize: '0.8rem', 
          color: 'var(--text-muted)',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)',
          background: 'rgba(3, 7, 18, 0.4)',
          backdropFilter: 'blur(10px)',
          zIndex: 2
        }}>
          <p style={{ marginBottom: '5px' }}>
            GhostChat es una herramienta de código abierto para salas efímeras directas. 
            Ninguno de tus datos se almacena en servidores.
          </p>
          <p>
            Desarrollado con 💜 utilizando React, WebRTC y PeerJS. Listo para desplegar en Vercel.
          </p>
        </footer>
      )}
    </>
  );
}
