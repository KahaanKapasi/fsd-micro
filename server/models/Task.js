import mongoose from 'mongoose';
import { jsonContract } from './plugins.js';

const { ObjectId } = mongoose.Schema.Types;

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 4000 },
    conversationId: { type: ObjectId, ref: 'Conversation', required: true, index: true },
    messageRef: { type: ObjectId, ref: 'Message' },
    creatorId: { type: ObjectId, ref: 'User', required: true },
    assignees: [{ type: ObjectId, ref: 'User' }],
    dueDate: { type: Date },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['todo', 'in_progress', 'completed'], default: 'todo' },
    // scheduler bookkeeping so each reminder fires once
    reminded24h: { type: Boolean, default: false },
    reminded1h: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskSchema.index({ status: 1, dueDate: 1 });

jsonContract(taskSchema);
export const Task = mongoose.model('Task', taskSchema);
