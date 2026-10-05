import { Router } from 'express';
import { User } from '../models/User.js';
import { COOKIE_NAME, cookieOptions, requireAuth, signToken } from './auth.js';
import { HttpError, asyncHandler } from './http.js';

const router = Router();

const session = (res, user) => {
  const token = signToken(user._id);
  res.cookie(COOKIE_NAME, token, cookieOptions);
  return res.json({ user, token });
};

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, avatar } = req.body || {};
    if (!name || !email || !password) throw new HttpError(400, 'name, email and password are required');
    if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (await User.exists({ email: String(email).toLowerCase() })) throw new HttpError(409, 'Email already registered');
    const user = await User.create({ name, email, avatar, passwordHash: await User.hashPassword(String(password)) });
    res.status(201);
    session(res, user);
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw new HttpError(400, 'email and password are required');
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
    if (!user || !(await user.verifyPassword(String(password)))) throw new HttpError(401, 'Invalid credentials');
    session(res, user);
  })
);

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
