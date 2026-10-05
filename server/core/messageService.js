import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { HttpError } from './http.js';
import { emitToConversation } from './realtime.js';

// Single write path for messages so sockets, tasks and slash commands all broadcast identically.
export async function createMessage({ conversationId, senderId, content = '', messageType, attachments = [], taskRef }) {
  const type = messageType || (taskRef ? 'task' : attachments.length ? 'file' : 'text');
  const message = await Message.create({
    conversationId,
    senderId,
    content,
    messageType: type,
    attachments,
    taskRef,
    readBy: [senderId],
  });
  await Conversation.updateOne({ _id: conversationId }, { lastMessageAt: message.createdAt });
  const json = message.toJSON();
  emitToConversation(conversationId, 'receive_message', json);
  return json;
}

export function assertCanPost(convo, userId) {
  if (convo.type === 'announcement' && String(convo.adminRef) !== String(userId)) {
    throw new HttpError(403, 'Only the channel admin can post in announcement channels');
  }
}

export async function markRead(conversationId, userId) {
  const res = await Message.updateMany(
    { conversationId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );
  if (res.modifiedCount) {
    emitToConversation(conversationId, 'messages_read', { conversationId: String(conversationId), userId: String(userId) });
  }
  return res.modifiedCount;
}
