#!/usr/bin/env node
// Kılavuz PDF'lerini yeniden üretir (içerik değişince).
//   1) Siteyi çalıştır (örn. docker compose -f docker-compose.test.yml up)  → http://localhost:3000
//   2) Admin panelini çalıştır: npm run admin -- --hedef http://127.0.0.1:3000  → http://localhost:4400
//   3) npx -y -p playwright@1 node scripts/kilavuz-pdf.mjs   (ilk seferde: npx playwright install chromium)
// Çıktılar: public/kilavuz/oyuncu.pdf, public/kilavuz/anlatici.pdf, admin-app/public/kilavuz-admin.pdf
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
};
const site = arg('--site', 'http://localhost:3000');
const admin = arg('--admin', 'http://localhost:4400');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright bulunamadı. Şöyle çalıştırın: npx -y -p playwright@1 node scripts/kilavuz-pdf.mjs');
  process.exit(1);
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const jobs = [
  { url: `${site}/rehber/yazdir/oyuncu`, out: 'public/kilavuz/oyuncu.pdf' },
  { url: `${site}/rehber/yazdir/anlatici`, out: 'public/kilavuz/anlatici.pdf' },
  { url: `${admin}/#/rehber`, out: 'admin-app/public/kilavuz-admin.pdf' },
];
for (const job of jobs) {
  const page = await browser.newPage();
  // 'networkidle' kullanılmaz: canlı bağlantı ve durum yoklaması sayfayı hiç boşta bırakmaz.
  await page.goto(job.url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(root, job.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.pdf({ path: file, printBackground: true, preferCSSPageSize: true });
  console.log('✔', job.out);
  await page.close();
}
await browser.close();
