import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const isId = (v) => mongoose.isValidObjectId(v) && String(v).length === 24;

export function errorHandler(err, _req, res, _next) {
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'Already exists' });
  if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
}

// Loads a conversation and asserts the user is a member.
export async function requireMember(conversationId, userId) {
  if (!isId(conversationId)) throw new HttpError(400, 'Invalid conversation id');
  const convo = await Conversation.findById(conversationId);
  if (!convo) throw new HttpError(404, 'Conversation not found');
  if (!convo.members.some((m) => String(m) === String(userId))) {
    throw new HttpError(403, 'Not a member of this conversation');
  }
  return convo;
}
