import { useState, useEffect, useRef } from 'react';
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

const PASTEL_COLORS = [
  '#8B5CF6', '#06B6D4', '#EC4899', '#10B981', 
  '#F59E0B', '#6366F1', '#3B82F6', '#14B8A6'
];

const getRandomColor = () => PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];

export function useGroupPeer(roomId, userNickname) {
  const [peerId, setPeerId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [members, setMembers] = useState([]);
  const [peerRestartNonce, setPeerRestartNonce] = useState(0);

  // Host stores all guest connections: Map<peerId, { conn, nickname, color }>
  const connectionsRef = useRef(new Map());
  // Guest stores single connection to host
  const hostConnRef = useRef(null);
  const peerRef = useRef(null);
  const isHostRef = useRef(false);
  const shouldReconnectRef = useRef(false);
  const roomIdRef = useRef(null);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const hostRecoveryTimerRef = useRef(null);
  const incomingFilesRef = useRef(new Map());
  const myNicknameRef = useRef(userNickname || 'Anónimo');
  const myColorRef = useRef(getRandomColor());

  // Helper to append message locally
  const addMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const updateMessageReaction = (messageId, emoji, actorId) => {
    setMessages((prev) => applyReactionToMessages(prev, messageId, emoji, actorId));
  };

  const getLocalActorId = () => peerRef.current?.id || (isHostRef.current ? 'host' : 'me');

  const closeHostConnection = () => {
    if (hostConnRef.current) {
      hostConnRef.current.close();
      hostConnRef.current = null;
    }
  };

  const scheduleGuestReconnect = (reason = 'Esperando al anfitrion de la sala...') => {
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
      if (hostConnRef.current?.open) return;
      connectToHost(roomIdRef.current);
    }, delay);
  };

  const scheduleHostRestart = (reason = 'Recuperando la sala grupal...') => {
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
      return 'La conexion grupal fallo.';
    }
    return 'No se pudo abrir el canal P2P grupal. En PCs con redes o firewalls distintos necesitas configurar un servidor TURN.';
  };

  // Broadcast message from Host to all connected guests (except optional skipPeerId)
  const broadcastFromHost = (data, skipPeerId = null) => {
    connectionsRef.current.forEach((peerObj, pId) => {
      if (pId !== skipPeerId && peerObj.conn && peerObj.conn.open) {
        try {
          peerObj.conn.send(data);
        } catch (err) {
          console.error(`Error broadcasting to ${pId}:`, err);
        }
      }
    });
  };

  // Update members list state from Host connections
  const updateMembersList = () => {
    const list = [{
      peerId: peerRef.current?.id || 'host',
      nickname: myNicknameRef.current,
      color: myColorRef.current,
      isHost: true
    }];

    connectionsRef.current.forEach((peerObj, pId) => {
      list.push({
        peerId: pId,
        nickname: peerObj.nickname || 'Anónimo',
        color: peerObj.color || '#06B6D4',
        isHost: false
      });
    });

    setMembers(list);

    // Broadcast updated members list to guests
    if (isHostRef.current) {
      broadcastFromHost({
        type: 'members_update',
        members: list
      });
    }
  };

  useEffect(() => {
    if (!roomId) return;

    myNicknameRef.current = userNickname || `Fantasma-${Math.floor(100 + Math.random() * 900)}`;
    const host = !window.location.search.includes('join=true') || isOwnedRoom(roomId, 'group');
    setIsHost(host);
    isHostRef.current = host;
    shouldReconnectRef.current = true;
    roomIdRef.current = roomId;
    retryCountRef.current = 0;

    const peerIdToUse = host ? roomId : null;
    const peer = new Peer(peerIdToUse, createPeerOptions());
    peerRef.current = peer;

    const resumePeerConnection = () => {
      const currentPeer = peerRef.current;
      if (!currentPeer || currentPeer.destroyed) {
        if (host) scheduleHostRestart('La sala grupal necesita reabrirse.');
        return;
      }

      if (currentPeer.disconnected) {
        setError(null);
        setIsConnecting(true);
        try {
          currentPeer.reconnect();
        } catch (err) {
          console.warn('Group peer reconnect failed:', err);
        }
      }

      if (!host && currentPeer.open && (!hostConnRef.current || !hostConnRef.current.open)) {
        scheduleGuestReconnect('Reanudando la conexion con la sala grupal.');
      }
    };

    peer.on('open', (id) => {
      setPeerId(id);
      setIsConnecting(true);
      setError(null);
      retryCountRef.current = 0;

      if (host) {
        setIsConnected(true);
        setIsConnecting(false);
        updateMembersList();
        addMessage({
          id: 'sys-start-' + Date.now(),
          sender: 'system',
          type: 'status',
          content: `Sala grupal iniciada como anfitrión (${myNicknameRef.current}).`,
          timestamp: Date.now()
        });
      } else {
        // Connect to host
        connectToHost(roomId);
      }
    });

    // HOST ONLY: Handle incoming connections from guests
    peer.on('connection', (conn) => {
      console.log('Host received group connection from:', conn.peer);
      let setupHandled = false;

      const setupGuestConn = () => {
        if (setupHandled) return;
        setupHandled = true;
        connectionsRef.current.set(conn.peer, {
          conn,
          nickname: 'Conectando...',
          color: getRandomColor()
        });

        // Request guest info
        conn.send({
          type: 'request_info'
        });

        conn.on('data', (data) => {
          if (!data) return;

          switch (data.type) {
            case 'guest_info': {
              const currentObj = connectionsRef.current.get(conn.peer) || {};
              connectionsRef.current.set(conn.peer, {
                ...currentObj,
                nickname: data.nickname || 'Anónimo',
                color: data.color || currentObj.color
              });
              updateMembersList();

              // System broadcast: Member joined
              const joinMsg = {
                id: 'sys-join-' + Date.now() + '-' + conn.peer,
                sender: 'system',
                type: 'status',
                content: `👋 ${data.nickname || 'Un participante'} se unió al chat grupal.`,
                timestamp: Date.now()
              };
              addMessage(joinMsg);
              broadcastFromHost(joinMsg);
              break;
            }
            case 'text':
            case 'sticker':
            case 'file': {
              // Add to Host state
              let messagePayload = { ...data };
              if (data.type === 'file' && data.arrayBuffer) {
                const blob = new Blob([data.arrayBuffer], { type: data.mime });
                messagePayload.fileBlob = blob;
              }
              addMessage(messagePayload);
              // Relay to all other guests
              broadcastFromHost(data, conn.peer);
              break;
            }
            case 'file_start': {
              startIncomingFileTransfer(incomingFilesRef.current, data);
              broadcastFromHost(data, conn.peer);
              break;
            }
            case 'file_chunk': {
              const completedTransfer = acceptIncomingFileChunk(incomingFilesRef.current, data);
              if (completedTransfer) {
                addMessage(createIncomingFileMessage(completedTransfer, 'peer'));
              }
              broadcastFromHost(data, conn.peer);
              break;
            }
            case 'file_end':
              broadcastFromHost(data, conn.peer);
              break;
            case 'typing': {
              if (data.isTyping) {
                setTypingUsers((prev) => new Set(prev).add(data.nickname));
              } else {
                setTypingUsers((prev) => {
                  const next = new Set(prev);
                  next.delete(data.nickname);
                  return next;
                });
              }
              broadcastFromHost(data, conn.peer);
              break;
            }
            case 'reaction': {
              const actorId = data.actorId || conn.peer;
              const reactionPayload = {
                ...data,
                actorId,
                nickname: data.nickname || connectionsRef.current.get(conn.peer)?.nickname
              };
              updateMessageReaction(data.messageId, data.emoji, actorId);
              broadcastFromHost(reactionPayload, conn.peer);
              break;
            }
            case 'burn': {
              burnMessages();
              broadcastFromHost(data, conn.peer);
              break;
            }
            default:
              break;
          }
        });

        conn.on('close', () => {
          const guest = connectionsRef.current.get(conn.peer);
          const name = guest ? guest.nickname : 'Un participante';
          connectionsRef.current.delete(conn.peer);
          updateMembersList();

          const leaveMsg = {
            id: 'sys-leave-' + Date.now(),
            sender: 'system',
            type: 'status',
            content: `🚪 ${name} salió de la sala.`,
            timestamp: Date.now()
          };
          addMessage(leaveMsg);
          broadcastFromHost(leaveMsg);
        });
      };

      if (conn.open) {
        setupGuestConn();
      } else {
        conn.on('open', setupGuestConn);
      }
    });

    peer.on('error', (err) => {
      console.error('Group PeerJS error:', err.type, err);

      if (err.type === 'unavailable-id') {
        if (isHostRef.current) {
          scheduleHostRestart('La sala grupal sigue registrada temporalmente en la red.');
        } else {
          scheduleGuestReconnect('La sala grupal aun se esta preparando.');
        }
      } else if (err.type === 'peer-unavailable') {
        if (!isHostRef.current) {
          scheduleGuestReconnect('Esperando a que el anfitrion mantenga abierta la sala grupal.');
        } else {
          setError('No se pudo encontrar la sala grupal.');
          setIsConnecting(false);
          setIsConnected(false);
        }
      } else if (isTransientPeerError(err)) {
        setError(null);
        setIsConnecting(true);
        if (isHostRef.current) {
          scheduleHostRestart('La senalizacion de la sala grupal se interrumpio.');
        } else {
          scheduleGuestReconnect('La senalizacion grupal se interrumpio.');
        }
      } else {
        setError('Error en el grupo: ' + err.message);
        setIsConnecting(false);
        setIsConnected(false);
      }
    });
    peer.on('disconnected', () => {
      console.warn('Group PeerJS signaling disconnected; will resume when the tab is active.');
      setError(null);
      setIsConnecting(true);
      if (host) {
        scheduleHostRestart('La sala grupal se desconecto temporalmente.');
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

  // GUEST ONLY: Connect to Host
  const connectToHost = (hostId) => {
    if (!peerRef.current || peerRef.current.destroyed) return;
    clearRetryTimer(reconnectTimerRef);
    if (hostConnRef.current && !hostConnRef.current.open) {
      closeHostConnection();
    }
    setIsConnecting(true);

    const conn = peerRef.current.connect(hostId);
    hostConnRef.current = conn;
    let openHandled = false;

    const openPoll = setInterval(() => {
      if (conn.open) {
        clearInterval(openPoll);
        onHostConnOpen();
      }
    }, 200);

    const openTimeout = setTimeout(() => {
      if (hostConnRef.current !== conn || conn.open) return;
      console.warn('Group host connection open timeout; scheduling another attempt.');
      clearInterval(openPoll);
      try {
        conn.close();
      } catch (err) {
        console.warn('Failed to close timed-out group connection:', err);
      }
      if (shouldReconnectRef.current && !isHostRef.current) {
        hostConnRef.current = null;
        setIsConnected(false);
        setIsConnecting(true);
        scheduleGuestReconnect(getP2PFailureReason());
      }
    }, CONNECTION_OPEN_TIMEOUT_MS);

    const onHostConnOpen = () => {
      if (openHandled || hostConnRef.current !== conn) return;
      openHandled = true;
      clearInterval(openPoll);
      clearTimeout(openTimeout);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      // Send our info to host
      conn.send({
        type: 'guest_info',
        nickname: myNicknameRef.current,
        color: myColorRef.current
      });
    };

    if (conn.open) {
      onHostConnOpen();
    } else {
      conn.on('open', onHostConnOpen);
    }

    conn.on('data', (data) => {
      if (!data) return;

      switch (data.type) {
        case 'request_info': {
          conn.send({
            type: 'guest_info',
            nickname: myNicknameRef.current,
            color: myColorRef.current
          });
          break;
        }
        case 'members_update': {
          setMembers(data.members || []);
          break;
        }
        case 'text':
        case 'sticker': {
          addMessage({
            id: data.id,
            sender: 'peer',
            nickname: data.nickname,
            color: data.color,
            type: data.type,
            content: data.content,
            timer: data.timer,
            replyTo: data.replyTo,
            timestamp: data.timestamp
          });
          break;
        }
        case 'file': {
          let blob = data.blob;
          if (!(blob instanceof Blob) && data.arrayBuffer) {
            blob = new Blob([data.arrayBuffer], { type: data.mime });
          }
          addMessage({
            id: data.id,
            sender: 'peer',
            nickname: data.nickname,
            color: data.color,
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
        }
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
        case 'status': {
          addMessage(data);
          break;
        }
        case 'typing': {
          if (data.isTyping) {
            setTypingUsers((prev) => new Set(prev).add(data.nickname));
          } else {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(data.nickname);
              return next;
            });
          }
          break;
        }
        case 'reaction': {
          updateMessageReaction(data.messageId, data.emoji, data.actorId || data.nickname || 'peer');
          break;
        }
        case 'burn': {
          burnMessages();
          break;
        }
        default:
          break;
      }
    });

    conn.on('close', () => {
      clearInterval(openPoll);
      clearTimeout(openTimeout);
      if (hostConnRef.current !== conn) return;
      setIsConnected(false);
      setIsConnecting(true);
      hostConnRef.current = null;
      if (shouldReconnectRef.current && !isHostRef.current) {
        scheduleGuestReconnect('Se perdio la conexion con el anfitrion grupal.');
      } else {
        setError('El anfitrion cerro la sala grupal.');
        setIsConnecting(false);
      }
    });

    conn.on('error', (err) => {
      console.error('Group host connection error:', err);
      clearInterval(openPoll);
      clearTimeout(openTimeout);
      if (hostConnRef.current !== conn) return;
      setIsConnected(false);
      setIsConnecting(true);
      if (shouldReconnectRef.current && !isHostRef.current) {
        scheduleGuestReconnect(getP2PFailureReason());
      }
    });
  };

  // Actions
  const sendMessage = (text, timer, replyTo = null) => {
    if (!isConnected) return;
    const msgId = 'gmsg-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    const payload = {
      id: msgId,
      type: 'text',
      content: text,
      nickname: myNicknameRef.current,
      color: myColorRef.current,
      timer: timer || null,
      replyTo,
      timestamp: Date.now()
    };

    if (isHostRef.current) {
      addMessage({ ...payload, sender: 'me' });
      broadcastFromHost(payload);
    } else if (hostConnRef.current && hostConnRef.current.open) {
      addMessage({ ...payload, sender: 'me' });
      hostConnRef.current.send(payload);
    }
  };

  const sendSticker = (stickerUrl, timer, replyTo = null) => {
    if (!isConnected) return;
    const msgId = 'gsticker-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    const payload = {
      id: msgId,
      type: 'sticker',
      content: stickerUrl,
      nickname: myNicknameRef.current,
      color: myColorRef.current,
      timer: timer || null,
      replyTo,
      timestamp: Date.now()
    };

    if (isHostRef.current) {
      addMessage({ ...payload, sender: 'me' });
      broadcastFromHost(payload);
    } else if (hostConnRef.current && hostConnRef.current.open) {
      addMessage({ ...payload, sender: 'me' });
      hostConnRef.current.send(payload);
    }
  };

  const sendFile = async (file, timer, viewOnce, replyTo = null) => {
    if (!isConnected) return;
    if (file.size > MAX_P2P_FILE_SIZE) {
      alert('El archivo supera el limite de 15MB para envios P2P.');
      return;
    }

    try {
      const msgId = createFileId('gfile');
      const timestamp = Date.now();
      const startPayload = createFileStartPayload({
        id: msgId,
        file,
        timer,
        viewOnce,
        timestamp,
        nickname: myNicknameRef.current,
        color: myColorRef.current,
        replyTo
      });

      const localMsg = createLocalFileMessage({
        id: msgId,
        file,
        timer,
        viewOnce,
        timestamp,
        nickname: myNicknameRef.current,
        color: myColorRef.current,
        replyTo
      });

      if (isHostRef.current) {
        addMessage(localMsg);
        await sendFileChunks(file, startPayload, broadcastFromHost);
      } else if (hostConnRef.current && hostConnRef.current.open) {
        addMessage(localMsg);
        await sendFileChunks(file, startPayload, (payload) => {
          if (!hostConnRef.current || !hostConnRef.current.open) {
            throw new Error('La conexion con el anfitrion se cerro durante el envio.');
          }
          hostConnRef.current.send(payload);
        });
      }
    } catch (err) {
      console.error('Failed to send group file:', err);
      addMessage({
        id: 'system-err-' + Date.now(),
        sender: 'system',
        type: 'status',
        content: 'Error al enviar "' + file.name + '" por partes.',
        timestamp: Date.now()
      });
    }
  };

  const sendTyping = (isTyping) => {
    if (!isConnected) return;
    const payload = {
      type: 'typing',
      nickname: myNicknameRef.current,
      isTyping
    };
    if (isHostRef.current) {
      broadcastFromHost(payload);
    } else if (hostConnRef.current && hostConnRef.current.open) {
      hostConnRef.current.send(payload);
    }
  };

  const sendReaction = (messageId, emoji) => {
    if (!isConnected) return;

    const actorId = getLocalActorId();
    const payload = {
      type: 'reaction',
      messageId,
      emoji,
      actorId,
      nickname: myNicknameRef.current,
      timestamp: Date.now()
    };

    updateMessageReaction(messageId, emoji, actorId);

    if (isHostRef.current) {
      broadcastFromHost(payload);
    } else if (hostConnRef.current && hostConnRef.current.open) {
      hostConnRef.current.send(payload);
    }
  };

  const burnMessages = () => {
    setMessages([]);
  };

  const burn = () => {
    burnMessages();
    const payload = { type: 'burn' };
    if (isHostRef.current) {
      broadcastFromHost(payload);
    } else if (hostConnRef.current && hostConnRef.current.open) {
      hostConnRef.current.send(payload);
    }
  };

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

  const disconnect = () => {
    shouldReconnectRef.current = false;
    roomIdRef.current = null;
    clearRetryTimer(reconnectTimerRef);
    clearRetryTimer(hostRecoveryTimerRef);
    incomingFilesRef.current.clear();
    if (hostConnRef.current) {
      hostConnRef.current.close();
      hostConnRef.current = null;
    }
    connectionsRef.current.forEach((obj) => {
      if (obj.conn) obj.conn.close();
    });
    connectionsRef.current.clear();

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
    error,
    messages,
    members,
    typingUsers: Array.from(typingUsers),
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
