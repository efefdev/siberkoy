import { ScanSearch, ShieldCheck, Skull, UserRound, type LucideProps } from 'lucide-react';
import type { RoleKey } from '@/lib/roles';

const ICONS: Record<RoleKey, React.ComponentType<LucideProps>> = {
  ATTACKER: Skull,
  ANALYST: ScanSearch,
  PATCHER: ShieldCheck,
  USER: UserRound,
};

export default function RoleIcon({ role, ...props }: { role: string } & LucideProps) {
  const Icon = ICONS[role as RoleKey] ?? UserRound;
  return <Icon aria-hidden="true" {...props} />;
}
