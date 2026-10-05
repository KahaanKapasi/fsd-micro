import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useChat } from '../../context/ChatContext.jsx';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';

export default function NewChatModal({ initialTab = 'direct', onClose }) {
  const { users, me, startDirect, createChannel, joinChannel } = useChat();
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('group');
  const [picked, setPicked] = useState([]);
  const [browse, setBrowse] = useState([]);
  const [error, setError] = useState('');
  const others = Object.values(users).filter((u) => u._id !== me._id);

  useEffect(() => {
    if (tab !== 'browse') return undefined;
    let live = true;
    api
      .get('/conversations/discover')
      .then(({ conversations }) => live && setBrowse(conversations))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [tab]);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} className={`flex-1 border-b-2 pb-2 text-sm font-medium ${tab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
      {label}
    </button>
  );

  return (
    <Modal title="Start a conversation" onClose={onClose}>
      <div className="mb-4 flex">{[['direct', 'Direct message'], ['channel', 'New channel'], ['browse', 'Browse']].map(([id, l]) => tabBtn(id, l))}</div>

      {tab === 'direct' && (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {others.length === 0 && <li className="text-sm text-slate-500">No other users yet. Register another account to chat.</li>}
          {others.map((u) => (
            <li key={u._id}>
              <button onClick={() => run(() => startDirect(u._id))} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100">
                <Avatar user={u} showStatus />
                <span className="truncate text-sm">{u.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'channel' && (
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" maxLength={80} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)" maxLength={250} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
            <option value="group">Group: everyone can post</option>
            <option value="announcement">Announcement: only you can post</option>
          </select>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {others.map((u) => (
              <label key={u._id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={picked.includes(u._id)} onChange={() => setPicked((p) => (p.includes(u._id) ? p.filter((x) => x !== u._id) : [...p, u._id]))} />
                {u.name}
              </label>
            ))}
          </div>
          <button disabled={!name.trim()} onClick={() => run(() => createChannel({ type, name: name.trim(), topic: topic.trim(), members: picked }))} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            Create channel
          </button>
        </div>
      )}

      {tab === 'browse' && (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {browse.length === 0 && <li className="text-sm text-slate-500">No other channels to join.</li>}
          {browse.map((c) => (
            <li key={c._id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-100">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium"># {c.name}</div>
                {c.topic && <div className="text-xs text-slate-500">{c.topic}</div>}
              </div>
              <button onClick={() => run(() => joinChannel(c._id))} className="ml-2 shrink-0 rounded-md border border-indigo-600 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50">Join</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
