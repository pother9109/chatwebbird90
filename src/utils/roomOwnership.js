const OWNED_ROOM_PREFIX = 'ghostchat:owned-room';

function roomKey(roomId, mode) {
  return `${OWNED_ROOM_PREFIX}:${mode}:${roomId}`;
}

export function markOwnedRoom(roomId, mode) {
  if (!roomId || !mode) return;
  try {
    window.localStorage.setItem(roomKey(roomId, mode), 'true');
  } catch (err) {
    console.warn('Could not persist owned room marker:', err);
  }
}

export function isOwnedRoom(roomId, mode) {
  if (!roomId || !mode) return false;
  try {
    return window.localStorage.getItem(roomKey(roomId, mode)) === 'true';
  } catch (err) {
    console.warn('Could not read owned room marker:', err);
    return false;
  }
}
