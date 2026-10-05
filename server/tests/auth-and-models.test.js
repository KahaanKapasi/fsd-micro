import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { User } from '../models/User.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { auth, startTestServer } from './helpers.js';

let t;
beforeAll(async () => {
  t = await startTestServer();
});
afterAll(() => t.stop());

const oid = () => new mongoose.Types.ObjectId();

describe('Auth', () => {
  it('registers, hashes the password, never leaks the hash, sets an HTTP-only cookie', async () => {
    const res = await request(t.app).post('/api/v1/auth/register').send({ name: 'Ann', email: 'Ann@Test.dev', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ann@test.dev');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(typeof res.body.user._id).toBe('string');
    expect(res.headers['set-cookie'][0]).toMatch(/token=.*HttpOnly/i);
    const stored = await User.findOne({ email: 'ann@test.dev' }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe('secret123');
    expect(await stored.verifyPassword('secret123')).toBe(true);
  });

  it('rejects duplicate email, short password, bad login', async () => {
    const dup = await request(t.app).post('/api/v1/auth/register').send({ name: 'Ann2', email: 'ann@test.dev', password: 'secret123' });
    expect(dup.status).toBe(409);
    const short = await request(t.app).post('/api/v1/auth/register').send({ name: 'X', email: 'x@test.dev', password: '123' });
    expect(short.status).toBe(400);
    const bad = await request(t.app).post('/api/v1/auth/login').send({ email: 'ann@test.dev', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('authenticates via Bearer header and via cookie', async () => {
    const login = await request(t.app).post('/api/v1/auth/login').send({ email: 'ann@test.dev', password: 'secret123' });
    expect(login.status).toBe(200);
    const bearer = await request(t.app).get('/api/v1/auth/me').set(auth(login.body.token));
    expect(bearer.body.user.name).toBe('Ann');
    const cookie = await request(t.app).get('/api/v1/auth/me').set('Cookie', login.headers['set-cookie']);
    expect(cookie.status).toBe(200);
    expect((await request(t.app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(t.app).get('/api/v1/auth/me').set(auth('garbage'))).status).toBe(401);
  });
});

describe('Models', () => {
  it('Message requires content, attachment or task and validates type', async () => {
    const id = oid();
    await expect(Message.create({ senderId: id, conversationId: id })).rejects.toThrow(/content or an attachment/);
    await expect(Message.create({ senderId: id, conversationId: id, content: 'hi', messageType: 'video' })).rejects.toThrow();
    const ok = await Message.create({
      senderId: id,
      conversationId: id,
      messageType: 'file',
      attachments: [{ url: '/uploads/a.png', fileType: 'image/png', size: 10, name: 'a.png' }],
    });
    expect(ok.toJSON()._id).toEqual(String(ok._id));
  });

  it('Message translations map serializes as a plain object', async () => {
    const id = oid();
    const m = await Message.create({ senderId: id, conversationId: id, content: 'hi', translations: { es: 'hola' } });
    expect(m.toJSON().translations).toEqual({ es: 'hola' });
  });

  it('Conversation enforces direct=2 members and named channels', async () => {
    await expect(Conversation.create({ type: 'direct', members: [oid()] })).rejects.toThrow(/exactly 2/);
    await expect(Conversation.create({ type: 'group', members: [oid()] })).rejects.toThrow(/name/);
  });

  it('direct conversations are de-duplicated per user pair', async () => {
    const a = await t.register('Dee');
    const b = await t.register('Eli');
    const first = await request(t.app).post('/api/v1/conversations').set(auth(a.token)).send({ type: 'direct', userId: b.user._id });
    const second = await request(t.app).post('/api/v1/conversations').set(auth(b.token)).send({ type: 'direct', userId: a.user._id });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.conversation._id).toBe(first.body.conversation._id);
  });
});
