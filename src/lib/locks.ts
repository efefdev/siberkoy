import type { Prisma } from '@prisma/client';

/**
 * Etkinlik başına PostgreSQL işlem kilidi (transaction bitince kendiliğinden bırakılır).
 * Tur başlatma, anlatıcı PIN devri ve oyuncu çıkarma aynı etkinlikte aynı anda çalışırsa sıraya girer.
 */
export async function lockEvent(tx: Prisma.TransactionClient, eventId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'event:' + eventId}))`;
}

/**
 * Masa satırını paylaşımlı kilitle ve hâlâ ACTIVE mi diye bak. Eleme/diriltme bunu alır; masa sonucu girişi
 * aynı satırı UPDATE ettiği için ikisi sıraya girer: sonuç, eleme/diriltme commit olmadan oyuncuları okumaz;
 * sonuç önce commit olduysa eleme/diriltme masayı COMPLETED görür ve yazmaz.
 */
export async function lockActiveRoom(tx: Prisma.TransactionClient, roomId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Room" WHERE id = ${roomId} AND status = 'ACTIVE' FOR SHARE`;
  return rows.length === 1;
}

/** Tur başına kilit: son iki masa aynı anda bitirince turun "tamamlandı" işaretini kaçırmamak için. */
export async function lockRound(tx: Prisma.TransactionClient, roundId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'round:' + roundId}))`;
}
