import { notFound } from 'next/navigation';

// Web admin paneli kaldırıldı: yönetim artık yerel uygulamada (`npm run admin`). Bu klasörü silebilirsiniz.
export default function RemovedAdminPage() {
  notFound();
}
