import { Task } from '../../models/Task.js';
import { Message } from '../../models/Message.js';
import { HttpError } from '../../core/http.js';
import { createMessage } from '../../core/messageService.js';
import { emitToConversation } from '../../core/realtime.js';

const EDITABLE = ['title', 'description', 'assignees', 'dueDate', 'priority', 'status'];

// Creates the task, posts an in-stream task card message, and broadcasts both.
export async function createTask({ conversation, creatorId, title, description, assignees = [], dueDate, priority, status, messageRef }) {
  const memberIds = conversation.members.map(String);
  const cleanAssignees = [...new Set(assignees.map(String))].filter((a) => memberIds.includes(a));
  if (messageRef) {
    const origin = await Message.findOne({ _id: messageRef, conversationId: conversation._id });
    if (!origin) throw new HttpError(400, 'messageId does not belong to this conversation');
  }
  const task = await Task.create({
    title,
    description,
    conversationId: conversation._id,
    messageRef: messageRef || undefined,
    creatorId,
    assignees: cleanAssignees,
    dueDate: dueDate || undefined,
    priority,
    status,
  });
  const message = await createMessage({
    conversationId: conversation._id,
    senderId: creatorId,
    content: `Task: ${task.title}`,
    taskRef: task._id,
  });
  emitToConversation(conversation._id, 'task_created', task.toJSON());
  return { task, message };
}

export async function updateTask(task, patch) {
  for (const key of EDITABLE) if (patch[key] !== undefined) task[key] = patch[key];
  if (patch.dueDate !== undefined) {
    task.reminded24h = false; // rescheduled: reminders fire again
    task.reminded1h = false;
  }
  await task.save();
  emitToConversation(task.conversationId, 'task_updated', task.toJSON());
  return task;
}

export async function deleteTask(task) {
  await task.deleteOne();
  emitToConversation(task.conversationId, 'task_deleted', {
    _id: String(task._id),
    conversationId: String(task.conversationId),
  });
}
