/**
 * Interrupteur du suivi des élèves (classes, résultats, activités partagées). Tant que les migrations ne sont pas
 * appliquées sur la base, rien n'en apparaît : `VITE_SUIVI_ACTIF=1` l'ouvre.
 */
export const SUIVI_ACTIF_PAR_DEFAUT = import.meta.env.VITE_SUIVI_ACTIF === '1';
