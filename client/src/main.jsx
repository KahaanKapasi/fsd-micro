import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <SocketProvider>
      <ChatProvider>
        <App />
      </ChatProvider>
    </SocketProvider>
  </AuthProvider>
);
