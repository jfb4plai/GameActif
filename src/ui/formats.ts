/** Part exprimée en pourcentage entier : 0,5 devient « 50 % ». */
export const pourcent = (x: number): string => `${Math.round(x * 100)} %`;

/** Date lisible en français de Belgique : « 9 nov. 2026 ». */
export const dateFr = (iso: string): string => new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });

/** Codes élèves d'une classe : E01 à E<n>. */
export const codesDeClasse = (n: number): string[] => Array.from({ length: n }, (_, i) => `E${String(i + 1).padStart(2, '0')}`);
