import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminSessionFrom } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { hashToken, newSessionToken } from '@/lib/crypto';
import { usernameKey } from '@/lib/username';
import { errors, getClientIp, isSameOrigin, isUniqueViolation, parseBody } from '@/lib/request';

const CreateEventSchema = z.object({
  name: z.string().trim().min(1).max(100),
  allowLess8: z.boolean().optional().default(false),
  theme: z.enum(['default', 'halloween']).optional().default('default'),
  /** Prova etkinliği: bu kadar sahte oyuncu otomatik eklenir (anlatıcılar paneli denesin diye). */
  practicePlayers: z.number().int().min(4).max(48).optional(),
});

// Prova oyuncularının adları: gerçek bir oyuncuyla karışmasın diye hepsi "prova·" ile başlar.
const BOT_NAMES = ['Vampir', 'Köylü', 'Analist', 'Yamacı', 'Tuzak', 'Gölge', 'Bekçi', 'Sniffer', 'Phisher', 'Firewall', 'ZeroDay', 'RootKit'];
function botName(i: number) {
  return `prova·${BOT_NAMES[i % BOT_NAMES.length]}${i >= BOT_NAMES.length ? Math.floor(i / BOT_NAMES.length) + 1 : ''}`;
}

/** CSPRNG ile 100000–999999 arası, eşit dağılımlı 6 haneli PIN. */
function generateEventPin(): string {
  return randomInt(100000, 1000000).toString();
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return errors.forbiddenOrigin();
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();

    const body = await parseBody(req, CreateEventSchema);
    if (!body) return errors.badRequest();

    // Çakışmada (eşsizlik ihlali) yeni PIN ile tekrar dene; kontrol + ekleme arasındaki yarış durumu da böylece kapanır.
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const practice = body.practicePlayers !== undefined;
        const event = await prisma.$transaction(async (tx) => {
          const created = await tx.event.create({
            data: {
              name: body.name,
              eventPin: generateEventPin(),
              // Prova etkinliğinde az sahte oyuncuyla da (en az 4) masa kurulabilsin.
              allowLess8: body.allowLess8 || practice,
              theme: body.theme,
              isPractice: practice,
              status: 'WAITING',
            },
          });
          if (practice) {
            await tx.player.createMany({
              data: Array.from({ length: body.practicePlayers! }, (_, i) => {
                const username = botName(i);
                return {
                  eventId: created.id,
                  username,
                  usernameKey: usernameKey(username),
                  // Hiçbir cihaza verilmeyen rastgele token: sahte oyuncunun oturumu yoktur.
                  sessionTokenHash: hashToken(newSessionToken()),
                  status: 'LOBBY',
                };
              }),
            });
          }
          return created;
        });
        await audit('CREATE_EVENT', 'ADMIN', session.adminId, event.id, getClientIp(req));
        return NextResponse.json({ success: true, event });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    return NextResponse.json({ error: 'PIN üretilemedi, lütfen tekrar deneyin' }, { status: 500 });
  } catch (error) {
    console.error('Create event error:', error);
    return errors.server();
  }
}

/** Yerel admin uygulaması için etkinlik listesi (en yeni 50). */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSessionFrom(req.cookies);
    if (!session) return errors.unauthorized();
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        eventPin: true,
        status: true,
        createdAt: true,
        theme: true,
        isPractice: true,
        _count: { select: { players: true, adminAlerts: { where: { isResolved: false } } } },
      },
    });
    return NextResponse.json({
      events: events.map(({ _count, ...e }) => ({ ...e, playerCount: _count.players, openAlerts: _count.adminAlerts })),
    });
  } catch (error) {
    console.error('List events error:', error);
    return errors.server();
  }
}
