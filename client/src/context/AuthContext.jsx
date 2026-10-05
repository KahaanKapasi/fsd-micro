import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => {
        setToken(null);
        setTokenState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const finish = ({ user, token }) => {
    setToken(token);
    setTokenState(token);
    setUser(user);
  };

  const login = useCallback(async (email, password) => finish(await api.post('/auth/login', { email, password })), []);
  const register = useCallback(async (form) => finish(await api.post('/auth/register', form)), []);
  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, token, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
