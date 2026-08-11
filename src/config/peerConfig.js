const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

function readIceServers() {
  const rawValue = import.meta.env.VITE_ICE_SERVERS_JSON;
  if (!rawValue) return DEFAULT_ICE_SERVERS;

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ICE_SERVERS;
  } catch (err) {
    console.warn('Invalid VITE_ICE_SERVERS_JSON. Falling back to default STUN servers.', err);
    return DEFAULT_ICE_SERVERS;
  }
}

function serverUrls(server) {
  if (!server?.urls) return [];
  return Array.isArray(server.urls) ? server.urls : [server.urls];
}

export function hasConfiguredTurnServer() {
  return readIceServers().some((server) => {
    return serverUrls(server).some((url) => String(url).toLowerCase().startsWith('turn:') || String(url).toLowerCase().startsWith('turns:'));
  });
}

export function createPeerOptions() {
  const debugLevel = Number.parseInt(import.meta.env.VITE_PEER_DEBUG ?? '0', 10);
  const options = {
    debug: Number.isFinite(debugLevel) ? debugLevel : 0,
    config: {
      iceServers: readIceServers()
    }
  };

  if (import.meta.env.VITE_PEER_HOST) {
    options.host = import.meta.env.VITE_PEER_HOST;
  }

  if (import.meta.env.VITE_PEER_PATH) {
    options.path = import.meta.env.VITE_PEER_PATH;
  }

  if (import.meta.env.VITE_PEER_PORT) {
    const port = Number.parseInt(import.meta.env.VITE_PEER_PORT, 10);
    if (Number.isFinite(port)) {
      options.port = port;
    }
  }

  if (import.meta.env.VITE_PEER_SECURE) {
    options.secure = import.meta.env.VITE_PEER_SECURE === 'true';
  }

  return options;
}
