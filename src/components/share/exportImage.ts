// DOM'daki bir tasarımı PNG'ye çevirip indirir ya da (telefonda) paylaşım menüsünü açar.
import { toBlob } from 'html-to-image';

export async function nodeToPng(node: HTMLElement, width: number, height: number): Promise<Blob> {
  // Fontlar ve görseller hazır olmadan çekilen görüntüde yazılar yedek fontla çıkar.
  await document.fonts.ready;
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  const blob = await toBlob(node, { width, height, pixelRatio: 1, cacheBust: false, style: { transform: 'none', margin: '0' } });
  if (!blob) throw new Error('Görsel oluşturulamadı');
  return blob;
}

/** Telefonda paylaşım menüsü (Instagram'a doğrudan), olmazsa dosya olarak indirme. */
export async function shareOrDownload(blob: Blob, filename: string, preferShare = true): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (preferShare && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
