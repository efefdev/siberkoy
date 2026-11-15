// Admin isteğinin hangi yoldan geldiği (Nginx'in yazdığı X-Siberkoy-Via başlığı). Edge ve Node'da çalışır.
export const ADMIN_VIA_TUNNEL = 'tunnel';
export const ADMIN_VIA_EMERGENCY = 'admin-emergency';

/** Üretimde yalnızca tünel ve acil yol; geliştirmede yalnızca `public` reddedilir. */
export function isAdminVia(via: string | null | undefined, production: boolean): boolean {
  if (production) return via === ADMIN_VIA_TUNNEL || via === ADMIN_VIA_EMERGENCY;
  return via !== 'public';
}
