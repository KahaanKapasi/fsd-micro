import { Router } from 'express';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from './auth.js';
import { HttpError, asyncHandler, isId, requireMember } from './http.js';
import { emitToUser, joinUsersToRoom } from './realtime.js';

const router = Router();
router.use(requireAuth);

const directKey = (a, b) => [String(a), String(b)].sort().join(':');

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({ members: req.user._id }).sort({ lastMessageAt: -1 });
    // unread = messages from others that this user has not read
    const unread = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversations.map((c) => c._id) },
          senderId: { $ne: req.user._id },
          readBy: { $ne: req.user._id },
        },
      },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
    ]);
    const unreadMap = Object.fromEntries(unread.map((u) => [String(u._id), u.count]));
    res.json({
      conversations: conversations.map((c) => ({ ...c.toJSON(), unread: unreadMap[String(c._id)] || 0 })),
    });
  })
);

// Browse channels the user has not joined yet
router.get(
  '/discover',
  asyncHandler(async (req, res) => {
    const channels = await Conversation.find({ type: { $ne: 'direct' }, members: { $ne: req.user._id } }).limit(50);
    res.json({ conversations: channels });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { type = 'direct', name, topic, members = [], userId } = req.body || {};
    if (!['direct', 'group', 'announcement'].includes(type)) throw new HttpError(400, 'Invalid type');
    const me = req.user._id;

    let convo;
    let created = true;
    if (type === 'direct') {
      const other = userId || members[0];
      if (!isId(other)) throw new HttpError(400, 'userId is required for direct conversations');
      if (String(other) === String(me)) throw new HttpError(400, 'Cannot start a conversation with yourself');
      if (!(await User.exists({ _id: other }))) throw new HttpError(404, 'User not found');
      const key = directKey(me, other);
      convo = await Conversation.findOne({ directKey: key });
      if (convo) created = false;
      else {
        try {
          convo = await Conversation.create({ type, members: [me, other], directKey: key });
        } catch (err) {
          // lost a race with a concurrent create: the unique directKey guarantees the winner exists
          if (err.code !== 11000) throw err;
          convo = await Conversation.findOne({ directKey: key });
          created = false;
        }
      }
    } else {
      if (!Array.isArray(members)) throw new HttpError(400, 'members must be an array');
      const ids = [...new Set([String(me), ...members.map(String)])];
      if (!ids.every(isId)) throw new HttpError(400, 'Invalid member id');
      const found = await User.countDocuments({ _id: { $in: ids } });
      if (found !== ids.length) throw new HttpError(404, 'Some members do not exist');
      convo = await Conversation.create({ type, name, topic, members: ids, adminRef: me });
    }

    if (created) {
      const ids = convo.members.map(String);
      joinUsersToRoom(ids, convo._id);
      ids.forEach((id) => emitToUser(id, 'conversation_created', convo.toJSON()));
    }
    res.status(created ? 201 : 200).json({ conversation: convo });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const convo = await requireMember(req.params.id, req.user._id);
    res.json({ conversation: convo });
  })
);

router.post(
  '/:id/join',
  asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) throw new HttpError(400, 'Invalid conversation id');
    const convo = await Conversation.findById(req.params.id);
    if (!convo) throw new HttpError(404, 'Conversation not found');
    if (convo.type === 'direct') throw new HttpError(400, 'Cannot join a direct conversation');
    await Conversation.updateOne({ _id: convo._id }, { $addToSet: { members: req.user._id } });
    const updated = await Conversation.findById(convo._id);
    joinUsersToRoom([req.user._id], convo._id);
    updated.members.forEach((m) => emitToUser(m, 'conversation_updated', updated.toJSON()));
    res.json({ conversation: updated });
  })
);

router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    await requireMember(req.params.id, req.user._id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const filter = { conversationId: req.params.id };
    if (req.query.before) {
      const before = new Date(req.query.before);
      if (Number.isNaN(before.getTime())) throw new HttpError(400, 'Invalid before');
      filter.createdAt = { $lt: before };
    }
    const page = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json({ messages: page.reverse(), hasMore: page.length === limit });
  })
);

export default router;
