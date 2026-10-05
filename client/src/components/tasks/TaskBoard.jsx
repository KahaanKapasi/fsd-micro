import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, KanbanSquare, List, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useChat } from '../../context/ChatContext.jsx';
import { dueLabel, isDueThisWeek, isOverdue } from '../../lib/utils.js';
import Avatar from '../chat/Avatar.jsx';
import TaskModal from '../modals/TaskModal.jsx';
import { PRIORITY_STYLE, STATUS_LABEL } from './TaskCard.jsx';

const COLUMNS = ['todo', 'in_progress', 'completed'];

function TaskRow({ task, onEdit, draggable }) {
  const { users, saveTask, me } = useChat();
  const remove = () => confirm(`Delete "${task.title}"?`) && api.del(`/tasks/${task._id}`).catch((e) => alert(e.message));
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/task', task._id)}
      className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm shadow-sm"
    >
      <div className="flex items-start gap-2">
        <span className={`min-w-0 flex-1 break-words font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : ''}`}>{task.title}</span>
        <button onClick={() => onEdit(task)} aria-label="Edit task" className="text-slate-400 hover:text-indigo-600"><Pencil size={14} /></button>
        {task.creatorId === me._id && <button onClick={remove} aria-label="Delete task" className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={`rounded-full px-2 py-0.5 capitalize ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span>
        {task.dueDate && (
          <span className={`flex items-center gap-1 ${isOverdue(task) ? 'font-medium text-red-600' : 'text-slate-500'}`}><CalendarClock size={12} />{dueLabel(task.dueDate)}</span>
        )}
        <span className="ml-auto flex -space-x-1.5">{task.assignees.map((id) => <Avatar key={id} user={users[id]} size={5} />)}</span>
      </div>
      <select
        value={task.status}
        onChange={(e) => saveTask({ _id: task._id, patch: { status: e.target.value } }).catch((err) => alert(err.message))}
        aria-label="Change status"
        className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-800"
      >
        {COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
    </div>
  );
}

export default function TaskBoard({ conversation, onClose }) {
  const { tasks, users, saveTask } = useChat();
  const [view, setView] = useState('list');
  const [assignee, setAssignee] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [week, setWeek] = useState(false);
  const [modal, setModal] = useState(null); // {task?}

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !modal && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, modal]);

  const visible = useMemo(
    () =>
      Object.values(tasks)
        .filter((t) => t.conversationId === conversation._id)
        .filter((t) => !assignee || t.assignees.includes(assignee))
        .filter((t) => !overdue || isOverdue(t))
        .filter((t) => !week || isDueThisWeek(t))
        .sort((a, b) => (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity)),
    [tasks, conversation._id, assignee, overdue, week]
  );

  const chip = (on, set, label) => (
    <button onClick={() => set(!on)} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600'}`}>{label}</button>
  );

  const onDrop = (status) => (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/task');
    if (id && tasks[id]?.status !== status) saveTask({ _id: id, patch: { status } }).catch((err) => alert(err.message));
  };

  return (
    <aside className="flex min-h-0 w-[26rem] max-w-[45vw] shrink-0 flex-col border-l border-slate-200 bg-slate-50" aria-label="Task board">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white p-3">
        <h2 className="flex-1 font-semibold">Tasks <span className="text-sm font-normal text-slate-400">({visible.length})</span></h2>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          <button onClick={() => setView('list')} aria-label="List view" className={`rounded p-1 ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><List size={16} /></button>
          <button onClick={() => setView('kanban')} aria-label="Kanban view" className={`rounded p-1 ${view === 'kanban' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><KanbanSquare size={16} /></button>
        </div>
        <button onClick={() => setModal({})} aria-label="New task" className="rounded-lg bg-indigo-600 p-1.5 text-white hover:bg-indigo-700"><Plus size={16} /></button>
        <button onClick={onClose} aria-label="Close task board" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter by assignee" className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-800">
          <option value="">All assignees</option>
          {conversation.members.map((id) => <option key={id} value={id}>{users[id]?.name || 'Unknown'}</option>)}
        </select>
        {chip(overdue, setOverdue, 'Overdue')}
        {chip(week, setWeek, 'Due this week')}
      </div>

      <div className="scroll-thin flex-1 overflow-auto p-3">
        {visible.length === 0 && <p className="mt-8 text-center text-sm text-slate-500">No tasks match. Create one with the + button or type /task in chat.</p>}
        {view === 'list' ? (
          <div className="space-y-2">{visible.map((t) => <TaskRow key={t._id} task={t} onEdit={(task) => setModal({ task })} />)}</div>
        ) : (
          <div className="flex gap-3">
            {COLUMNS.map((col) => (
              <div key={col} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(col)} className="min-h-[12rem] w-56 shrink-0 rounded-xl bg-slate-100 p-2">
                <div className="mb-2 px-1 text-xs font-semibold uppercase text-slate-500">{STATUS_LABEL[col]} · {visible.filter((t) => t.status === col).length}</div>
                <div className="space-y-2">
                  {visible.filter((t) => t.status === col).map((t) => <TaskRow key={t._id} task={t} draggable onEdit={(task) => setModal({ task })} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {modal && <TaskModal conversation={conversation} task={modal.task} onClose={() => setModal(null)} />}
    </aside>
  );
}
