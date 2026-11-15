import QRCode from 'qrcode';

/** Saf SVG QR kod (harici servis yok, innerHTML yok). */
export default function QrCode({ value, size = 120, className = '' }: { value: string; size?: number; className?: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2;
  const total = n + quiet * 2;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(x, y)) rects.push(<rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width={1.02} height={1.02} />);
    }
  }
  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`QR kod: ${value}`}
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#e4e2fb" rx={1} />
      <g fill="#0a0a16">{rects}</g>
    </svg>
  );
}
