export const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export function createReplyPreview(message) {
  if (!message || message.sender === 'system') return null;

  let label = message.sender === 'me' ? 'Tu' : (message.nickname || 'Contacto');
  let text = message.content || '';

  if (message.type === 'sticker') {
    text = 'Sticker';
  } else if (message.type === 'file') {
    text = message.viewOnce ? 'Foto de un solo uso' : (message.fileName || 'Archivo');
  }

  return {
    id: message.id,
    sender: message.sender,
    label,
    type: message.type,
    text: String(text).slice(0, 120)
  };
}

export function applyReactionToMessages(messages, messageId, emoji, actorId) {
  if (!messageId || !emoji || !actorId) return messages;

  return messages.map((message) => {
    if (message.id !== messageId) return message;

    const reactions = { ...(message.reactions || {}) };
    const actors = { ...(reactions[emoji] || {}) };

    if (actors[actorId]) {
      delete actors[actorId];
    } else {
      actors[actorId] = true;
    }

    if (Object.keys(actors).length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = actors;
    }

    return {
      ...message,
      reactions
    };
  });
}
