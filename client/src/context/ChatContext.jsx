import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from './SocketContext.jsx';

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);

const BASE_INDEX = 1_000_000; // Virtuoso firstItemIndex anchor so prepending older messages keeps scroll position
const upsert = (list, item) => (list.some((x) => x._id === item._id) ? list.map((x) => (x._id === item._id ? item : x)) : [...list, item]);

export function ChatProvider({ children }) {
  const { user, setUser } = useAuth();
  const { socket } = useSocket();

  const [users, setUsers] = useState({});
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState({}); // convId -> { items, hasMore, firstIndex }
  const [typing, setTyping] = useState({}); // convId -> { userId: true }
  const [tasks, setTasks] = useState({}); // taskId -> task
  const [toasts, setToasts] = useState([]);
  const activeRef = useRef(null);
  activeRef.current = activeId;

  const toast = useCallback((t) => {
    const id = crypto.randomUUID();
    setToasts((x) => [...x, { id, ...t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 8000);
  }, []);

  // ---- initial load
  useEffect(() => {
    // reset per-user state so a different account never sees the previous one's data
    setUsers({});
    setConversations([]);
    setActiveId(null);
    setMessages({});
    setTyping({});
    setTasks({});
    setToasts([]);
    if (!user) return undefined;
    let live = true;
    api.get('/users').then(({ users }) => live && setUsers(Object.fromEntries(users.map((u) => [u._id, u])))).catch(() => {});
    api.get('/conversations').then(({ conversations }) => live && setConversations(conversations)).catch(() => {});
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    return () => {
      live = false;
    };
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback(
    (conversationId) => {
      socket?.emit('mark_read', { conversationId });
      setConversations((cs) => cs.map((c) => (c._id === conversationId ? { ...c, unread: 0 } : c)));
    },
    [socket]
  );

  // ---- realtime wiring
  useEffect(() => {
    if (!socket || !user) return undefined;
    const uid = user._id;

    const onMessage = (m) => {
      setMessages((all) => {
        const cur = all[m.conversationId];
        if (!cur) return all; // not opened yet: history will be fetched on open
        return { ...all, [m.conversationId]: { ...cur, items: upsert(cur.items, m) } };
      });
      const viewing = activeRef.current === m.conversationId && document.visibilityState === 'visible';
      setConversations((cs) =>
        cs
          .map((c) =>
            c._id === m.conversationId
              ? { ...c, lastMessageAt: m.createdAt, unread: m.senderId === uid || viewing ? c.unread : (c.unread || 0) + 1 }
              : c
          )
          .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      );
      if (viewing && m.senderId !== uid) markRead(m.conversationId);
      setTyping((t) => {
        if (!t[m.conversationId]?.[m.senderId]) return t;
        const { [m.senderId]: _drop, ...rest } = t[m.conversationId];
        return { ...t, [m.conversationId]: rest };
      });
    };

    const onRead = ({ conversationId, userId }) =>
      setMessages((all) => {
        const cur = all[conversationId];
        if (!cur) return all;
        const items = cur.items.map((m) => (m.readBy.includes(userId) ? m : { ...m, readBy: [...m.readBy, userId] }));
        return { ...all, [conversationId]: { ...cur, items } };
      });

    const onConvo = (c) => setConversations((cs) => (cs.some((x) => x._id === c._id) ? cs.map((x) => (x._id === c._id ? { ...x, ...c } : x)) : [{ ...c, unread: 0 }, ...cs]));
    const onPresence = ({ userId, status }) => {
      setUsers((u) => (u[userId] ? { ...u, [userId]: { ...u[userId], status } } : u));
      if (userId === uid) setUser((me) => (me ? { ...me, status } : me));
    };
    const setTyper = (on) => ({ conversationId, userId }) =>
      setTyping((t) => {
        const cur = { ...(t[conversationId] || {}) };
        on ? (cur[userId] = true) : delete cur[userId];
        return { ...t, [conversationId]: cur };
      });
    const onStopTyping = setTyper(false);
    // a typist who disconnects never sends typing_stop: expire stale indicators (each keystroke re-sends typing_start)
    const typerTimers = {};
    const onTyping = (e) => {
      setTyper(true)(e);
      const key = `${e.conversationId}:${e.userId}`;
      clearTimeout(typerTimers[key]);
      typerTimers[key] = setTimeout(() => onStopTyping(e), 6000);
    };

    const onTask = (t) => setTasks((x) => ({ ...x, [t._id]: t }));
    const onTaskDeleted = ({ _id }) =>
      setTasks((x) => {
        const { [_id]: _gone, ...rest } = x;
        return rest;
      });
    const onReminder = (r) => {
      toast({ title: r.window === '1h' ? 'Due within 1 hour' : 'Due within 24 hours', body: r.title, conversationId: r.conversationId });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(r.window === '1h' ? 'Task due in 1 hour' : 'Task due tomorrow', { body: r.title });
      }
    };

    const handlers = {
      receive_message: onMessage,
      messages_read: onRead,
      conversation_created: onConvo,
      conversation_updated: onConvo,
      presence_update: onPresence,
      typing_start: onTyping,
      typing_stop: onStopTyping,
      task_created: onTask,
      task_updated: onTask,
      task_deleted: onTaskDeleted,
      task_deadline_reminder: onReminder,
    };
    Object.entries(handlers).forEach(([e, h]) => socket.on(e, h));
    return () => {
      Object.entries(handlers).forEach(([e, h]) => socket.off(e, h));
      Object.values(typerTimers).forEach(clearTimeout);
    };
  }, [socket, user?._id, markRead, toast, setUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions
  const loadTasks = useCallback(async (conversationId) => {
    const { tasks: list } = await api.get(`/tasks/${conversationId}`);
    setTasks((x) => ({ ...x, ...Object.fromEntries(list.map((t) => [t._id, t])) }));
  }, []);

  const selectConversation = useCallback(
    async (id) => {
      setActiveId(id);
      if (!id) return;
      socket?.emit('join_room', { conversationId: id });
      try {
        const { messages: items, hasMore } = await api.get(`/conversations/${id}/messages?limit=50`);
        setMessages((all) => ({ ...all, [id]: { items, hasMore, firstIndex: BASE_INDEX - items.length } }));
        loadTasks(id).catch(() => {});
        markRead(id);
      } catch (e) {
        toast({ title: 'Could not load messages', body: e.message, conversationId: id });
      }
    },
    [socket, markRead, loadTasks, toast]
  );

  const loadingOlder = useRef(new Set());
  const loadOlder = useCallback(
    async (id) => {
      const cur = messages[id];
      if (!cur?.hasMore || !cur.items.length || loadingOlder.current.has(id)) return;
      loadingOlder.current.add(id);
      try {
        const { messages: older, hasMore } = await api.get(`/conversations/${id}/messages?limit=50&before=${encodeURIComponent(cur.items[0].createdAt)}`);
        setMessages((all) => {
          if (!all[id]) return all;
          const have = new Set(all[id].items.map((m) => m._id));
          const fresh = older.filter((m) => !have.has(m._id));
          return { ...all, [id]: { items: [...fresh, ...all[id].items], hasMore, firstIndex: all[id].firstIndex - fresh.length } };
        });
      } catch {
        /* keep current page; the next scroll to top retries */
      } finally {
        loadingOlder.current.delete(id);
      }
    },
    [messages]
  );

  const sendMessage = useCallback(
    (conversationId, content, attachments = []) =>
      new Promise((resolve, reject) => {
        if (!socket) return reject(new Error('Not connected. Please wait and retry.'));
        socket.timeout(8000).emit('send_message', { conversationId, content, attachments }, (err, ack) => {
          if (err) return reject(new Error('Timed out. Check your connection.'));
          ack.ok ? resolve(ack) : reject(new Error(ack.error));
        });
      }),
    [socket]
  );

  const startDirect = useCallback(
    async (userId) => {
      const { conversation } = await api.post('/conversations', { type: 'direct', userId });
      setConversations((cs) => (cs.some((c) => c._id === conversation._id) ? cs : [{ ...conversation, unread: 0 }, ...cs]));
      await selectConversation(conversation._id);
    },
    [selectConversation]
  );

  const createChannel = useCallback(
    async (body) => {
      const { conversation } = await api.post('/conversations', body);
      setConversations((cs) => (cs.some((c) => c._id === conversation._id) ? cs : [{ ...conversation, unread: 0 }, ...cs]));
      await selectConversation(conversation._id);
    },
    [selectConversation]
  );

  const joinChannel = useCallback(
    async (id) => {
      const { conversation } = await api.post(`/conversations/${id}/join`);
      setConversations((cs) => (cs.some((c) => c._id === id) ? cs : [{ ...conversation, unread: 0 }, ...cs]));
      await selectConversation(id);
    },
    [selectConversation]
  );

  const saveTask = useCallback(async (task) => {
    const { task: saved } = await api.patch(`/tasks/${task._id}`, task.patch);
    setTasks((x) => ({ ...x, [saved._id]: saved }));
    return saved;
  }, []);

  const setStatus = useCallback(
    async (status) => {
      const { user: me } = await api.patch('/users/me', { status });
      setUser(me);
    },
    [setUser]
  );

  const value = useMemo(
    () => ({
      me: user, users, conversations, activeId, messages, typing, tasks, toasts,
      active: conversations.find((c) => c._id === activeId) || null,
      selectConversation, loadOlder, sendMessage, startDirect, createChannel, joinChannel, saveTask, setStatus, loadTasks,
      dismissToast: (id) => setToasts((x) => x.filter((t) => t.id !== id)),
      startTyping: (id) => socket?.emit('typing_start', { conversationId: id }),
      stopTyping: (id) => socket?.emit('typing_stop', { conversationId: id }),
    }),
    [user, users, conversations, activeId, messages, typing, tasks, toasts, selectConversation, loadOlder, sendMessage, startDirect, createChannel, joinChannel, saveTask, setStatus, loadTasks, socket]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export { BASE_INDEX };
