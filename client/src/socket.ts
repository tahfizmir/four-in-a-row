import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'http://localhost:4000';

// singleton socket instance shared across the app so components don't create multiple sockets
export const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
