import { useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      mode === 'login' ? await login(form.email, form.password) : await register(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-600 to-violet-700 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2 text-indigo-600">
          <MessagesSquare size={28} />
          <span className="text-2xl font-bold">ChatSpace</span>
        </div>
        <p className="text-sm text-slate-500">{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</p>
        {mode === 'register' && <input className={input} placeholder="Full name" value={form.name} onChange={set('name')} required />}
        <input className={input} type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
        <input className={input} type="password" placeholder="Password (min 6)" minLength={6} value={form.password} onChange={set('password')} required />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? '…' : mode === 'login' ? 'Sign in' : 'Sign up'}
        </button>
        <button type="button" onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }} className="w-full text-center text-sm text-indigo-600 hover:underline">
          {mode === 'login' ? "No account? Sign up" : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
