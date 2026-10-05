import { memo, useState } from 'react';
import { Check, CheckCheck, Copy, File as FileIcon, ListTodo } from 'lucide-react';
import { assetUrl } from '../../lib/api.js';
import { fmtSize, timeLabel } from '../../lib/utils.js';
import TranslateMenu from '../ai/TranslateMenu.jsx';
import TaskCard from '../tasks/TaskCard.jsx';
import Avatar from './Avatar.jsx';

function Attachment({ a: att }) {
  const a = { ...att, url: assetUrl(att.url) };
  if (a.fileType.startsWith('image/')) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer">
        <img src={a.url} alt={a.name} className="max-h-56 max-w-xs rounded-lg object-cover" />
      </a>
    );
  }
  if (a.fileType.startsWith('audio/')) return <audio controls src={a.url} className="max-w-xs" />;
  return (
    <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 hover:bg-slate-50">
      <FileIcon size={22} className="text-indigo-500" />
      <span className="max-w-[12rem] truncate text-sm">{a.name}</span>
      <span className="text-xs text-slate-500">{fmtSize(a.size)}</span>
    </a>
  );
}

function MessageItem({ message, sender, mine, showHeader, seenCount, memberCount, onConvertToTask }) {
  const [translation, setTranslation] = useState(null);
  const initial = message.translations ? Object.entries(message.translations)[0] : null;
  const shown = translation || (initial ? { lang: initial[0], text: initial[1] } : null);
  const isTask = message.messageType === 'task';
  const seen = seenCount >= memberCount - 1;

  return (
    <div className={`group flex gap-3 px-4 ${showHeader ? 'mt-3' : 'mt-0.5'} ${mine ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 shrink-0">{showHeader && <Avatar user={sender} size={8} />}</div>
      <div className={`flex min-w-0 max-w-[75%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {showHeader && (
          <div className="mb-0.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{mine ? 'You' : sender?.name || 'Unknown'}</span> · {timeLabel(message.createdAt)}
          </div>
        )}
        <div className={`relative flex items-start gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
          {isTask ? (
            <TaskCard taskId={message.taskRef} />
          ) : (
            <div className={`rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'}`}>
              {message.attachments?.length > 0 && (
                <div className="mb-1 flex flex-col gap-2">{message.attachments.map((a) => <Attachment key={a.url} a={a} />)}</div>
              )}
              {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
              {shown && (
                <div className={`mt-2 border-t pt-1.5 text-sm ${mine ? 'border-white/30' : 'border-slate-200'}`}>
                  <span className={`mr-1 text-[10px] font-semibold uppercase ${mine ? 'text-indigo-100' : 'text-indigo-600'}`}>🌐 {shown.name || shown.lang}</span>
                  {shown.text}
                </div>
              )}
            </div>
          )}
          {!isTask && (
            <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {message.content && <TranslateMenu message={message} onTranslated={(t) => (t.error ? alert(t.error) : setTranslation(t))} />}
              {message.content && (
                <button onClick={() => onConvertToTask(message)} aria-label="Convert to task" title="Convert to task" className="rounded p-1 text-slate-500 hover:bg-slate-200"><ListTodo size={15} /></button>
              )}
              {message.content && (
                <button onClick={() => navigator.clipboard?.writeText(message.content)} aria-label="Copy" title="Copy" className="rounded p-1 text-slate-500 hover:bg-slate-200"><Copy size={15} /></button>
              )}
            </div>
          )}
        </div>
        {mine && (
          <span className={`mt-0.5 flex items-center gap-0.5 text-[11px] ${seen ? 'text-indigo-600' : 'text-slate-500'}`} title={seen ? 'Seen' : 'Delivered'}>
            {seen ? <CheckCheck size={13} /> : <Check size={13} />}
            {memberCount > 2 && seenCount > 0 && `Seen by ${seenCount}`}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(MessageItem);
