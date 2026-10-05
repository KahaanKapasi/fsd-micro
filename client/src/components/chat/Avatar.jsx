import { colorFor, initials } from '../../lib/utils.js';

const DOT = { online: 'bg-emerald-500', busy: 'bg-red-500', offline: 'bg-slate-400' };

export default function Avatar({ user, size = 8, showStatus = false }) {
  const px = size * 4;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: px, height: px }} title={user?.name}>
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center rounded-full font-semibold text-white ${colorFor(user?._id)}`}
          style={{ fontSize: px * 0.38 }}
        >
          {initials(user?.name)}
        </span>
      )}
      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${size < 8 ? 'h-2 w-2' : 'h-3 w-3'} rounded-full border-2 border-white ${DOT[user?.status] || DOT.offline}`}
          title={user?.status}
        />
      )}
    </span>
  );
}
