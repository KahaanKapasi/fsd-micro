export const initials = (name = '?') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const COLORS = ['bg-rose-500', 'bg-orange-600', 'bg-amber-600', 'bg-emerald-500', 'bg-teal-500', 'bg-sky-500', 'bg-indigo-500', 'bg-fuchsia-500'];
export const colorFor = (id = '') => COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

export const timeLabel = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const dayLabel = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
export const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const isOverdue = (t) => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date();
export const isDueThisWeek = (t) => {
  if (!t.dueDate || t.status === 'completed') return false;
  const d = new Date(t.dueDate);
  const now = new Date();
  return d >= now && d <= new Date(+now + 7 * 864e5);
};
export const dueLabel = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

export const otherMemberId = (c, meId) => c.members.find((m) => m !== meId);
export const convoTitle = (c, users, meId) =>
  c.type === 'direct' ? users[otherMemberId(c, meId)]?.name || 'Direct message' : c.name;
