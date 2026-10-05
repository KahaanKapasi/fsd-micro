import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../core/auth.js';
import { HttpError, asyncHandler, isId, requireMember } from '../../core/http.js';
import { config } from '../../config.js';
import { Message } from '../../models/Message.js';
import { User } from '../../models/User.js';
import { getProvider } from '../../services/ai/index.js';
import { LANGUAGES } from '../../services/ai/languages.js';

const router = Router();
router.use(requireAuth);

// AI calls are plain awaited HTTP requests: they never run inside a socket handler,
// so a slow provider cannot stall message delivery.

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) =>
    /^audio\/(webm|wav|x-wav|wave)(;.*)?$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new HttpError(415, 'Audio must be audio/webm or audio/wav')),
});

router.get('/languages', (_req, res) => res.json({ languages: LANGUAGES }));

router.post(
  '/transcribe',
  audioUpload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Audio file required (field name: audio)');
    const text = await getProvider().transcribe({ buffer: req.file.buffer, mimeType: req.file.mimetype });
    res.json({ text });
  })
);

router.post(
  '/translate',
  asyncHandler(async (req, res) => {
    const { messageId, text, targetLang } = req.body || {};
    if (!LANGUAGES[targetLang]) throw new HttpError(400, `targetLang must be one of: ${Object.keys(LANGUAGES).join(', ')}`);

    let message = null;
    let source = text;
    if (messageId) {
      if (!isId(messageId)) throw new HttpError(400, 'Invalid messageId');
      message = await Message.findById(messageId);
      if (!message) throw new HttpError(404, 'Message not found');
      await requireMember(message.conversationId, req.user._id);
      const cached = message.translations?.get(targetLang);
      if (cached) return res.json({ messageId, targetLang, translation: cached, cached: true });
      source = message.content;
    }
    if (typeof source !== 'string' || !source.trim()) throw new HttpError(400, 'Nothing to translate');

    const translation = await getProvider().translate({ text: source, targetLang });
    if (message) {
      // $set on a single map key so concurrent translations to other languages don't clobber each other
      await Message.updateOne({ _id: message._id }, { $set: { [`translations.${targetLang}`]: translation } });
    }
    res.json({ messageId: messageId || null, targetLang, translation, cached: false });
  })
);

router.post(
  '/summarize',
  asyncHandler(async (req, res) => {
    const { conversationId, limit = 50, since, until } = req.body || {};
    await requireMember(conversationId, req.user._id);
    const n = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const filter = { conversationId, messageType: { $in: ['text', 'file', 'audio'] } };
    if (since || until) {
      filter.createdAt = {};
      if (since) filter.createdAt.$gte = new Date(since);
      if (until) filter.createdAt.$lte = new Date(until);
      if (Object.values(filter.createdAt).some((d) => Number.isNaN(d.getTime()))) throw new HttpError(400, 'Invalid since/until');
    }
    const recent = (await Message.find(filter).sort({ createdAt: -1 }).limit(n)).reverse();
    if (!recent.length) throw new HttpError(422, 'No messages to summarize');

    const users = await User.find({ _id: { $in: [...new Set(recent.map((m) => String(m.senderId)))] } });
    const names = Object.fromEntries(users.map((u) => [String(u._id), u.name]));
    const messages = recent.map((m) => ({
      id: String(m._id),
      author: names[String(m.senderId)] || 'Unknown',
      text: m.content || (m.attachments.length ? `[attachment: ${m.attachments[0].name}]` : ''),
      at: m.createdAt,
    }));

    const summary = await getProvider().summarize({ messages });
    res.json({
      conversationId,
      messageCount: messages.length,
      range: { from: messages[0].at, to: messages.at(-1).at },
      summary,
    });
  })
);

export default router;
