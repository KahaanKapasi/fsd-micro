import { useAuth } from './context/AuthContext.jsx';
import AuthPage from './components/chat/AuthPage.jsx';
import ChatWindow from './components/chat/ChatWindow.jsx';
import Sidebar from './components/chat/Sidebar.jsx';
import Toasts from './components/chat/Toasts.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-full items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <AuthPage />;
  return (
    <div className="flex h-full">
      <Sidebar />
      <ChatWindow />
      <Toasts />
    </div>
  );
}
