import { useEffect, useRef, useState } from 'react';
import { File as FileIcon, Paperclip, Send, Smile, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useChat } from '../../context/ChatContext.jsx';
import { fmtSize } from '../../lib/utils.js';
import VoiceButton from '../ai/VoiceButton.jsx';
import EmojiPicker from './EmojiPicker.jsx';

const MAX = 15 * 1024 * 1024;

export default function MessageInput({ conversation }) {
  const { me, sendMessage, startTyping, stopTyping } = useChat();
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // [{file, preview}]
  const [emoji, setEmoji] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const typingTimer = useRef(null);
  const ta = useRef(null);
  const fileInput = useRef(null);

  const previews = useRef([]);
  previews.current = files;
  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      previews.current.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    },
    []
  );

  const locked = conversation.type === 'announcement' && conversation.adminRef !== me._id;

  const onChange = (v) => {
    setText(v);
    startTyping(conversation._id);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => stopTyping(conversation._id), 1500);
  };

  const addFiles = (list) => {
    setError('');
    const next = [];
    for (const file of list) {
      if (file.size > MAX) {
        setError(`${file.name} is larger than 15 MB`);
        continue;
      }
      next.push({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
    }
    setFiles((f) => {
      const all = [...f, ...next];
      all.slice(5).forEach((x) => x.preview && URL.revokeObjectURL(x.preview));
      return all.slice(0, 5);
    });
  };

  const insert = (str) => {
    if (!str) return;
    setText((t) => (t && !t.endsWith(' ') ? `${t} ${str}` : `${t}${str}`));
    ta.current?.focus();
  };

  const send = async () => {
    if (busy || (!text.trim() && !files.length)) return;
    setBusy(true);
    setError('');
    try {
      let attachments = [];
      if (files.length) {
        const form = new FormData();
        files.forEach(({ file }) => form.append('files', file));
        ({ attachments } = await api.post('/upload', form));
      }
      await sendMessage(conversation._id, text.trim(), attachments);
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      setText('');
      setFiles([]);
      clearTimeout(typingTimer.current);
      stopTyping(conversation._id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (locked) {
    return <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm text-slate-600">Only the channel admin can post in this announcement channel.</div>;
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" aria-label="Attachments to send">
          {files.map(({ file, preview }, i) => (
            <div key={i} className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              {preview ? <img src={preview} alt="" className="h-12 w-12 rounded object-cover" /> : <FileIcon size={28} className="text-slate-500" />}
              <div className="min-w-0 max-w-[9rem]">
                <div className="truncate text-xs font-medium">{file.name}</div>
                <div className="text-xs text-slate-500">{fmtSize(file.size)}</div>
              </div>
              <button onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} aria-label={`Remove ${file.name}`} className="absolute -right-2 -top-2 rounded-full bg-slate-700 p-0.5 text-white hover:bg-slate-900"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="relative flex items-end gap-1">
        <button type="button" onClick={() => setEmoji((v) => !v)} aria-label="Emoji picker" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><Smile size={20} /></button>
        {emoji && <EmojiPicker onPick={(e) => insert(e)} onClose={() => setEmoji(false)} />}
        <button type="button" onClick={() => fileInput.current?.click()} aria-label="Attach file" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><Paperclip size={20} /></button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
        <textarea
          ref={ta}
          rows={1}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          onPaste={(e) => e.clipboardData.files.length && addFiles([...e.clipboardData.files])}
          placeholder="Message… (try /task Title @user due:2030-01-31)"
          aria-label="Message"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
        />
        <VoiceButton onTranscript={insert} />
        <button onClick={send} disabled={busy || (!text.trim() && !files.length)} aria-label="Send" className="rounded-full bg-indigo-600 p-2.5 text-white hover:bg-indigo-700 disabled:opacity-40"><Send size={18} /></button>
      </div>
    </div>
  );
}
