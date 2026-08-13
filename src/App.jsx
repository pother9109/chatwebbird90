import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby.jsx';
import ChatRoom from './components/ChatRoom.jsx';
import GroupChatRoom from './components/GroupChatRoom.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import usePeer from './hooks/usePeer.js';
import { useGroupPeer } from './hooks/useGroupPeer.js';
import { markOwnedRoom } from './utils/roomOwnership.js';

export default function App() {
  const [roomId, setRoomId] = useState(null);
  const [chatMode, setChatMode] = useState('private'); // 'private' or 'group'
  const [nickname, setNickname] = useState('');

  // Both custom hooks handle peer initialization conditionally based on roomId
  const peerState = usePeer(chatMode === 'private' ? roomId : null);
  const groupPeerState = useGroupPeer(chatMode === 'group' ? roomId : null, nickname);

  // Check URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const modeParam = params.get('mode');
    if (roomParam) {
      if (modeParam === 'group') {
        setChatMode('group');
      } else {
        setChatMode('private');
      }
      setRoomId(roomParam);
    }
  }, []);

  const handleCreateRoom = (newRoomId, selectedMode, userNickname) => {
    setChatMode(selectedMode);
    setNickname(userNickname);
    markOwnedRoom(newRoomId, selectedMode);
    const newUrl = `${window.location.origin}/?room=${newRoomId}&mode=${selectedMode}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    setRoomId(newRoomId);
  };

  const handleJoinRoom = (targetRoomId, selectedMode, userNickname) => {
    setChatMode(selectedMode);
    setNickname(userNickname);
    const newUrl = `${window.location.origin}/?room=${targetRoomId}&mode=${selectedMode}&join=true`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    setRoomId(targetRoomId);
  };

  const handleLeaveRoom = () => {
    const cleanUrl = window.location.origin;
    window.history.pushState({ path: cleanUrl }, '', cleanUrl);

    if (chatMode === 'private') {
      peerState.disconnect();
    } else {
      groupPeerState.disconnect();
    }

    setRoomId(null);
  };

  return (
    <>
      {/* Background Orbs */}
      <div className="bg-canvas">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Main Layout Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 2 }}>
        {roomId ? (
          <ErrorBoundary onReset={handleLeaveRoom}>
            {chatMode === 'group' ? (
              <GroupChatRoom 
                roomId={roomId} 
                groupPeerState={groupPeerState} 
                onLeave={handleLeaveRoom} 
              />
            ) : (
              <ChatRoom 
                roomId={roomId} 
                peerState={peerState} 
                onLeave={handleLeaveRoom} 
              />
            )}
          </ErrorBoundary>
        ) : (
          <Lobby 
            onCreateRoom={handleCreateRoom} 
            onJoinRoom={handleJoinRoom} 
          />
        )}
      </main>

      {/* Footer */}
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
            GhostChat es una herramienta de código abierto para salas efímeras directas 1 a 1 y grupales P2P. 
          </p>
          <p>
            Desarrollado con 💜 utilizando React, WebRTC y PeerJS. Listo para desplegar en Vercel.
          </p>
        </footer>
      )}
    </>
  );
}
