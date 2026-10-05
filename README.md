# ChatSpace

Real-time team chat with AI helpers and in-chat tasks. Node/Express/Socket.io/MongoDB backend, React (Vite + Tailwind) frontend.

## Run

```bash
npm run install:all
npm run server   # http://localhost:4000, boots an embedded MongoDB if MONGO_URI is unset (data in server/.data)
npm run client   # http://localhost:5173 (proxies /api, /uploads, /socket.io to :4000)
npm test         # 26 server tests (auth, models, realtime, uploads, tasks, scheduler, AI)
```

Copy `server/.env.example` to `server/.env` to configure `MONGO_URI`, `JWT_SECRET`, etc.
Register two accounts (two browsers/profiles) to chat.

## Layout and ownership

| Area | Path |
|---|---|
| Models | `server/models` |
| Auth, sockets, uploads, conversations | `server/core` |
| AI provider + routes | `server/services/ai`, `server/routes/ai` |
| Tasks, scheduler, slash command | `server/modules/tasks` |
| Chat UI / contexts | `client/src/components/chat`, `client/src/context` |
| AI UI / voice hook | `client/src/components/ai`, `client/src/hooks/useVoiceToText.js` |
| Task UI | `client/src/components/tasks`, `client/src/components/modals/TaskModal.jsx` |

## Integration contract

- All endpoints under `/api/v1`. `_id` is serialized as a string. Socket rooms are conversation id strings (plus private `user:<id>` rooms).
- Tasks and AI link to messages via `messageId` / `taskRef`; text is never duplicated.
- Socket events: `join_room`, `leave_room`, `send_message` (ack), `receive_message`, `typing_start`, `typing_stop`, `presence_update`, `mark_read` / `messages_read`, `conversation_created|updated`, `task_created|updated|deleted`, `task_deadline_reminder`.
- `Message.messageType` has an extra `task` value for in-stream task cards.

## Provider choices (current defaults)

- **Uploads**: local disk (`server/uploads`, served at `/uploads`), 15 MB limit, image/doc/audio allow-list. `server/core/upload.js` is the single place to swap in S3/Cloudinary; the response shape stays `{url,fileType,size,name}`.
- **AI**: deterministic mock provider (`AI_PROVIDER=mock`). To use a real model, implement `translate`, `transcribe`, `summarize` (see `server/services/ai/mock.js`), register it in `server/services/ai/index.js`. Set `MOCK_AI_LATENCY_MS` to simulate slow calls.
- **Voice**: the browser's Web Speech API is used when available; otherwise recorded audio goes to `POST /ai/transcribe` (mock returns a placeholder transcript).
- **Push notifications**: deadline reminders arrive as socket events and become in-app toasts plus browser `Notification`s. There is no service-worker Web Push, so nothing arrives while the tab is closed.
