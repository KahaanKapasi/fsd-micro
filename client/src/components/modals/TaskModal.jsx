import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useChat } from '../../context/ChatContext.jsx';
import Modal from '../chat/Modal.jsx';

// local calendar date (toISOString would shift the day for timezones behind UTC)
const toInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Create or edit a task. `initial` pre-populates (e.g. from "Convert to Task" with a messageId).
export default function TaskModal({ conversation, task, initial = {}, onClose }) {
  const { users, saveTask } = useChat();
  const [form, setForm] = useState({
    title: task?.title ?? initial.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'todo',
    dueDate: toInput(task?.dueDate),
    assignees: task?.assignees ?? [],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const members = conversation.members.map((id) => users[id]).filter(Boolean);
  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 text-sm outline-none focus:border-indigo-500';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...form, dueDate: form.dueDate ? new Date(`${form.dueDate}T23:59:00`).toISOString() : null };
    try {
      if (task) await saveTask({ _id: task._id, patch: body });
      else await api.post('/tasks', { ...body, conversationId: conversation._id, messageId: initial.messageId });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input autoFocus className={field} placeholder="Title" value={form.title} onChange={set('title')} required maxLength={200} />
        <textarea className={field} rows={3} maxLength={4000} placeholder="Description (optional)" value={form.description} onChange={set('description')} />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-slate-500">Priority
            <select className={field} value={form.priority} onChange={set('priority')}>{['low', 'medium', 'high'].map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="text-xs text-slate-500">Status
            <select className={field} value={form.status} onChange={set('status')}>
              <option value="todo">To do</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">Due date
            <input type="date" className={field} value={form.dueDate} onChange={set('dueDate')} />
          </label>
        </div>
        <fieldset>
          <legend className="mb-1 text-xs text-slate-500">Assignees</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = form.assignees.includes(m._id);
              return (
                <button type="button" key={m._id} onClick={() => setForm((f) => ({ ...f, assignees: on ? f.assignees.filter((x) => x !== m._id) : [...f.assignees, m._id] }))}
                  className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  {m.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        {initial.messageId && <p className="text-xs text-slate-500">Linked to the original message.</p>}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button disabled={busy || !form.title.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{task ? 'Save' : 'Create task'}</button>
        </div>
      </form>
    </Modal>
  );
}
