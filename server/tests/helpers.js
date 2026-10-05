import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import { createServer } from '../app.js';

export async function startTestServer() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('test'));
  const { app, httpServer, io } = createServer();
  await new Promise((r) => httpServer.listen(0, r));
  const url = `http://localhost:${httpServer.address().port}`;
  const sockets = [];

  return {
    app,
    url,
    async register(name, email = `${name.toLowerCase()}@test.dev`) {
      const res = await request(app).post('/api/v1/auth/register').send({ name, email, password: 'secret123' });
      return { user: res.body.user, token: res.body.token };
    },
    connect(token) {
      const s = ioc(url, { auth: { token }, transports: ['websocket'], forceNew: true });
      sockets.push(s);
      return new Promise((resolve, reject) => {
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
      });
    },
    async stop() {
      sockets.forEach((s) => s.close());
      io.close();
      await new Promise((r) => setTimeout(r, 200)); // let disconnect handlers finish
      await mongoose.disconnect();
      await mongo.stop();
    },
  };
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
export const emitAck = (socket, event, payload) => new Promise((r) => socket.emit(event, payload, r));
export const once = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
// resolves true if the event does NOT arrive within ms
export const never = (socket, event, ms = 400) =>
  new Promise((resolve) => {
    const h = () => resolve(false);
    socket.once(event, h);
    setTimeout(() => {
      socket.off(event, h);
      resolve(true);
    }, ms);
  });
