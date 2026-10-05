import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, emitAck, never, once, startTestServer } from './helpers.js';

let t, alice, bob, carol, sa, sb, sc, convo;

beforeAll(async () => {
  t = await startTestServer();
  [alice, bob, carol] = await Promise.all([t.register('Alice'), t.register('Bob'), t.register('Carol')]);
  const res = await request(t.app)
    .post('/api/v1/conversations')
    .set(auth(alice.token))
    .send({ type: 'group', name: 'general', members: [bob.user._id] });
  convo = res.body.conversation;
  [sa, sb, sc] = await Promise.all([t.connect(alice.token), t.connect(bob.token), t.connect(carol.token)]);
});
afterAll(() => t.stop());

describe('Socket auth', () => {
  it('rejects connections without or with a bad JWT', async () => {
    await expect(t.connect('nope')).rejects.toThrow(/Invalid|Authentication/);
    await expect(t.connect('')).rejects.toThrow(/Authentication/);
  });
});

describe('Messaging', () => {
  it('delivers bidirectionally between members', async () => {
    const got = once(sb, 'receive_message');
    const ack = await emitAck(sa, 'send_message', { conversationId: convo._id, content: 'hello bob' });
    expect(ack.ok).toBe(true);
    expect((await got).content).toBe('hello bob');

    const back = once(sa, 'receive_message');
    await emitAck(sb, 'send_message', { conversationId: convo._id, content: 'hi alice' });
    expect((await back).content).toBe('hi alice');
  });

  it('isolates rooms: non-members get nothing and cannot send or join', async () => {
    const leak = never(sc, 'receive_message');
    await emitAck(sa, 'send_message', { conversationId: convo._id, content: 'secret' });
    expect(await leak).toBe(true);
    expect((await emitAck(sc, 'send_message', { conversationId: convo._id, content: 'intruder' })).ok).toBe(false);
    expect((await emitAck(sc, 'join_room', { conversationId: convo._id })).ok).toBe(false);
    const hist = await request(t.app).get(`/api/v1/conversations/${convo._id}/messages`).set(auth(carol.token));
    expect(hist.status).toBe(403);
  });

  it('relays typing indicators to others only', async () => {
    const seen = once(sb, 'typing_start');
    const echo = never(sa, 'typing_start');
    sa.emit('typing_start', { conversationId: convo._id });
    expect((await seen).userId).toBe(alice.user._id);
    expect(await echo).toBe(true);
  });

  it('tracks read receipts and unread counts', async () => {
    await emitAck(sa, 'send_message', { conversationId: convo._id, content: 'read me' });
    let list = await request(t.app).get('/api/v1/conversations').set(auth(bob.token));
    expect(list.body.conversations[0].unread).toBeGreaterThan(0);

    const receipt = once(sa, 'messages_read');
    const ack = await emitAck(sb, 'mark_read', { conversationId: convo._id });
    expect(ack.modified).toBeGreaterThan(0);
    expect((await receipt).userId).toBe(bob.user._id);

    list = await request(t.app).get('/api/v1/conversations').set(auth(bob.token));
    expect(list.body.conversations[0].unread).toBe(0);
    const msgs = await request(t.app).get(`/api/v1/conversations/${convo._id}/messages`).set(auth(alice.token));
    expect(msgs.body.messages.at(-1).readBy).toContain(bob.user._id);
  });

  it('broadcasts presence and enforces announcement admin-only posting', async () => {
    const ann = (
      await request(t.app).post('/api/v1/conversations').set(auth(alice.token)).send({ type: 'announcement', name: 'news', members: [bob.user._id] })
    ).body.conversation;
    expect((await emitAck(sb, 'send_message', { conversationId: ann._id, content: 'nope' })).ok).toBe(false);
    expect((await emitAck(sa, 'send_message', { conversationId: ann._id, content: 'all hands' })).ok).toBe(true);

    const p = once(sa, 'presence_update');
    sb.emit('presence_update', { status: 'busy' });
    expect(await p).toEqual({ userId: bob.user._id, status: 'busy' });
  });

  it('new conversations push live to members without reconnecting', async () => {
    const created = once(sc, 'conversation_created');
    const res = await request(t.app).post('/api/v1/conversations').set(auth(alice.token)).send({ type: 'direct', userId: carol.user._id });
    expect((await created)._id).toBe(res.body.conversation._id);
    const got = once(sc, 'receive_message');
    await emitAck(sa, 'send_message', { conversationId: res.body.conversation._id, content: 'first dm' });
    expect((await got).content).toBe('first dm');
  });
});

describe('Upload', () => {
  it('accepts allowed files and returns attachment metadata; rejects bad types and oversize', async () => {
    const ok = await request(t.app)
      .post('/api/v1/upload')
      .set(auth(alice.token))
      .attach('files', Buffer.from('%PDF-1.4 test'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    expect(ok.status).toBe(201);
    expect(ok.body.attachments[0]).toMatchObject({ fileType: 'application/pdf', name: 'doc.pdf', size: 13 });
    const file = await request(t.url).get(ok.body.attachments[0].url);
    expect(file.status).toBe(200);

    const bad = await request(t.app)
      .post('/api/v1/upload')
      .set(auth(alice.token))
      .attach('files', Buffer.from('x'), { filename: 'a.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBe(415);
    const big = await request(t.app)
      .post('/api/v1/upload')
      .set(auth(alice.token))
      .attach('files', Buffer.alloc(15 * 1024 * 1024 + 1), { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(big.status).toBe(400);
    expect((await request(t.app).post('/api/v1/upload').attach('files', Buffer.from('x'), 'a.pdf')).status).toBe(401);
  });
});
