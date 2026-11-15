import { prisma } from './prisma';

type ActorType = 'ADMIN' | 'NARRATOR' | 'PLAYER' | 'SYSTEM';

/** Denetim kaydı. Kayıt yazılamazsa asıl işlemi bozmamak için hata yalnızca sunucu loguna düşer. */
export async function audit(action: string, actorType: ActorType, actorId: string, targetId?: string | null, ipAddress?: string | null) {
  try {
    await prisma.auditLog.create({ data: { action, actorType, actorId, targetId: targetId ?? null, ipAddress: ipAddress ?? null } });
  } catch (err) {
    console.error('AuditLog yazılamadı:', action, err);
  }
}
