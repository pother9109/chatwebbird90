import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

export default function usePeer(roomId) {
  const [peerId, setPeerId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Helper to add messages to local state
  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  // Helper to burn all messages locally
  const burnMessages = () => {
    setMessages([]);
  };

  // Initialize PeerJS
  useEffect(() => {
    if (!roomId) return;

    // We can use the roomId directly as the Peer ID if we want,
    // or let the first user generate a room and the second join.
    // To keep it simple: Host's peer ID is the roomId.
    // Client connects to that peer ID.
    // We will initialize a Peer. If we are the creator (host), our ID is the roomId.
    // If we are joining, our ID is random, and we will connect to roomId.
    const isHost = !window.location.search.includes('join=true');
    const peerOptions = {
      debug: 1, // Only show errors
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ]
      }
    };

    const peerIdToUse = isHost ? roomId : null;
    const peer = new Peer(peerIdToUse, peerOptions);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setIsConnecting(true);

      // If we are not the host, we should connect to the host (roomId) automatically
      if (!isHost) {
        connectToPeer(roomId);
      }
    });

    peer.on('connection', (connection) => {
      // If we already have a connection, reject new ones (2-person limit)
      if (connRef.current && connRef.current.open) {
        connection.on('open', () => {
          connection.send({ type: 'system-reject', message: 'Sala llena' });
          setTimeout(() => connection.close(), 500);
        });
        return;
      }
      setupConnection(connection);
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      // Handle ID taken or unable to connect
      if (err.type === 'unavailable-id') {
        setError('El ID de sala ya está en uso o no disponible.');
      } else if (err.type === 'peer-unavailable') {
        setError('No se pudo encontrar a la otra persona. Asegúrate de que el enlace sea correcto y siga activa la sala.');
      } else {
        setError('Error de conexión: ' + err.message);
      }
      setIsConnecting(false);
      setIsConnected(false);
    });

    return () => {
      disconnect();
    };
  }, [roomId]);

  // Set up connection listeners
  const setupConnection = (connection) => {
    connRef.current = connection;
    setIsConnecting(true);

    connection.on('open', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      
      // Play a nice connection sound if possible or handle in UI
      addMessage({
        id: 'system-' + Date.now(),
        sender: 'system',
        type: 'status',
        content: 'Conexión segura establecida en tiempo real (P2P).',
        timestamp: Date.now()
      });
    });

    connection.on('data', (data) => {
      if (!data) return;

      switch (data.type) {
        case 'system-reject':
          setError(data.message || 'La sala está llena.');
          disconnect();
          break;
        case 'text':
          addMessage({
            id: data.id,
            sender: 'peer',
            type: 'text',
            content: data.content,
            timer: data.timer,
            timestamp: data.timestamp
          });
          break;
        case 'file':
          // Re-create Blob from arraybuffer/array if transmitted raw
          let blob = data.blob;
          if (!(blob instanceof Blob) && data.arrayBuffer) {
            blob = new Blob([data.arrayBuffer], { type: data.mime });
          }
          addMessage({
            id: data.id,
            sender: 'peer',
            type: 'file',
            fileBlob: blob,
            fileName: data.name,
            fileType: data.mime,
            fileSize: data.size,
            timer: data.timer,
            timestamp: data.timestamp
          });
          break;
        case 'typing':
          setIsPeerTyping(data.isTyping);
          break;
        case 'burn':
          burnMessages();
          break;
        default:
          break;
      }
    });

    connection.on('close', () => {
      setIsConnected(false);
      setIsConnecting(false);
      addMessage({
        id: 'system-' + Date.now(),
        sender: 'system',
        type: 'status',
        content: 'La otra persona se ha desconectado de la sala.',
        timestamp: Date.now()
      });
      connRef.current = null;
    });

    connection.on('error', (err) => {
      console.error('Connection error:', err);
      setIsConnected(false);
      setIsConnecting(false);
    });
  };

  // Connect to another peer
  const connectToPeer = (destId) => {
    if (!peerRef.current) return;
    const connection = peerRef.current.connect(destId, {
      reliable: true
    });
    setupConnection(connection);
  };

  // Send text message
  const sendMessage = (text, timer) => {
    if (!connRef.current || !isConnected) return;
    
    const msgId = 'msg-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    const payload = {
      id: msgId,
      type: 'text',
      content: text,
      timer: timer || null,
      timestamp: Date.now()
    };

    connRef.current.send(payload);
    
    // Add to our own messages
    addMessage({
      ...payload,
      sender: 'me'
    });
  };

  // Send binary file
  const sendFile = async (file, timer) => {
    if (!connRef.current || !isConnected) return;

    const msgId = 'file-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    
    // Convert to ArrayBuffer for reliable transfer across all browsers
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const payload = {
        id: msgId,
        type: 'file',
        arrayBuffer: arrayBuffer,
        name: file.name,
        mime: file.type,
        size: file.size,
        timer: timer || null,
        timestamp: Date.now()
      };

      connRef.current.send(payload);

      // Add to our own messages as a Blob
      addMessage({
        id: msgId,
        sender: 'me',
        type: 'file',
        fileBlob: file, // Keep file directly
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        timer: timer || null,
        timestamp: Date.now()
      });
    };
    reader.readAsArrayBuffer(file);
  };

  // Send typing status
  const sendTyping = (isTyping) => {
    if (!connRef.current || !isConnected) return;
    connRef.current.send({
      type: 'typing',
      isTyping
    });
  };

  // Clean / Burn all messages
  const burn = () => {
    if (connRef.current && isConnected) {
      connRef.current.send({ type: 'burn' });
    }
    burnMessages();
  };

  // Disconnect from current room
  const disconnect = () => {
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setPeerId(null);
    setMessages([]);
  };

  return {
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
  };
}
