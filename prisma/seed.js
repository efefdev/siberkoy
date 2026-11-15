// İlk admin hesabını oluşturur. Şifre koda yazılmaz; ortam değişkenlerinden okunur.
//   ADMIN_EMAIL=admin@omusiber.org ADMIN_INITIAL_PASSWORD='...' node prisma/seed.js
// Hesap zaten varsa hiçbir şey değiştirilmez (şifre üzerine yazılmaz).
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();
const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD || '';

  if (!email || !email.includes('@')) {
    throw new Error('ADMIN_EMAIL ortam değişkeni tanımlı değil veya geçersiz.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_INITIAL_PASSWORD en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin hesabı zaten var: ${email} (değiştirilmedi)`);
    return;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  await prisma.admin.create({ data: { email, passwordHash } });
  console.log(`Admin hesabı oluşturuldu: ${email}`);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
