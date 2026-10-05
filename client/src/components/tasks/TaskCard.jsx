import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { useChat } from '../../context/ChatContext.jsx';
import { dueLabel, isOverdue } from '../../lib/utils.js';
import Avatar from '../chat/Avatar.jsx';

export const PRIORITY_STYLE = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};
export const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', completed: 'Completed' };

// Interactive in-stream task card. Reads the live task so updates from any client re-render it.
export default function TaskCard({ taskId }) {
  const { tasks, users, saveTask } = useChat();
  const task = tasks[taskId];
  if (!task) {
    return <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">Task no longer exists</div>;
  }
  const done = task.status === 'completed';
  const toggle = () => saveTask({ _id: task._id, patch: { status: done ? 'todo' : 'completed' } }).catch((e) => alert(e.message));

  return (
    <div className={`w-64 max-w-full rounded-xl border bg-white p-3 text-slate-900 shadow-sm ${done ? 'border-emerald-200' : 'border-slate-200'}`}>
      <div className="flex items-start gap-2">
        <button onClick={toggle} aria-label={done ? 'Mark as not done' : 'Mark as done'} className={done ? 'text-emerald-600' : 'text-slate-500 hover:text-indigo-600'}>
          {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`break-words font-medium ${done ? 'text-slate-400 line-through' : ''}`}>{task.title}</div>
          {task.description && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{task.description}</div>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-7 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{STATUS_LABEL[task.status]}</span>
        {task.dueDate && (
          <span className={`flex items-center gap-1 ${isOverdue(task) ? 'font-medium text-red-600' : 'text-slate-500'}`}>
            <CalendarClock size={12} /> {dueLabel(task.dueDate)}
          </span>
        )}
        <span className="ml-auto flex -space-x-1.5">
          {task.assignees.map((id) => <Avatar key={id} user={users[id]} size={6} />)}
        </span>
      </div>
    </div>
  );
}
