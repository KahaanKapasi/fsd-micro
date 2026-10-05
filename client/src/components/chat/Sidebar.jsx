import { useState } from 'react';
import { Hash, Megaphone, Plus, Wifi, WifiOff } from 'lucide-react';
import { useChat } from '../../context/ChatContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { convoTitle, otherMemberId } from '../../lib/utils.js';
import Avatar from './Avatar.jsx';
import NewChatModal from './NewChatModal.jsx';
import ProfileModal from './ProfileModal.jsx';

const STATUS_TEXT = { online: 'Online', busy: 'Busy', offline: 'Offline' };

export default function Sidebar() {
  const { me, users, conversations, activeId, selectConversation } = useChat();
  const { connected } = useSocket();
  const [profile, setProfile] = useState(false);
  const [newChat, setNewChat] = useState(null);

  const channels = conversations.filter((c) => c.type !== 'direct');
  const dms = conversations.filter((c) => c.type === 'direct');

  const Badge = ({ n }) => (n > 0 ? <span className="ml-auto shrink-0 rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">{n}</span> : null);
  const row = (c, icon, label) => (
    <li key={c._id}>
      <button
        onClick={() => selectConversation(c._id)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${activeId === c._id ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-white/10'} ${c.unread ? 'font-semibold' : ''}`}
      >
        {icon}
        <span className="truncate">{label}</span>
        {activeId !== c._id && <Badge n={c.unread} />}
      </button>
    </li>
  );

  const heading = (text, tab) => (
    <div className="mb-1 mt-4 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {text}
      <button onClick={() => setNewChat(tab)} aria-label={`New ${text}`} className="rounded p-0.5 hover:bg-white/10 hover:text-white"><Plus size={14} /></button>
    </div>
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-slate-900 text-white">
      <button onClick={() => setProfile(true)} className="flex items-center gap-3 border-b border-white/10 p-4 text-left hover:bg-white/5">
        <Avatar user={me} size={10} showStatus />
        <div className="min-w-0">
          <div className="truncate font-semibold">{me.name}</div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            {connected ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-amber-400" />}
            {connected ? STATUS_TEXT[me.status] || 'Online' : 'Reconnecting…'}
          </div>
        </div>
      </button>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2 pb-4">
        {heading('Channels', 'channel')}
        <ul className="space-y-0.5">
          {channels.map((c) => row(c, c.type === 'announcement' ? <Megaphone size={15} /> : <Hash size={15} />, c.name))}
          {channels.length === 0 && <li className="px-3 py-1 text-xs text-slate-400">No channels yet</li>}
        </ul>
        {heading('Direct messages', 'direct')}
        <ul className="space-y-0.5">
          {dms.map((c) => row(c, <Avatar user={users[otherMemberId(c, me._id)]} size={5} showStatus />, convoTitle(c, users, me._id)))}
          {dms.length === 0 && <li className="px-3 py-1 text-xs text-slate-400">No conversations yet</li>}
        </ul>
      </nav>
      {profile && <ProfileModal onClose={() => setProfile(false)} />}
      {newChat && <NewChatModal initialTab={newChat} onClose={() => setNewChat(null)} />}
    </aside>
  );
}
