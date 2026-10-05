import { Router } from 'express';
import { Task } from '../../models/Task.js';
import { requireAuth } from '../../core/auth.js';
import { HttpError, asyncHandler, isId, requireMember } from '../../core/http.js';
import { assertCanPost } from '../../core/messageService.js';
import { createTask, deleteTask, updateTask } from './service.js';

const router = Router();
router.use(requireAuth);

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in_progress', 'completed'];

function validate(body, { partial }) {
  const out = {};
  if (body.title !== undefined || !partial) {
    if (!String(body.title || '').trim()) throw new HttpError(400, 'title is required');
    out.title = String(body.title).trim();
  }
  if (body.description !== undefined) out.description = String(body.description);
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) throw new HttpError(400, 'Invalid priority');
    out.priority = body.priority;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid status');
    out.status = body.status;
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') out.dueDate = null;
    else {
      const d = new Date(body.dueDate);
      if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid dueDate');
      out.dueDate = d;
    }
  }
  if (body.assignees !== undefined) {
    if (!Array.isArray(body.assignees) || !body.assignees.every(isId)) throw new HttpError(400, 'Invalid assignees');
    out.assignees = body.assignees;
  }
  return out;
}

router.get(
  '/:conversationId',
  asyncHandler(async (req, res) => {
    await requireMember(req.params.conversationId, req.user._id);
    const tasks = await Task.find({ conversationId: req.params.conversationId }).sort({ createdAt: -1 });
    res.json({ tasks });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const convo = await requireMember(req.body?.conversationId, req.user._id);
    assertCanPost(convo, req.user._id);
    const fields = validate(req.body, { partial: false });
    const messageRef = req.body.messageId || req.body.messageRef;
    if (messageRef && !isId(messageRef)) throw new HttpError(400, 'Invalid messageId');
    const { task, message } = await createTask({ conversation: convo, creatorId: req.user._id, messageRef, ...fields });
    res.status(201).json({ task, message });
  })
);

async function loadTask(req) {
  if (!isId(req.params.id)) throw new HttpError(400, 'Invalid task id');
  const task = await Task.findById(req.params.id);
  if (!task) throw new HttpError(404, 'Task not found');
  const convo = await requireMember(task.conversationId, req.user._id);
  return { task, convo };
}

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { task, convo } = await loadTask(req);
    const patch = validate(req.body || {}, { partial: true });
    if (patch.assignees) {
      const members = convo.members.map(String);
      patch.assignees = patch.assignees.filter((a) => members.includes(String(a)));
    }
    res.json({ task: await updateTask(task, patch) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { task, convo } = await loadTask(req);
    const uid = String(req.user._id);
    if (String(task.creatorId) !== uid && String(convo.adminRef) !== uid) {
      throw new HttpError(403, 'Only the task creator or channel admin can delete a task');
    }
    await deleteTask(task);
    res.json({ ok: true });
  })
);

export default router;
