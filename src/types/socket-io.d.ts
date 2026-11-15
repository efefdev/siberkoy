// server.js tarafından `global.io = io` olarak atanan Socket.io sunucu örneği.
// API route'larından erişilir (örn: skor/eleme/bildirim sonrası broadcast).
declare global {
  // eslint-disable-next-line no-var
  var io: import('socket.io').Server | undefined;
}

export {};
