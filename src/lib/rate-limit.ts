// Bellek içi, tek süreçlik başarısız deneme sayacı. Tek uygulama örneği için yeterlidir;
// birden fazla örnek çalıştırılırsa Redis gibi paylaşılan bir depoya taşınmalıdır.

export interface FailureLimiterOptions {
  maxFailures: number; // pencere içinde izin verilen başarısız deneme
  windowMs: number; // sayımın sıfırlandığı süre
  lockMs: number; // limit aşılınca kilit süresi
}

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

export class FailureLimiter {
  private entries = new Map<string, Entry>();

  constructor(private readonly opts: FailureLimiterOptions, private readonly now: () => number = Date.now) {}

  /** Anahtar şu an kilitli mi? Kilitliyse kalan süreyi (ms) döner. */
  lockedFor(key: string): number {
    const e = this.entries.get(key);
    if (!e) return 0;
    const remaining = e.lockedUntil - this.now();
    return remaining > 0 ? remaining : 0;
  }

  recordFailure(key: string): void {
    const t = this.now();
    let e = this.entries.get(key);
    if (!e || t - e.windowStart > this.opts.windowMs) {
      e = { failures: 0, windowStart: t, lockedUntil: 0 };
    }
    e.failures += 1;
    if (e.failures >= this.opts.maxFailures) {
      e.lockedUntil = t + this.opts.lockMs;
      e.failures = 0;
      e.windowStart = t;
    }
    this.entries.set(key, e);
    this.prune(t);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  /** Tüm kilitleri ve sayaçları temizler (admin "kilitleri temizle"). */
  clear(): void {
    this.entries.clear();
  }

  // Bellek şişmesin diye süresi geçmiş kayıtları ara sıra temizle.
  private prune(t: number) {
    if (this.entries.size < 10_000) return;
    for (const [k, e] of this.entries) {
      if (e.lockedUntil < t && t - e.windowStart > this.opts.windowMs) this.entries.delete(k);
    }
  }
}

const MIN = 60 * 1000;

// Sınırlayıcılar süreç genelinde tek olmalı (admin "kilitleri temizle" aynı örneğe dokunsun): globalThis'te tutulur.
const g = globalThis as unknown as { __siberkoyLimiters?: Record<string, FailureLimiter> };
const limiters = (g.__siberkoyLimiters ??= {
  // Admin: aynı IP'den 5 hatada 5 dk kilit.
  adminIp: new FailureLimiter({ maxFailures: 5, windowMs: 5 * MIN, lockMs: 5 * MIN }),
  // Admin hesabı: aynı e-postaya 20 hatada 15 dk. YALNIZCA acil (açık IP) yoldan gelen denemeler sayılır;
  // SSH tünelinden giriş bu kilitten etkilenmez (acil durumda biri hesabı kilitleyemesin).
  adminAccount: new FailureLimiter({ maxFailures: 20, windowMs: 15 * MIN, lockMs: 15 * MIN }),
  // Anlatıcı PIN: ortak Wi-Fi'da tüm anlatıcılar aynı IP'den gelir; 40 hatada 15 dk (31^6 alanda brute-force için önemsiz).
  narratorIp: new FailureLimiter({ maxFailures: 40, windowMs: 15 * MIN, lockMs: 15 * MIN }),
  // Oyuncu cihaz değiştirme kodu (8 karakter): aynı IP'den 40 hatada 15 dk.
  playerCodeIp: new FailureLimiter({ maxFailures: 40, windowMs: 15 * MIN, lockMs: 15 * MIN }),
});

export const adminIpLimiter = limiters.adminIp;
export const adminAccountLimiter = limiters.adminAccount;
export const narratorIpLimiter = limiters.narratorIp;
export const playerCodeIpLimiter = limiters.playerCodeIp;
