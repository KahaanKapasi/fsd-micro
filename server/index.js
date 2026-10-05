import { config } from './config.js';
import { createServer } from './app.js';
import { connectDb, disconnectDb } from './db.js';
import { startScheduler } from './modules/tasks/scheduler.js';

await connectDb();
const { httpServer } = createServer();
const stopScheduler = startScheduler();

httpServer.listen(config.port, () => console.log(`[server] http://localhost:${config.port}  (api: /api/v1)`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    stopScheduler();
    httpServer.close();
    await disconnectDb();
    process.exit(0);
  });
}
