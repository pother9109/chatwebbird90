# GhostChat

GhostChat es una app React/Vite para salas temporales P2P con PeerJS. Incluye chat privado 1 a 1 y chat grupal donde el anfitrion actua como rele entre participantes.

## Scripts

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run preview
```

En PowerShell, usa `npm.cmd` si `npm` queda bloqueado por la politica local de ejecucion de scripts.

## Notas tecnicas

- La app no usa base de datos ni backend propio.
- PeerJS requiere un servidor de senalizacion y servidores STUN/TURN para establecer conexiones WebRTC.
- Para produccion, conviene configurar TURN propio, generar el QR localmente y revisar los textos de privacidad para que coincidan exactamente con la arquitectura real.
