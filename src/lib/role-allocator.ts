// Ek-A'daki Rol Dağılımı Referansı
// Masa başına her zaman 1 Analist ve 1 Yama Uzmanı vardır.
// Geri kalanı Hacker ve Kullanıcı olarak paylaştırılır. Roller her turda aynı kurala göre dağıtılır.

export type Role = "ATTACKER" | "ANALYST" | "PATCHER" | "USER";

export interface RoleDistribution {
  ATTACKER: number;
  ANALYST: number;
  PATCHER: number;
  USER: number;
}

export function getRoleDistribution(playerCount: number): RoleDistribution {
  let attackers = 0;
  
  // Hacker sayısını tablodan çıkarma
  if (playerCount <= 7) attackers = 1; // Yalnızca test modu (8 kişi altı)
  else if (playerCount <= 10) attackers = 2;
  else if (playerCount <= 13) attackers = 3;
  else attackers = 4; // 14, 15, 16
  
  const analyst = 1;
  const patcher = 1;
  const user = playerCount - (attackers + analyst + patcher);
  
  return {
    ATTACKER: attackers,
    ANALYST: analyst,
    PATCHER: patcher,
    USER: user
  };
}

/**
 * Odadaki oyunculara rolleri rastgele dağıtır.
 * @param playerIds Odadaki oyuncuların ID listesi
 */
export function assignRoles(playerIds: string[]): { playerId: string, role: Role }[] {
  const dist = getRoleDistribution(playerIds.length);
  
  // Rol havuzunu oluştur
  const rolePool: Role[] = [];
  for (let i = 0; i < dist.ATTACKER; i++) rolePool.push("ATTACKER");
  for (let i = 0; i < dist.ANALYST; i++) rolePool.push("ANALYST");
  for (let i = 0; i < dist.PATCHER; i++) rolePool.push("PATCHER");
  for (let i = 0; i < dist.USER; i++) rolePool.push("USER");
  
  // Rolleri CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) ile karıştır
  for (let i = rolePool.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
  }
  
  return playerIds.map((id, index) => ({
    playerId: id,
    role: rolePool[index]
  }));
}
