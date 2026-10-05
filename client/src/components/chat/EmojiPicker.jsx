const EMOJIS = '😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😅 😢 😭 😡 👍 👎 👏 🙏 💪 🔥 ✨ 🎉 ❤️ 💯 ✅ ❌ ⚡ 🚀 👀 🙌 🤝 💡 📌 📎 ⏰ ☕ 🍕'.split(' ');

export default function EmojiPicker({ onPick, onClose }) {
  return (
    <div className="absolute bottom-12 left-0 z-20 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg" onMouseLeave={onClose}>
      <div className="grid grid-cols-8 gap-1">
        {EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => onPick(e)} className="rounded p-1 text-xl hover:bg-slate-100">{e}</button>
        ))}
      </div>
    </div>
  );
}
