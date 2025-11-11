import { io } from 'socket.io-client';

// singleton socket instance shared across the app so components don't create multiple sockets
export const socket = io('http://localhost:4000');
