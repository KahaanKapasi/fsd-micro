import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Message } from '../models/Message.js';
import { Task } from '../models/Task.js';
import { config } from '../config.js';
import { runReminderSweep } from '../modules/tasks/scheduler.js';
import { parseTaskCommand } from '../modules/tasks/slash.js';
import { auth, emitAck, once, startTestServer } from './helpers.js';

let t, alice, bob, carol, sa, sb, convo;

const post = (path, token, body) => request(t.app).post(`/api/v1${path}`).set(auth(token)).send(body);

beforeAll(async () => {
  t = await startTestServer();
  [alice, bob, carol] = await Promise.all([t.register('Alice'), t.register('Bob'), t.register('Carol')]);
  convo = (await post('/conversations', alice.token, { type: 'group', name: 'proj', members: [bob.user._id] })).body.conversation;
  [sa, sb] = await Promise.all([t.connect(alice.token), t.connect(bob.token)]);
});
afterAll(() => t.stop());

describe('Slash command parser', () => {
  it('extracts title, mentions and due date', () => {
    const c = parseTaskCommand('/task Write the report @bob due:2030-01-15');
    expect(c.title).toBe('Write the report');
    expect(c.mentions).toEqual(['bob']);
    expect(c.dueDate.getFullYear()).toBe(2030);
    expect(parseTaskCommand('hello')).toBeNull();
    expect(parseTaskCommand('/task').title).toBe('');
  });
});

describe('Tasks', () => {
  it('creates via modal API, posts a task card, and syncs to other clients', async () => {
    const created = once(sb, 'task_created');
    const card = once(sb, 'receive_message');
    const res = await post('/tasks', alice.token, {
      conversationId: convo._id,
      title: 'Ship it',
      assignees: [bob.user._id, carol.user._id], // carol is not a member: filtered out
      priority: 'high',
      dueDate: '2030-01-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.task.assignees).toEqual([bob.user._id]);
    expect((await created).title).toBe('Ship it');
    const msg = await card;
    expect(msg.messageType).toBe('task');
    expect(msg.taskRef).toBe(res.body.task._id);
  });

  it('converts a message to a task, keeping a messageId link', async () => {
    const sent = await emitAck(sa, 'send_message', { conversationId: convo._id, content: 'Please update the docs' });
    const res = await post('/tasks', bob.token, { conversationId: convo._id, title: sent.message.content, messageId: sent.message._id });
    expect(res.body.task.messageRef).toBe(sent.message._id);
    const bad = await post('/tasks', bob.token, { conversationId: convo._id, title: 'x', messageId: '507f1f77bcf86cd799439011' });
    expect(bad.status).toBe(400);
  });

  it('creates via /task slash command with mention and due date', async () => {
    const ack = await emitAck(sa, 'send_message', { conversationId: convo._id, content: '/task Review PR @bob due:2030-02-02' });
    expect(ack.ok).toBe(true);
    expect(ack.task.title).toBe('Review PR');
    expect(ack.task.assignees).toEqual([bob.user._id]);
    expect(ack.message.messageType).toBe('task');
    expect((await emitAck(sa, 'send_message', { conversationId: convo._id, content: '/task' })).ok).toBe(false);
  });

  it('status changes propagate in real time and list/filter works', async () => {
    const { task } = (await post('/tasks', alice.token, { conversationId: convo._id, title: 'Sync me' })).body;
    const updated = once(sa, 'task_updated');
    const res = await request(t.app).patch(`/api/v1/tasks/${task._id}`).set(auth(bob.token)).send({ status: 'completed' });
    expect(res.body.task.status).toBe('completed');
    expect((await updated).status).toBe('completed');

    const list = await request(t.app).get(`/api/v1/tasks/${convo._id}`).set(auth(alice.token));
    expect(list.body.tasks.length).toBeGreaterThanOrEqual(4);
    expect((await request(t.app).get(`/api/v1/tasks/${convo._id}`).set(auth(carol.token))).status).toBe(403);
    expect((await request(t.app).patch(`/api/v1/tasks/${task._id}`).set(auth(alice.token)).send({ status: 'nope' })).status).toBe(400);
  });

  it('only creator/admin may delete, and delete broadcasts', async () => {
    const { task } = (await post('/tasks', bob.token, { conversationId: convo._id, title: 'Temp' })).body;
    const gone = once(sa, 'task_deleted');
    expect((await request(t.app).delete(`/api/v1/tasks/${task._id}`).set(auth(alice.token))).status).toBe(200); // alice = channel admin
    expect((await gone)._id).toBe(task._id);
    const mine = (await post('/tasks', alice.token, { conversationId: convo._id, title: 'Alice only' })).body.task;
    expect((await request(t.app).delete(`/api/v1/tasks/${mine._id}`).set(auth(bob.token))).status).toBe(403);
  });
});

describe('Deadline scheduler', () => {
  it('fires 24h and 1h reminders exactly once, skips completed tasks', async () => {
    await Task.deleteMany({});
    const now = new Date();
    const mk = (title, hoursAhead, extra = {}) =>
      Task.create({ title, conversationId: convo._id, creatorId: alice.user._id, assignees: [bob.user._id], dueDate: new Date(+now + hoursAhead * 3600e3), ...extra });
    const day = await mk('due tomorrow', 12);
    const soon = await mk('due soon', 0.5);
    await mk('far away', 72);
    await mk('done already', 0.5, { status: 'completed' });

    const received = [];
    sb.on('task_deadline_reminder', (p) => received.push(p));
    const sent = await runReminderSweep(now);
    await new Promise((r) => setTimeout(r, 300));

    expect(sent).toEqual(
      expect.arrayContaining([
        { id: String(soon._id), window: '1h' },
        { id: String(day._id), window: '24h' },
      ])
    );
    expect(sent).toHaveLength(2);
    expect(received.map((r) => r.window).sort()).toEqual(['1h', '24h']);
    expect(await runReminderSweep(now)).toEqual([]); // no duplicates
  });
});

describe('AI endpoints', () => {
  it('translates, caches on the message, and validates the language', async () => {
    const sent = await emitAck(sa, 'send_message', { conversationId: convo._id, content: 'Good morning team' });
    const id = sent.message._id;
    const first = await post('/ai/translate', bob.token, { messageId: id, targetLang: 'es' });
    expect(first.body).toMatchObject({ cached: false, targetLang: 'es' });
    expect(first.body.translation).toContain('Good morning team');
    expect((await Message.findById(id)).translations.get('es')).toBe(first.body.translation);
    expect((await post('/ai/translate', bob.token, { messageId: id, targetLang: 'es' })).body.cached).toBe(true);
    // second language is stored alongside, not overwriting
    await post('/ai/translate', bob.token, { messageId: id, targetLang: 'fr' });
    expect([...(await Message.findById(id)).translations.keys()].sort()).toEqual(['es', 'fr']);
    expect((await post('/ai/translate', bob.token, { messageId: id, targetLang: 'xx' })).status).toBe(400);
    expect((await post('/ai/translate', carol.token, { messageId: id, targetLang: 'de' })).status).toBe(403);
  });

  it('summarizes into key points, decisions and open questions', async () => {
    for (const content of [
      'We need to pick a database for the launch',
      'Should we use Postgres or Mongo?',
      "Decided: we'll go with Mongo for the MVP",
      'Who owns the migration plan?',
    ]) {
      await emitAck(sa, 'send_message', { conversationId: convo._id, content });
    }
    const res = await post('/ai/summarize', bob.token, { conversationId: convo._id, limit: 50 });
    expect(res.status).toBe(200);
    const { summary } = res.body;
    expect(summary.decisions.join(' ')).toMatch(/Mongo for the MVP/);
    expect(summary.openQuestions.length).toBe(2);
    expect(summary.keyPoints.length).toBeGreaterThan(0);
    expect((await post('/ai/summarize', carol.token, { conversationId: convo._id })).status).toBe(403);
  });

  it('accepts webm/wav audio for transcription and rejects other types', async () => {
    const ok = await request(t.app).post('/api/v1/ai/transcribe').set(auth(alice.token)).attach('audio', Buffer.alloc(64), { filename: 'a.webm', contentType: 'audio/webm' });
    expect(ok.status).toBe(200);
    expect(ok.body.text).toMatch(/64 bytes/);
    const bad = await request(t.app).post('/api/v1/ai/transcribe').set(auth(alice.token)).attach('audio', Buffer.alloc(8), { filename: 'a.mp3', contentType: 'audio/mpeg' });
    expect(bad.status).toBe(415);
  });

  it('a slow AI call does not block socket messaging', async () => {
    config.mockAiLatencyMs = 1500;
    try {
      const slow = post('/ai/summarize', alice.token, { conversationId: convo._id });
      const started = Date.now();
      const got = once(sb, 'receive_message');
      await emitAck(sa, 'send_message', { conversationId: convo._id, content: 'still snappy' });
      await got;
      expect(Date.now() - started).toBeLessThan(700);
      expect((await slow).status).toBe(200); // AI call still completes afterwards
    } finally {
      config.mockAiLatencyMs = 0;
    }
  });
});
