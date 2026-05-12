import { io } from 'socket.io-client';
import { getBackendOrigin } from './api';

const socket = io(getBackendOrigin(), {
  autoConnect: true,
  reconnection: true,
});

export default socket;
