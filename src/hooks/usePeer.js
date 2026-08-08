import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { createPeerOptions } from '../config/peerConfig.js';
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

export default function usePeer(roomId) {
  const [peerId, setPeerId] = useState(null);
  const [isHost, setIsHost] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const retryCountRef = useRef(0);
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

  // Initialize PeerJS
  useEffect(() => {
    if (!roomId) return;

    const host = !window.location.search.includes('join=true');
    setIsHost(host);
    isHostRef.current = host;
    retryCountRef.current = 0;

    // If host, attempt to use roomId as the Peer ID.
    // If guest, PeerJS generates a random ID, and we connect to the host's roomId.
    const peerIdToUse = host ? roomId : null;
    const peer = new Peer(peerIdToUse, createPeerOptions());
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setIsConnecting(true);

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
        setError('El ID de sala ya está en uso o expirando en la red. Intenta crear una nueva sala.');
        setIsConnecting(false);
      } else if (err.type === 'peer-unavailable') {
        // If host isn't fully registered on the cloud signaling server yet, auto-retry
        if (!isHostRef.current && retryCountRef.current < 5) {
          retryCountRef.current += 1;
          setError(`Buscando al creador de la sala... Reintentando (${retryCountRef.current}/5)`);
          setTimeout(() => {
            if (peerRef.current && !peerRef.current.destroyed) {
              connectToPeer(roomId);
            }
          }, 1500);
        } else {
          setError('No se pudo encontrar al creador de la sala. Asegúrate de que el enlace sea correcto y de que la sala del anfitrión siga abierta.');
          setIsConnecting(false);
          setIsConnected(false);
        }
      } else {
        setError('Error de comunicación: ' + err.message);
        setIsConnecting(false);
        setIsConnected(false);
      }
    });

    return () => {
      disconnect();
    };
  }, [roomId]);

  // Set up connection listeners
  const setupConnection = (connection) => {
    connRef.current = connection;
    setIsConnecting(true);

    const onOpen = () => {
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

    if (connection.open) {
      clearInterval(openCheckInterval);
      onOpen();
    } else {
      connection.on('open', () => {
        clearInterval(openCheckInterval);
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
      clearInterval(openCheckInterval);
      setIsConnected(false);
      setIsConnecting(false);
    });
  };

  // Connect to another peer (guest initiating connection to host)
  const connectToPeer = (destId) => {
    if (!peerRef.current || peerRef.current.destroyed) return;
    console.log('Initiating native WebRTC connection to host:', destId);
    
    setIsConnecting(true);
    
    // Connect without legacy reliable option to avoid handshake hangs
    const connection = peerRef.current.connect(destId);
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

  // Send sticker message
  const sendSticker = (stickerUrl, timer) => {
    if (!connRef.current || !isConnected) return;

    const msgId = 'sticker-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    const payload = {
      id: msgId,
      type: 'sticker',
      content: stickerUrl,
      timer: timer || null,
      timestamp: Date.now()
    };

    connRef.current.send(payload);

    addMessage({
      ...payload,
      sender: 'me'
    });
  };

  // Send binary file safely
  const sendFile = async (file, timer, viewOnce) => {
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
      timestamp
    });
    
    try {
      addMessage(createLocalFileMessage({
        id: msgId,
        file,
        timer,
        viewOnce,
        timestamp
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
    sendTyping,
    burn,
    burnMessage,
    disconnect
  };
}
