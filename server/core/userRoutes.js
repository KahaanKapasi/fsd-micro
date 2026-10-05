import { Router } from 'express';
import { User } from '../models/User.js';
import { requireAuth } from './auth.js';
import { HttpError, asyncHandler } from './http.js';
import { getIO } from './realtime.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const filter = q ? { $or: [{ name: new RegExp(escape(q), 'i') }, { email: new RegExp(escape(q), 'i') }] } : {};
    res.json({ users: await User.find(filter).sort({ name: 1 }).limit(200) });
  })
);

router.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const { name, avatar, status } = req.body || {};
    if (status && !['online', 'offline', 'busy'].includes(status)) throw new HttpError(400, 'Invalid status');
    if (name !== undefined) req.user.name = name;
    if (avatar !== undefined) req.user.avatar = avatar;
    if (status) req.user.status = status;
    await req.user.save();
    if (status) getIO()?.emit('presence_update', { userId: String(req.user._id), status });
    res.json({ user: req.user });
  })
);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default router;
