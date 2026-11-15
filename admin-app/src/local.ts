// Başlatıcının (server/launcher.mjs) yerel uç noktaları: bağlantı durumu ve ayarlar.

export interface LocalStatus {
  mode: 'tunnel' | 'emergency';
  publicUrl: string;
  target: string; // örn. "efe@sunucu (SSH tüneli)" ya da "https://siberkoy.omusiber.org (acil durum)"
  connected: boolean;
  message: string;
}

export async function fetchLocalStatus(): Promise<LocalStatus | null> {
  try {
    const res = await fetch('/__local/status', { cache: 'no-store' });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

// ─── Yerel anahtar ──────────────────────────────────────────────
// Başlatıcı tarayıcıyı `/?lt=<anahtar>` ile açar. Anahtar adres çubuğundan hemen silinir ve bu sekmede saklanır;
// admin API isteklerine X-Local-Token başlığıyla, socket.io'ya sorgu parametresiyle eklenir. Admin oturum çerezi
// tarayıcıya hiç gelmez (yerel sunucuda tutulur).
const TOKEN_KEY = 'siberkoy_local_token';

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let localToken: string | null = null;

export function initLocalToken(): void {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('lt');
  if (fromUrl) {
    localToken = fromUrl;
    try {
      localStorage.setItem(TOKEN_KEY, fromUrl);
    } catch {
      /* depolama kapalıysa yalnızca bu sayfa ömrü boyunca bellekte kalır */
    }
    params.delete('lt');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
  } else {
    localToken = readStoredToken();
  }

  // Aynı kaynaktaki admin API isteklerine anahtarı ekle.
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const path = url.startsWith('http') ? new URL(url).pathname : url;
    if (localToken && path.startsWith('/api/admin')) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set('X-Local-Token', localToken);
      return original(input, { ...init, headers });
    }
    return original(input, init);
  };
}

/** socket.io bağlantısı için sorgu parametresi. */
export function socketQuery(): Record<string, string> {
  return localToken ? { lt: localToken } : {};
}
