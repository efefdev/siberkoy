// Rol bilgileri (metinler kurallar kitapçığından; yeni kural eklenmez).

export type RoleKey = 'ATTACKER' | 'ANALYST' | 'PATCHER' | 'USER';

export interface RoleInfo {
  key: RoleKey;
  label: string;
  /** Klasik Vampir Köylü oyunundaki karşılığı (oyuncular kuralları tanısın diye parantez içinde gösterilir). */
  classic: string;
  team: 'Hacker’lar' | 'Savunucular';
  short: string; // rol kartındaki tek satır
  description: string;
  terminal: string[]; // rol kartındaki terminal satırları
}

export const ROLES: Record<RoleKey, RoleInfo> = {
  ATTACKER: {
    key: 'ATTACKER',
    label: 'Hacker',
    classic: 'Vampir',
    team: 'Hacker’lar',
    short: 'Veri Vampiri — Gölge Kolektifi',
    description:
      'Her gece diğer Hacker’larla birlikte sessizce bir kişiyi hedef alır. Anlaşamazlarsa “bağlantı koptu”, o gece saldırı gerçekleşmez.',
    terminal: ['gece hedef seç', 'iz bırakma'],
  },
  ANALYST: {
    key: 'ANALYST',
    label: 'SOC Analisti',
    classic: 'Gözcü',
    team: 'Savunucular',
    short: 'Logları okuyan göz',
    description: 'Her gece bir kişi seçer; anlatıcı gizlice Temiz (👍) veya Şüpheli (👎) işareti gösterir.',
    terminal: ['bir hesabın loglarını incele', 'temiz mi, şüpheli mi?'],
  },
  PATCHER: {
    key: 'PATCHER',
    label: 'Yama Uzmanı',
    classic: 'Doktor',
    team: 'Savunucular',
    short: 'Köyün kalkanı',
    description:
      'Her gece bir kişiyi yamalar; o gece saldırı o kişiye işlemez. Kendini de yamalayabilir. Aynı kişiyi art arda iki gece seçemez.',
    terminal: ['bir hesabı yamala', 'aynı hesabı üst üste seçme'],
  },
  USER: {
    key: 'USER',
    label: 'Kullanıcı',
    classic: 'Köylü',
    team: 'Savunucular',
    short: 'Köyün sesi',
    description: 'Özel yeteneği yoktur. Gücü tartışma ve oylamadadır.',
    terminal: ['hacker’ı bul', 'gündüz oyla'],
  },
};

/** Bilinmeyen rol (ör. kaldırılan Honeypot ile oynanmış eski bir tur) Kullanıcı gibi gösterilir. */
export function roleInfo(role: string): RoleInfo {
  return ROLES[(role as RoleKey) in ROLES ? (role as RoleKey) : 'USER'];
}

/** "Hacker (Vampir)" biçiminde, klasik karşılığıyla birlikte rol adı. */
export function roleLabel(role: string): string {
  const r = roleInfo(role);
  return `${r.label} (${r.classic})`;
}
