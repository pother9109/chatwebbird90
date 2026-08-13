import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { createPeerOptions, hasConfiguredTurnServer } from '../config/peerConfig.js';
import {
  MAX_P2P_FILE_SIZE,
  createFileId,
  createFileStartPayload,
  createIncomingFileMessage,
  createLocalFileMessage,
  acceptIncomingFileChunk,
  sendFileChunks,
  startIncomingFileTransfer
} from '../utils/fileTransfer.js';
import { CONNECTION_OPEN_TIMEOUT_MS, clearRetryTimer, getRetryDelay, isTransientPeerError } from '../utils/peerRecovery.js';
import { applyReactionToMessages } from '../utils/messageInteractions.js';
import { isOwnedRoom } from '../utils/roomOwnership.js';

export default function usePeer(roomId) {
  const [peerId, setPeerId] = useState(null);
  const [isHost, setIsHost] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [peerRestartNonce, setPeerRestartNonce] = useState(0);
  
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const hostRecoveryTimerRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const roomIdRef = useRef(null);
  const isHostRef = useRef(true);
  const incomingFilesRef = useRef(new Map());

  // Helper to add messages to local state
  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  // Helper to burn all messages locally
  const burnMessages = () => {
    setMessages([]);
  };

  const updateMessageReaction = (messageId, emoji, actorId) => {
    setMessages((prev) => applyReactionToMessages(prev, messageId, emoji, actorId));
  };

  const closeCurrentConnection = () => {
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
  };

  const scheduleGuestReconnect = (reason = 'Esperando al creador de la sala...') => {
    if (!roomIdRef.current || isHostRef.current || !shouldReconnectRef.current) return;

    clearRetryTimer(reconnectTimerRef);
    const nextAttempt = retryCountRef.current + 1;
    retryCountRef.current = nextAttempt;
    const delay = getRetryDelay(nextAttempt);

    setIsConnected(false);
    setIsConnecting(true);
    setError(`${reason} Reintentando en ${Math.ceil(delay / 1000)}s.`);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!shouldReconnectRef.current || isHostRef.current) return;
      if (!peerRef.current || peerRef.current.destroyed) return;
      if (!peerRef.current.open) return;
      if (connRef.current?.open) return;
      connectToPeer(roomIdRef.current);
    }, delay);
  };

  const scheduleHostRestart = (reason = 'Recuperando la sala...') => {
    if (!roomIdRef.current || !isHostRef.current || !shouldReconnectRef.current) return;

    clearRetryTimer(hostRecoveryTimerRef);
    const nextAttempt = retryCountRef.current + 1;
    retryCountRef.current = nextAttempt;
    const delay = getRetryDelay(nextAttempt, { baseMs: 1000, maxMs: 8000 });

    setIsConnected(false);
    setIsConnecting(true);
    setError(`${reason} Reintentando en ${Math.ceil(delay / 1000)}s.`);

    hostRecoveryTimerRef.current = setTimeout(() => {
      hostRecoveryTimerRef.current = null;
      if (!shouldReconnectRef.current || !isHostRef.current) return;
      setPeerRestartNonce((value) => value + 1);
    }, delay);
  };

  const getP2PFailureReason = () => {
    if (hasConfiguredTurnServer()) {
      return 'La conexion P2P fallo.';
    }
    return 'No se pudo abrir el canal P2P directo. En PCs con redes o firewalls distintos necesitas configurar un servidor TURN.';
  };

  // Initialize PeerJS
  useEffect(() => {
    if (!roomId) return;

    const host = !window.location.search.includes('join=true') || isOwnedRoom(roomId, 'private');
    setIsHost(host);
    isHostRef.current = host;
    shouldReconnectRef.current = true;
    roomIdRef.current = roomId;
    retryCountRef.current = 0;

    // If host, attempt to use roomId as the Peer ID.
    // If guest, PeerJS generates a random ID, and we connect to the host's roomId.
    const peerIdToUse = host ? roomId : null;
    const peer = new Peer(peerIdToUse, createPeerOptions());
    peerRef.current = peer;

    const resumePeerConnection = () => {
      const currentPeer = peerRef.current;
      if (!currentPeer || currentPeer.destroyed) {
        if (host) scheduleHostRestart('La sala necesita reabrirse.');
        return;
      }

      if (currentPeer.disconnected) {
        setError(null);
        setIsConnecting(true);
        try {
          currentPeer.reconnect();
        } catch (err) {
          console.warn('Peer reconnect failed:', err);
        }
      }

      if (!host && currentPeer.open && (!connRef.current || !connRef.current.open)) {
        scheduleGuestReconnect('Reanudando la conexión con la sala.');
      }
    };

    peer.on('open', (id) => {
      setPeerId(id);
      setIsConnecting(true);
      setError(null);

      // If we are the guest, automatically connect to the host
      if (!host) {
        connectToPeer(roomId);
      }
    });

    peer.on('connection', (connection) => {
      console.log('Incoming connection request received from peer');
      
      // Self-healing: If we already have a connection, close the old one
      // to let the new connection take over (e.g. if the guest refreshed)
      if (connRef.current) {
        console.log('Closing old connection to accept new incoming connection');
        connRef.current.close();
      }
      
      setupConnection(connection);
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err.type, err);

      if (err.type === 'unavailable-id') {
        if (isHostRef.current) {
          scheduleHostRestart('La sala sigue registrada temporalmente en la red.');
        } else {
          scheduleGuestReconnect('La sala aun se esta preparando.');
        }
      } else if (err.type === 'peer-unavailable') {
        if (!isHostRef.current) {
          scheduleGuestReconnect('Esperando a que el creador mantenga abierta la sala.');
        } else {
          setError('No se pudo encontrar a la otra persona.');
          setIsConnecting(false);
          setIsConnected(false);
        }
      } else if (isTransientPeerError(err)) {
        setError(null);
        setIsConnecting(true);
        if (isHostRef.current) {
          scheduleHostRestart('La senalizacion de la sala se interrumpio.');
        } else {
          scheduleGuestReconnect('La senalizacion se interrumpio.');
        }
      } else {
        setError('Error de comunicacion: ' + err.message);
        setIsConnecting(false);
        setIsConnected(false);
      }
    });
    peer.on('disconnected', () => {
      console.warn('PeerJS signaling disconnected; will resume when the tab is active.');
      setError(null);
      setIsConnecting(true);
      if (host) {
        scheduleHostRestart('La sala se desconecto temporalmente.');
      }
    });

    const handleVisibilityResume = () => {
      if (document.visibilityState === 'visible') {
        resumePeerConnection();
      }
    };

    const handlePageShow = () => {
      resumePeerConnection();
    };

    document.addEventListener('visibilitychange', handleVisibilityResume);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      shouldReconnectRef.current = false;
      clearRetryTimer(reconnectTimerRef);
      clearRetryTimer(hostRecoveryTimerRef);
      document.removeEventListener('visibilitychange', handleVisibilityResume);
      window.removeEventListener('pageshow', handlePageShow);
      disconnect();
    };
  }, [roomId, peerRestartNonce]);

  // Set up connection listeners
  const setupConnection = (connection) => {
    connRef.current = connection;
    setIsConnecting(true);
    let openHandled = false;

    const onOpen = () => {
      if (openHandled || connRef.current !== connection) return;
      openHandled = true;
      console.log('Data channel connected successfully!');
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      retryCountRef.current = 0;
      
      addMessage({
        id: 'system-' + Date.now(),
        sender: 'system',
        type: 'status',
        content: 'Conexión segura establecida en tiempo real (P2P).',
        timestamp: Date.now()
      });
    };

    // Double-insurance polling interval for open state
    const openCheckInterval = setInterval(() => {
      if (connection.open) {
        clearInterval(openCheckInterval);
        onOpen();
      }
    }, 200);

    const openTimeout = setTimeout(() => {
      if (connRef.current !== connection || connection.open) return;
      console.warn('Connection open timeout; scheduling another attempt.');
      clearInterval(openCheckInterval);
      try {
        connection.close();
      } catch (err) {
        console.warn('Failed to close timed-out connection:', err);
      }
      if (!isHostRef.current && shouldReconnectRef.current) {
        connRef.current = null;
        setIsConnected(false);
        setIsConnecting(true);
        scheduleGuestReconnect(getP2PFailureReason());
      }
    }, CONNECTION_OPEN_TIMEOUT_MS);

    if (connection.open) {
      clearInterval(openCheckInterval);
      clearTimeout(openTimeout);
      onOpen();
    } else {
      connection.on('open', () => {
        clearInterval(openCheckInterval);
        clearTimeout(openTimeout);
        onOpen();
      });
    }

    connection.on('data', (data) => {
      if (!data) return;

      switch (data.type) {
        case 'text':
          addMessage({
            id: data.id,
            sender: 'peer',
            type: 'text',
            content: data.content,
            timer: data.timer,
            replyTo: data.replyTo,
            timestamp: data.timestamp
          });
          break;
        case 'sticker':
          addMessage({
            id: data.id,
            sender: 'peer',
            type: 'sticker',
            content: data.content,
            timer: data.timer,
            replyTo: data.replyTo,
            timestamp: data.timestamp
          });
          break;
        case 'file':
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
            viewOnce: data.viewOnce || false,
            replyTo: data.replyTo,
            timestamp: data.timestamp
          });
          break;
        case 'file_start':
          startIncomingFileTransfer(incomingFilesRef.current, data);
          break;
        case 'file_chunk': {
          const completedTransfer = acceptIncomingFileChunk(incomingFilesRef.current, data);
          if (completedTransfer) {
            addMessage(createIncomingFileMessage(completedTransfer, 'peer'));
          }
          break;
        }
        case 'file_end':
          break;
        case 'typing':
          setIsPeerTyping(data.isTyping);
          break;
        case 'reaction':
          updateMessageReaction(data.messageId, data.emoji, 'peer');
          break;
        case 'burn':
          burnMessages();
          break;
        default:
          break;
      }
    });

    connection.on('close', () => {
      console.log('Connection closed');
      clearInterval(openCheckInterval);
      clearTimeout(openTimeout);
      if (connRef.current !== connection) return;
      setIsConnected(false);
      setIsConnecting(!isHostRef.current);
      addMessage({
        id: 'system-' + Date.now(),
        sender: 'system',
        type: 'status',
        content: 'La otra persona se ha desconectado de la sala.',
        timestamp: Date.now()
      });
      connRef.current = null;
      if (!isHostRef.current && shouldReconnectRef.current) {
        scheduleGuestReconnect('La conexion con la sala se cerro.');
      }
    });

    connection.on('error', (err) => {
      console.error('Connection error:', err);
      clearInterval(openCheckInterval);
      clearTimeout(openTimeout);
      if (connRef.current !== connection) return;
      setIsConnected(false);
      setIsConnecting(!isHostRef.current);
      if (!isHostRef.current && shouldReconnectRef.current) {
        scheduleGuestReconnect(getP2PFailureReason());
      }
    });
  };

  // Connect to another peer (guest initiating connection to host)
  const connectToPeer = (destId) => {
    if (!peerRef.current || peerRef.current.destroyed) return;
    console.log('Initiating native WebRTC connection to host:', destId);
    
    clearRetryTimer(reconnectTimerRef);
    if (connRef.current && !connRef.current.open) {
      closeCurrentConnection();
    }
    setIsConnecting(true);
    
    // Connect without legacy reliable option to avoid handshake hangs
    const connection = peerRef.current.connect(destId);
    setupConnection(connection);
  };

  // Send text message
  const sendMessage = (text, timer, replyTo = null) => {
    if (!connRef.current || !isConnected) return;
    
    const msgId = 'msg-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    const payload = {
      id: msgId,
      type: 'text',
      content: text,
      timer: timer || null,
      replyTo,
      timestamp: Date.now()
    };

    connRef.current.send(payload);
    
    // Add to our own messages
    addMessage({
      ...payload,
      sender: 'me'
    });
  };

  // Send sticker message
  const sendSticker = (stickerUrl, timer, replyTo = null) => {
    if (!connRef.current || !isConnected) return;

    const msgId = 'sticker-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    const payload = {
      id: msgId,
      type: 'sticker',
      content: stickerUrl,
      timer: timer || null,
      replyTo,
      timestamp: Date.now()
    };

    connRef.current.send(payload);

    addMessage({
      ...payload,
      sender: 'me'
    });
  };

  // Send binary file safely
  const sendFile = async (file, timer, viewOnce, replyTo = null) => {
    if (!connRef.current || !isConnected) return;
    
    // Enforce a 15MB size limit to prevent WebRTC data channel buffer overflow crashes
    if (file.size > MAX_P2P_FILE_SIZE) {
      addMessage({
        id: 'system-err-' + Date.now(),
        sender: 'system',
        type: 'status',
        content: `No se pudo enviar "${file.name}": El archivo supera el límite recomendado de 15MB para transferencias directas P2P.`,
        timestamp: Date.now()
      });
      return;
    }

    const msgId = createFileId('file');
    const timestamp = Date.now();
    const startPayload = createFileStartPayload({
      id: msgId,
      file,
      timer,
      viewOnce,
      timestamp,
      replyTo
    });
    
    try {
      addMessage(createLocalFileMessage({
        id: msgId,
        file,
        timer,
        viewOnce,
        timestamp,
        replyTo
      }));

      await sendFileChunks(file, startPayload, (payload) => {
        if (!connRef.current || !connRef.current.open) {
          throw new Error('La conexión P2P se cerró durante el envío.');
        }
        connRef.current.send(payload);
      });
    } catch (err) {
      console.error('Exception in sendFile outer block:', err);
      addMessage({
        id: 'system-err-' + Date.now(),
        sender: 'system',
        type: 'status',
        content: `Error del sistema al preparar el archivo "${file.name}".`,
        timestamp: Date.now()
      });
    }
  };

  // Send typing status
  const sendTyping = (isTyping) => {
    if (!connRef.current || !isConnected) return;
    connRef.current.send({
      type: 'typing',
      isTyping
    });
  };

  const sendReaction = (messageId, emoji) => {
    if (!connRef.current || !isConnected) return;
    const payload = {
      type: 'reaction',
      messageId,
      emoji,
      timestamp: Date.now()
    };
    connRef.current.send(payload);
    updateMessageReaction(messageId, emoji, 'me');
  };

  // Clean / Burn all messages
  const burn = () => {
    if (connRef.current && isConnected) {
      connRef.current.send({ type: 'burn' });
    }
    burnMessages();
  };

  // Burn/destroy content of a single message (e.g. for view-once photos)
  const burnMessage = (id) => {
    setMessages((prev) => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          fileBlob: null,
          fileType: null,
          viewOnceBurned: true,
          type: 'text',
          content: '👁️ Foto vista y autodestruida'
        };
      }
      return m;
    }));
  };

  // Disconnect from current room
  const disconnect = () => {
    console.log('Disconnecting and cleaning peer resources');
    shouldReconnectRef.current = false;
    roomIdRef.current = null;
    clearRetryTimer(reconnectTimerRef);
    clearRetryTimer(hostRecoveryTimerRef);
    incomingFilesRef.current.clear();
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
    isHost,
    isConnected,
    isConnecting,
    isPeerTyping,
    error,
    messages,
    sendMessage,
    sendFile,
    sendSticker,
    sendReaction,
    sendTyping,
    burn,
    burnMessage,
    disconnect
  };
}
