import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError, asyncHandler } from './http.js';

export const COOKIE_NAME = 'token';

export const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, config.jwtSecret);

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  maxAge: 7 * 24 * 3600 * 1000,
};

// Accepts `Authorization: Bearer <jwt>` or the HTTP-only cookie.
export function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[COOKIE_NAME] || null;
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw new HttpError(401, 'Authentication required');
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'User no longer exists');
  req.user = user;
  next();
});
