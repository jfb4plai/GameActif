import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

const SILENCE = 4;

/** Modules du QR code (vrai = sombre), ou null si le lien est trop long pour un QR code. */
function modulesDu(lien: string): boolean[][] | null {
  try {
    const q = qrcode(0, 'M');
    q.addData(lien);
    q.make();
    const n = q.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
  } catch {
    return null;
  }
}

/**
 * QR code d'un lien, dessiné dans le navigateur (aucun service externe), noir sur blanc, avec la zone de silence de
 * 4 modules. À afficher en grand au TBI : le lien en texte et le bouton « Copier » restent à côté.
 */
export function CodeQr({ lien, libelle }: { lien: string; libelle: string }) {
  const modules = useMemo(() => modulesDu(lien), [lien]);
  if (modules === null) return <p role="alert" className="raisons">Ce lien est trop long pour un QR code. Copiez-le et envoyez-le autrement.</p>;
  const n = modules.length;
  const taille = n + 2 * SILENCE;
  return (
    <svg viewBox={`0 0 ${taille} ${taille}`} role="img" aria-label={`QR code : ${libelle}`} width="100%" style={{ maxWidth: '28rem' }} shapeRendering="crispEdges">
      <rect x={0} y={0} width={taille} height={taille} fill="#fff" />
      {modules.flatMap((ligne, r) =>
        ligne.map((sombre, c) => (sombre ? <rect key={`${r}-${c}`} x={c + SILENCE} y={r + SILENCE} width={1} height={1} fill="#000" /> : null)),
      )}
    </svg>
  );
}
