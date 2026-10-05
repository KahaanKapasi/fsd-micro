import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../context/ChatContext.jsx';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';

export default function ProfileModal({ onClose }) {
  const { user, setUser, logout } = useAuth();
  const { setStatus } = useChat();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { user: u } = await api.patch('/users/me', { name: name.trim() });
      setUser(u);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Profile" onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <Avatar user={user} size={14} showStatus />
        <div className="min-w-0">
          <div className="truncate font-semibold">{user.name}</div>
          <div className="text-sm text-slate-500">{user.email}</div>
        </div>
      </div>
      <label className="mb-1 block text-sm font-medium">Display name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
      <label className="mb-1 block text-sm font-medium">Status</label>
      <div className="mb-6 flex gap-2">
        {['online', 'busy'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s).catch((e) => setError(e.message))}
            className={`rounded-full border px-3 py-1 text-sm capitalize ${user.status === s ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            {s}
          </button>
        ))}
      </div>
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-between">
        <button onClick={logout} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">Sign out</button>
        <button onClick={save} disabled={saving || !name.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">Save</button>
      </div>
    </Modal>
  );
}
