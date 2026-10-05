import cron from 'node-cron';
import { Task } from '../../models/Task.js';
import { emitToUser } from '../../core/realtime.js';

const HOUR = 3600 * 1000;

function notify(task, window) {
  const recipients = task.assignees.length ? task.assignees : [task.creatorId];
  const payload = {
    taskId: String(task._id),
    conversationId: String(task.conversationId),
    title: task.title,
    dueDate: task.dueDate,
    window, // '24h' | '1h'
  };
  // user rooms are what the client turns into in-app toasts / browser push notifications
  recipients.forEach((id) => emitToUser(id, 'task_deadline_reminder', payload));
}

// Finds tasks due within 1h and 24h that have not been reminded yet. Exported for tests.
export async function runReminderSweep(now = new Date()) {
  const base = { status: { $ne: 'completed' }, dueDate: { $gt: now } };
  const sent = [];

  const soon = await Task.find({ ...base, dueDate: { $gt: now, $lte: new Date(+now + HOUR) }, reminded1h: false });
  for (const found of soon) {
    // atomic claim so overlapping sweeps / multiple instances never double-notify
    const task = await Task.findOneAndUpdate(
      { _id: found._id, reminded1h: false },
      { reminded1h: true, reminded24h: true } // don't send the 24h notice after the 1h one
    );
    if (!task) continue;
    notify(task, '1h');
    sent.push({ id: String(task._id), window: '1h' });
  }

  const day = await Task.find({ ...base, dueDate: { $gt: now, $lte: new Date(+now + 24 * HOUR) }, reminded24h: false });
  for (const found of day) {
    const task = await Task.findOneAndUpdate({ _id: found._id, reminded24h: false }, { reminded24h: true });
    if (!task) continue;
    notify(task, '24h');
    sent.push({ id: String(task._id), window: '24h' });
  }
  return sent;
}

export function startScheduler() {
  const job = cron.schedule('*/10 * * * *', () => {
    runReminderSweep().catch((e) => console.error('[scheduler] sweep failed', e));
  });
  return () => job.stop();
}
