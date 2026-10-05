import { useCallback, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useChat } from '../../context/ChatContext.jsx';
import { dayLabel, sameDay } from '../../lib/utils.js';
import MessageItem from './MessageItem.jsx';

const Header = ({ context }) => (context.hasMore ? <div className="py-2 text-center text-xs text-slate-500">Loading earlier messages…</div> : <div className="h-2" />);
const Footer = () => <div className="h-3" />;
const COMPONENTS = { Header, Footer };

// Virtualized thread: only visible rows are mounted; sticks to the bottom for new messages
// unless the reader has scrolled up; older history is prepended without scroll jumps.
export default function MessageList({ conversation, onConvertToTask }) {
  const { me, users, messages, loadOlder } = useChat();
  const state = messages[conversation._id];
  const ref = useRef(null);

  const itemContent = useCallback(
    (index, m) => {
      const prev = state.items[index - state.firstIndex - 1];
      const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
      const showHeader = newDay || prev.senderId !== m.senderId || new Date(m.createdAt) - new Date(prev.createdAt) > 5 * 60000 || prev.messageType === 'task';
      const seenCount = m.readBy.filter((id) => id !== m.senderId).length;
      return (
        <>
          {newDay && (
            <div className="my-3 flex items-center gap-3 px-4 text-xs text-slate-500">
              <span className="h-px flex-1 bg-slate-200" />
              {dayLabel(m.createdAt)}
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          )}
          <MessageItem
            message={m}
            sender={users[m.senderId]}
            mine={m.senderId === me._id}
            showHeader={showHeader}
            seenCount={seenCount}
            memberCount={conversation.members.length}
            onConvertToTask={onConvertToTask}
          />
        </>
      );
    },
    [state?.items, state?.firstIndex, users, me._id, conversation.members.length, onConvertToTask]
  );

  if (!state) return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading…</div>;
  if (!state.items.length) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">No messages yet. Say hello 👋</div>;
  }

  return (
    <Virtuoso
      key={conversation._id}
      ref={ref}
      className="scroll-thin flex-1"
      data={state.items}
      firstItemIndex={state.firstIndex}
      initialTopMostItemIndex={state.items.length - 1}
      followOutput={(atBottom) => (atBottom ? 'smooth' : false)}
      startReached={() => loadOlder(conversation._id)}
      computeItemKey={(_, m) => m._id}
      itemContent={itemContent}
      context={{ hasMore: state.hasMore }}
      components={COMPONENTS}
    />
  );
}
