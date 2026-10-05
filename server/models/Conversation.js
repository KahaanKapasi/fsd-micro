import mongoose from 'mongoose';
import { jsonContract } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group', 'announcement'], required: true },
    members: [{ type: ObjectId, ref: 'User', required: true }],
    adminRef: { type: ObjectId, ref: 'User' },
    name: { type: String, trim: true, maxlength: 80, default: '' },
    topic: { type: String, trim: true, maxlength: 250, default: '' },
    // sorted "idA:idB" for direct chats so a pair can only ever have one conversation
    directKey: { type: String, unique: true, sparse: true },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ members: 1, lastMessageAt: -1 });

conversationSchema.pre('validate', function requireName(next) {
  if (this.type !== 'direct' && !this.name) {
    return next(new Error('Channels need a name'));
  }
  if (this.type === 'direct' && this.members.length !== 2) {
    return next(new Error('Direct conversations need exactly 2 members'));
  }
  next();
});

jsonContract(conversationSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);
