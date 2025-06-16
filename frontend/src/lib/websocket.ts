const WEBSOCKET_URL = 'wss://821gxv78hl.execute-api.us-east-2.amazonaws.com/production';

let socket: WebSocket | null = null;
let gamePageListeners: ((data: unknown) => void)[] = [];

export const connectSocket = (onMessage: (data: unknown) => void, onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting...') => void) => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found');
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('Already connected');
    addGamePageListener(onMessage);
    onStatusChange?.('connected');
    return;
  }

  onStatusChange?.('connecting...');
  socket = new WebSocket(`${WEBSOCKET_URL}?token=${token}`);

  socket.onopen = () => {
    console.log('WebSocket connected');
    onStatusChange?.('connected');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    gamePageListeners.forEach((fn) => fn(data));
  };

  socket.onerror = (e) => {
    console.error('WebSocket error', e);
    onStatusChange?.('disconnected');
  };

  socket.onclose = () => {
    console.warn('WebSocket closed');
    socket = null;
    gamePageListeners = [];
    onStatusChange?.('disconnected');
  };

  addGamePageListener(onMessage);
};

export const addGamePageListener = (listener: (data: unknown) => void) => {
  if (!gamePageListeners.includes(listener)) gamePageListeners.push(listener);
};

export const sendMessage = (msg: object) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket not open');
    return;
  }
  socket.send(JSON.stringify(msg));
};

export const closeSocket = () => {
  if (socket) {
    socket.send(JSON.stringify({ action: '$disconnect' }));
    socket.close();
  }

  socket = null;
  gamePageListeners = [];
};

export const reconnectSocket = (onMessage: (data: unknown) => void, onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting...') => void) => {
  if (socket) {
    socket.close();
  }
  connectSocket(onMessage, onStatusChange);
};