// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Parcours } from '../../src/ui/Parcours';
import { CalmProvider } from '../../src/ui/CalmContext';
import { PublierActivite } from '../../src/ui/PublierActivite';
import { MesClasses } from '../../src/ui/MesClasses';
import { TableauDeBord } from '../../src/ui/TableauDeBord';
import { NiveauxParCode } from '../../src/ui/NiveauxParCode';
import { VueEleve } from '../../src/ui/VueEleve';
import { AIDES, type AideId } from '../../src/aide/aides.js';
import { magasinSuiviMemoire, type ClasseLue } from '../../src/suivi/lecture.js';
import { magasinPartageMemoire } from '../../src/partage/magasin.js';
import { brouillonVide } from '../../src/atelier/brouillon.js';
import type { ClientPartage } from '../../src/partage/lecture.js';
import type { ClientSuivi } from '../../src/suivi/envoi.js';
import type { Stockage } from '../../src/parcours/stockage.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

afterEach(() => cleanup());

const brouillon = {
  niveau: 'P4',
  matiere: 'mathematiques',
  cibles: ['M.P4.1.1.i1.a1'],
  titre: 'Les positions',
  contexte: '18 élèves de 4e primaire, vocabulaire de position travaillé la semaine dernière.',
  familles: [
    { label: 'Position absolue', elements: 'à l’intérieur\nentre' },
    { label: 'Position relative', elements: 'devant\nà gauche' },
    { label: '', elements: '' },
  ],
  paires: 'devant | derrière\nà droite | à gauche',
  etapes: 'premier\ndeuxième\ntroisième',
  comparaisons: '',
  qcm: '',
};
const classe: ClasseLue = { id: 'c1', label: 'P4 B', nbCodes: 6, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true };
const stockage: StockageLocal = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function memoire(etape: string | null): Stockage & StockageLocal {
  const d = new Map<string, string>();
  if (etape !== null) d.set('gameactif.brouillon.v1', JSON.stringify({ v: 1, etape, brouillon }));
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}
function sansMatchMedia() {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}
/** Blocs d'aide dont les puces sont celles de ce texte (un écran qui en contient d'autres n'est pas gêné). */
const blocs = (id: AideId) =>
  [...document.querySelectorAll<HTMLDetailsElement>('details.aide-ecran')].filter((d) => [...d.querySelectorAll('li')].map((li) => li.textContent).join('|') === AIDES[id].puces.join('|'));
const total = () => document.querySelectorAll('details.aide-ecran').length;

describe('aide du parcours', () => {
  for (const etape of ['niveau', 'matiere', 'competences', 'elements'] as const) {
    it(`étape « ${etape} » : un seul bloc, replié, avec son texte`, () => {
      sansMatchMedia();
      render(
        <CalmProvider>
          <Parcours stockage={memoire(etape)} stockageInvitation={memoire(null)} />
        </CalmProvider>,
      );
      expect(total()).toBe(1);
      const [bloc] = blocs(`parcours-${etape}` as AideId);
      expect(bloc).toBeTruthy();
      expect(bloc.open).toBe(false);
    });
  }

  it('passer à l’étape des jeux remplace le bloc : un seul, replié, jamais ouvert d’office', async () => {
    sansMatchMedia();
    render(
      <CalmProvider>
        <Parcours stockage={memoire('elements')} stockageInvitation={memoire(null)} />
      </CalmProvider>,
    );
    const avant = blocs('parcours-elements')[0];
    avant.open = true;
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await screen.findByRole('heading', { name: 'Vos jeux' });
    expect(total()).toBe(1);
    expect(blocs('parcours-elements')).toHaveLength(0);
    expect(blocs('parcours-jeux')[0].open).toBe(false);
  });
});

describe('aide des écrans du suivi et du partage', () => {
  it('« Proposer à la classe »', async () => {
    sansMatchMedia();
    render(<PublierActivite brouillon={{ ...brouillonVide(), titre: 'Les positions' }} suivi={magasinSuiviMemoire({ classes: [classe] })} partage={magasinPartageMemoire()} origine="https://x.be" copier={async () => {}} />);
    await screen.findByRole('button', { name: 'Proposer à la classe' });
    expect(blocs('proposer')).toHaveLength(1);
    expect(blocs('proposer')[0].open).toBe(false);
  });

  it('« Mes classes »', async () => {
    sansMatchMedia();
    render(<MesClasses store={magasinSuiviMemoire({ classes: [classe] })} stockage={stockage} telecharger={() => {}} partage={magasinPartageMemoire()} />);
    await screen.findByText(/Code de la classe/);
    expect(blocs('classes')).toHaveLength(1);
    expect(blocs('classes')[0].open).toBe(false);
  });

  it('le tableau de bord', async () => {
    sansMatchMedia();
    const seance = {
      sessionId: 's1',
      studentCode: 'E01',
      profile: 'standard' as const,
      totalElements: 1,
      endedAt: '2026-11-10T10:00:00.000Z',
      cibles: ['M.P4.1.1.i1.a1'],
      mechanic: 'trier' as const,
      labels: {},
      results: [{ elementId: 'e1', mechanic: 'trier' as const, firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [], correct: 'devant' }],
      origine: 'ecran' as const,
      above: false,
    };
    render(<TableauDeBord classe={classe} store={magasinSuiviMemoire({ classes: [classe], sessions: { c1: [seance] } })} stockage={stockage} />);
    await screen.findByText(/codes sur 6|code sur 6/);
    expect(blocs('tableau')).toHaveLength(1);
    expect(blocs('tableau')[0].open).toBe(false);
  });

  it('« Niveaux par code »', async () => {
    sansMatchMedia();
    render(<NiveauxParCode classe={classe} partage={magasinPartageMemoire()} stockage={stockage} />);
    await screen.findByLabelText('Niveau de E01');
    expect(blocs('niveaux')).toHaveLength(1);
    expect(blocs('niveaux')[0].open).toBe(false);
  });

  it('la vue élève : l’aide élève, repliée', async () => {
    sansMatchMedia();
    const client: ClientPartage & ClientSuivi = {
      async rpc(nom: string) {
        if (nom === 'game_get_shared_activity') return { data: { titre: 'Les positions', brouillon: { ...brouillon, contexte: 'Activité partagée à la classe' }, mode: 'meme', profilDefaut: 'standard', classCode: 'ABCD2345', nbCodes: 6 }, error: null };
        return { data: 6, error: null };
      },
    };
    render(
      <CalmProvider>
        <VueEleve code="K7M2XQ9A" groupe={null} client={client} stockage={stockage} />
      </CalmProvider>,
    );
    await screen.findByRole('heading', { name: 'Les positions' });
    expect(blocs('eleve')).toHaveLength(1);
    expect(blocs('eleve')[0].open).toBe(false);
    expect(document.body.textContent).not.toMatch(/Soutien/);
  });
});
