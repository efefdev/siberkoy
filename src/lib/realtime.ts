// Socket.io yayınları. Oda adları server/socket.js ile aynı olmalıdır.
// Gizli bilgi (roller, kimin elendiği) asla oyuncuların veya herkese açık skor tablosunun odasına gönderilmez.

export const rooms = {
  admins: 'admins',
  narrator: (narratorPinId: string) => `narrator:${narratorPinId}`,
  player: (playerId: string) => `player:${playerId}`,
  players: (eventId: string) => `players:${eventId}`, // bir etkinliğin tüm oyuncuları (gizli bilgi yok)
  scoreboard: (eventId: string) => `scoreboard:${eventId}`,
};

export function emitTo(room: string, event: string, payload: unknown): void {
  globalThis.io?.to(room).emit(event, payload);
}

/** Bir odadaki tüm socket bağlantılarını kapatır (kick/ban, PIN iptali). */
export function disconnectRoom(room: string): void {
  globalThis.io?.in(room).disconnectSockets(true);
}

export function emitScoreboardUpdated(eventId: string): void {
  // Yalnızca "yenile" sinyali; içerik /api/scoreboard'dan çekilir.
  emitTo(rooms.scoreboard(eventId), 'scoreboard_updated', {});
  emitTo(rooms.scoreboard(eventId), 'screen_updated', {});
}

/** Büyük ekran (katılım / tur durumu / podyum) için "yenile" sinyali. Gizli bilgi taşımaz. */
export function emitScreenUpdated(eventId: string): void {
  emitTo(rooms.scoreboard(eventId), 'screen_updated', {});
}
