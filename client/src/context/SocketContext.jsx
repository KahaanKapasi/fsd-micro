import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null, connected: false });
export const useSocket = () => useContext(SocketContext);

// One authenticated socket per signed-in user (JWT sent in the handshake).
export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    const s = io(BACKEND_URL || undefined, { auth: { token }, withCredentials: true });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    setSocket(s);
    return () => {
      s.close();
      setSocket(null);
      setConnected(false);
    };
  }, [user?._id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}
