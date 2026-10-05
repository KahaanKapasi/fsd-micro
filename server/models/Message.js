import mongoose from 'mongoose';
import { jsonContract } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileType: { type: String, required: true },
    size: { type: Number, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: ObjectId, ref: 'User', required: true },
    conversationId: { type: ObjectId, ref: 'Conversation', required: true, index: true },
    content: { type: String, default: '', maxlength: 8000 },
    // 'task' is an extension to the base enum: a rich task card rendered in the stream
    messageType: { type: String, enum: ['text', 'file', 'audio', 'task'], default: 'text' },
    attachments: [attachmentSchema],
    readBy: [{ type: ObjectId, ref: 'User' }],
    // AI: cached translations keyed by language code (avoids repeat API billing)
    translations: { type: Map, of: String, default: undefined },
    // Tasks: card messages point at their task
    taskRef: { type: ObjectId, ref: 'Task' },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

messageSchema.pre('validate', function requireBody(next) {
  const hasBody = this.content?.trim() || this.attachments?.length || this.taskRef;
  if (!hasBody) return next(new Error('Message needs content or an attachment'));
  next();
});

jsonContract(messageSchema);
export const Message = mongoose.model('Message', messageSchema);
