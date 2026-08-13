export const MAX_P2P_FILE_SIZE = 15 * 1024 * 1024;
export const FILE_CHUNK_SIZE = 64 * 1024;

export function createFileId(prefix = 'file') {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
}

export function createFileStartPayload({ id, file, timer, viewOnce, timestamp, nickname, color, replyTo }) {
  const payload = {
    id,
    type: 'file_start',
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    totalChunks: Math.max(1, Math.ceil(file.size / FILE_CHUNK_SIZE)),
    timer: timer || null,
    viewOnce: viewOnce || false,
    timestamp
  };

  if (nickname) payload.nickname = nickname;
  if (color) payload.color = color;
  if (replyTo) payload.replyTo = replyTo;

  return payload;
}

export function createLocalFileMessage({ id, file, timer, viewOnce, timestamp, nickname, color, replyTo }) {
  const message = {
    id,
    sender: 'me',
    type: 'file',
    fileBlob: file,
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    timer: timer || null,
    viewOnce: viewOnce || false,
    timestamp
  };

  if (nickname) message.nickname = nickname;
  if (color) message.color = color;
  if (replyTo) message.replyTo = replyTo;

  return message;
}

export async function sendFileChunks(file, startPayload, sendPayload) {
  sendPayload(startPayload);

  for (let chunkIndex = 0; chunkIndex < startPayload.totalChunks; chunkIndex += 1) {
    const start = chunkIndex * FILE_CHUNK_SIZE;
    const end = Math.min(start + FILE_CHUNK_SIZE, file.size);
    const arrayBuffer = await file.slice(start, end).arrayBuffer();

    sendPayload({
      type: 'file_chunk',
      id: startPayload.id,
      chunkIndex,
      totalChunks: startPayload.totalChunks,
      arrayBuffer
    });

    if (chunkIndex % 8 === 7) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  sendPayload({
    type: 'file_end',
    id: startPayload.id
  });
}

export function startIncomingFileTransfer(transfers, payload) {
  if (!payload?.id || !payload.totalChunks) return;

  transfers.set(payload.id, {
    id: payload.id,
    name: payload.name,
    mime: payload.mime || 'application/octet-stream',
    size: payload.size,
    timer: payload.timer || null,
    viewOnce: payload.viewOnce || false,
    timestamp: payload.timestamp || Date.now(),
    nickname: payload.nickname,
    color: payload.color,
    replyTo: payload.replyTo,
    totalChunks: payload.totalChunks,
    chunks: new Array(payload.totalChunks),
    receivedChunks: 0
  });
}

export function acceptIncomingFileChunk(transfers, payload) {
  const transfer = transfers.get(payload?.id);
  if (!transfer || payload.chunkIndex == null || !payload.arrayBuffer) return null;

  if (!transfer.chunks[payload.chunkIndex]) {
    transfer.chunks[payload.chunkIndex] = payload.arrayBuffer;
    transfer.receivedChunks += 1;
  }

  if (transfer.receivedChunks < transfer.totalChunks) return null;

  transfers.delete(payload.id);

  return {
    ...transfer,
    blob: new Blob(transfer.chunks, { type: transfer.mime })
  };
}

export function createIncomingFileMessage(transfer, sender = 'peer') {
  const message = {
    id: transfer.id,
    sender,
    type: 'file',
    fileBlob: transfer.blob,
    fileName: transfer.name,
    fileType: transfer.mime,
    fileSize: transfer.size,
    timer: transfer.timer,
    viewOnce: transfer.viewOnce,
    timestamp: transfer.timestamp
  };

  if (transfer.nickname) message.nickname = transfer.nickname;
  if (transfer.color) message.color = transfer.color;
  if (transfer.replyTo) message.replyTo = transfer.replyTo;

  return message;
}
