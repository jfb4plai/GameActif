export type ModeArcade = 'bulles' | 'briques';

export const MODES: Record<ModeArcade, { nom: string; resume: string; source: 'trier' | 'trier-ou-associer' }> = {
  bulles: {
    nom: 'Tir aux bulles',
    resume: 'L’élève envoie chaque élément, comme une bulle, vers le groupe de sa famille ; trois niveaux, dont deux avec des barres à contourner en déplaçant le canon.',
    source: 'trier',
  },
  briques: {
    nom: 'Casse-briques',
    resume: 'L’élève oriente une flèche de direction, lance la balle et casse la brique qui répond à la consigne ; un mode pas à pas sans balle est prévu.',
    source: 'trier-ou-associer',
  },
};

export interface PromptArcade {
  mode: ModeArcade;
  titre: string;
  texte: string;
  nbElements: number;
}

export interface PromptLibre {
  titre: string;
  texte: string;
}
