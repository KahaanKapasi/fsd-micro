import { Server } from 'socket.io';
import { config } from '../config.js';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { verifyToken, COOKIE_NAME } from './auth.js';
import { assertCanPost, createMessage, markRead } from './messageService.js';
import { HttpError, requireMember } from './http.js';
import { setIO } from './realtime.js';
import { parseTaskCommand, resolveMentions } from '../modules/tasks/slash.js';
import { createTask } from '../modules/tasks/service.js';

const connections = new Map(); // userId -> live socket count (multi-tab safe)

function tokenFrom(socket) {
  const auth = socket.handshake.auth?.token;
  if (auth) return auth.replace(/^Bearer /, '');
  const header = socket.handshake.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookies = socket.handshake.headers.cookie || '';
  const match = cookies.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
}

// Wraps a handler so failures go to the ack callback instead of crashing the process.
const handle = (fn) => async (payload, ack) => {
  const cb = typeof ack === 'function' ? ack : () => {};
  try {
    cb({ ok: true, ...(await fn(payload || {})) });
  } catch (err) {
    // only surface errors meant for clients; hide driver/internal messages
    const safe = err instanceof HttpError || err.name === 'ValidationError';
    if (!safe) console.error('[socket] handler failed', err);
    cb({ ok: false, error: safe ? err.message : 'Internal server error' });
  }
};

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = tokenFrom(socket);
      if (!token) return next(new Error('Authentication required'));
      const user = await User.findById(verifyToken(token).sub);
      if (!user) return next(new Error('User not found'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;
    const uid = String(user._id);

    socket.join(`user:${uid}`);
    const count = (connections.get(uid) || 0) + 1;
    connections.set(uid, count);

    // handlers below are registered synchronously so early events (and a quick disconnect) are never missed
    (async () => {
      const convos = await Conversation.find({ members: user._id }).select('_id');
      convos.forEach((c) => socket.join(String(c._id)));
      if (count === 1 && user.status !== 'busy') {
        await User.updateOne({ _id: user._id }, { status: 'online' });
        io.emit('presence_update', { userId: uid, status: 'online' });
      }
    })().catch((err) => console.error('[socket] connection setup failed', err.message));

    socket.on(
      'join_room',
      handle(async ({ conversationId }) => {
        await requireMember(conversationId, user._id);
        socket.join(String(conversationId));
        return {};
      })
    );

    socket.on(
      'leave_room',
      handle(async ({ conversationId }) => {
        socket.leave(String(conversationId));
        return {};
      })
    );

    socket.on(
      'send_message',
      handle(async ({ conversationId, content = '', messageType, attachments = [] }) => {
        const convo = await requireMember(conversationId, user._id);
        assertCanPost(convo, user._id);
        const text = String(content);
        if (!Array.isArray(attachments) || attachments.length > 5) throw new HttpError(400, 'Invalid attachments');
        // attachments must come from POST /upload: block arbitrary/external URLs
        const cleanAttachments = attachments.map((a) => {
          if (typeof a?.url !== 'string' || !/^\/uploads\/[\w.-]+$/.test(a.url)) throw new HttpError(400, 'Invalid attachment');
          return { url: a.url, fileType: String(a.fileType || ''), size: Number(a.size) || 0, name: String(a.name || 'file') };
        });
        if (messageType !== undefined && !['text', 'file', 'audio'].includes(messageType)) throw new HttpError(400, 'Invalid messageType');

        // `/task Title @user due:YYYY-MM-DD` creates a task + in-stream task card
        const cmd = parseTaskCommand(text);
        if (cmd) {
          if (!cmd.title) throw new HttpError(400, 'Usage: /task Title @user due:YYYY-MM-DD');
          const members = await User.find({ _id: { $in: convo.members } });
          const { task, message } = await createTask({
            conversation: convo,
            creatorId: user._id,
            title: cmd.title,
            assignees: resolveMentions(cmd.mentions, members),
            dueDate: cmd.dueDate,
          });
          return { message, task: task.toJSON() };
        }

        const message = await createMessage({
          conversationId: convo._id,
          senderId: user._id,
          content: text,
          messageType,
          attachments: cleanAttachments,
        });
        return { message };
      })
    );

    socket.on(
      'mark_read',
      handle(async ({ conversationId }) => {
        await requireMember(conversationId, user._id);
        return { modified: await markRead(conversationId, user._id) };
      })
    );

    for (const event of ['typing_start', 'typing_stop']) {
      socket.on(event, ({ conversationId } = {}) => {
        // only relay to rooms this socket is actually in
        if (conversationId && socket.rooms.has(String(conversationId))) {
          socket.to(String(conversationId)).emit(event, { conversationId: String(conversationId), userId: uid });
        }
      });
    }

    socket.on('presence_update', async ({ status } = {}) => {
      if (!['online', 'busy'].includes(status)) return;
      try {
        await User.updateOne({ _id: user._id }, { status });
        io.emit('presence_update', { userId: uid, status });
      } catch (err) {
        console.error('[socket] presence update failed', err.message);
      }
    });

    socket.on('disconnect', async () => {
      const left = (connections.get(uid) || 1) - 1;
      if (left > 0) return connections.set(uid, left);
      connections.delete(uid);
      try {
        if (connections.has(uid)) return; // reconnected while we were disconnecting
        await User.updateOne({ _id: user._id }, { status: 'offline' });
        if (connections.has(uid)) await User.updateOne({ _id: user._id, status: 'offline' }, { status: 'online' });
        else io.emit('presence_update', { userId: uid, status: 'offline' });
      } catch (err) {
        console.error('[socket] failed to record offline status', err.message);
      }
    });
  });

  return io;
}
