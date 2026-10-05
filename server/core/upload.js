import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { requireAuth } from './auth.js';
import { HttpError, asyncHandler } from './http.js';

export const ALLOWED_MIME = [
  /^image\/(png|jpe?g|gif|webp|svg\+xml)$/,
  /^audio\/(webm|wav|x-wav|mpeg|ogg|mp4)$/,
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  /^application\/vnd\.openxmlformats-officedocument\./,
  'application/zip',
];

export const isAllowedMime = (mime) => ALLOWED_MIME.some((m) => (m instanceof RegExp ? m.test(mime) : m === mime));

export const fileFilter = (_req, file, cb) =>
  isAllowedMime(file.mimetype) ? cb(null, true) : cb(new HttpError(415, `Unsupported file type: ${file.mimetype}`));

// Storage driver: local disk. Swap `storage` for multer-s3 / Cloudinary to go remote;
// the route response shape ({url,fileType,size,name}) stays the same.
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    cb(null, config.uploadDir);
  },
  filename(_req, file, cb) {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).slice(0, 10)}`);
  },
});

const upload = multer({ storage, fileFilter, limits: { fileSize: config.maxUploadBytes, files: 5 } });

const router = Router();

router.post(
  '/',
  requireAuth,
  upload.array('files', 5),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) throw new HttpError(400, 'No files uploaded (field name: files)');
    const attachments = req.files.map((f) => ({
      url: `/uploads/${f.filename}`,
      fileType: f.mimetype,
      size: f.size,
      name: f.originalname,
    }));
    res.status(201).json({ attachments });
  })
);

export default router;
