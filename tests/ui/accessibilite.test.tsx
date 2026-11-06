// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../../src/App';
import { CalmProvider } from '../../src/ui/CalmContext';
import { RoundBoard } from '../../src/ui/RoundBoard';
import { SceneBoard } from '../../src/ui/SceneBoard';
import { ComparerBoard } from '../../src/ui/ComparerBoard';
import { MemoBoard } from '../../src/ui/MemoBoard';
import { QcmBoard } from '../../src/ui/QcmBoard';
import { setupRound } from '../../src/engine/setup.js';
import { makeRng } from '../../src/engine/rng.js';
import type { MechanicId } from '../../src/engine/types.js';
import { eauActivity, toutesActivity } from '../fixtures.js';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

/**
 * axe-core sous jsdom : ni contraste (aucune mise en page) ni ordre réel du focus. Seules les violations graves sont
 * retenues ; ce qui n'est pas mesurable ici est à mesurer à la main (docs/accessibilite/protocole-manuel.md).
 */
async function violationsGraves(conteneur: Element): Promise<string[]> {
  const r = await axe.run(conteneur, { rules: { 'color-contrast': { enabled: false } } });
  return r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id} (${v.nodes.length})`);
}

function sansMatchMedia() {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

describe('lien d’évitement', () => {
  it('le premier lien mène au contenu principal, qui peut recevoir le focus', () => {
    sansMatchMedia();
    render(<App />);
    const lien = screen.getByRole('link', { name: 'Aller au contenu' }) as HTMLAnchorElement;
    expect(lien.getAttribute('href')).toBe('#contenu');
    expect(document.querySelector('main')?.id).toBe('contenu');
    expect(document.querySelector('main')?.getAttribute('tabindex')).toBe('-1');
    expect(document.body.querySelector('a, button, input, select, textarea')).toBe(lien);
  });

  it('cliquer dessus met le focus sur le contenu et ne change pas la page affichée', async () => {
    sansMatchMedia();
    window.location.hash = '#/confidentialite';
    render(<App />);
    await userEvent.click(screen.getByRole('link', { name: 'Aller au contenu' }));
    expect(document.activeElement).toBe(document.querySelector('main'));
    expect(window.location.hash).toBe('#/confidentialite');
    expect(screen.getByRole('heading', { level: 2, name: 'Confidentialité' })).toBeTruthy();
  });
});

describe('axe-core, violations graves', () => {
  it('l’application (parcours)', async () => {
    sansMatchMedia();
    const { container } = render(<App />);
    expect(await violationsGraves(container)).toEqual([]);
  });

  it('les pages légales', async () => {
    sansMatchMedia();
    for (const h of ['#/confidentialite', '#/mentions']) {
      cleanup();
      window.location.hash = h;
      const { container } = render(<App />);
      expect(await violationsGraves(container), h).toEqual([]);
    }
  });

  const plateaux: [string, MechanicId][] = [
    ['trier', 'trier'],
    ['associer', 'associer'],
    ['ordre', 'ordre'],
    ['placer', 'placer'],
    ['comparer', 'comparer'],
    ['memo', 'memo'],
    ['qcm', 'qcm'],
  ];
  for (const [nom, m] of plateaux) {
    it(`le plateau « ${nom} »`, async () => {
      sansMatchMedia();
      const activite = m === 'trier' || m === 'associer' || m === 'ordre' ? eauActivity() : toutesActivity();
      const round = setupRound(activite, m, 'standard', makeRng(1));
      const rendu = (() => {
        if (m === 'placer') return <SceneBoard round={round} profile="standard" onDone={() => {}} />;
        if (m === 'comparer') return <ComparerBoard round={round} onDone={() => {}} />;
        if (m === 'memo') return <MemoBoard round={round} onDone={() => {}} />;
        if (m === 'qcm') return <QcmBoard round={round} onDone={() => {}} />;
        return <RoundBoard round={round} onDone={() => {}} />;
      })();
      const { container } = render(<CalmProvider>{rendu}</CalmProvider>);
      expect(await violationsGraves(container)).toEqual([]);
    });
  }
});

describe('annonces', () => {
  it('une réponse dans « comparer » est annoncée dans une région de statut non vide', async () => {
    sansMatchMedia();
    const round = setupRound(toutesActivity(), 'comparer', 'standard', makeRng(1));
    render(<ComparerBoard round={round} onDone={() => {}} />);
    const symboles = within(screen.getByRole('group', { name: 'Symboles' })).getAllByRole('button');
    await userEvent.click(symboles[0]);
    const regions = screen.getAllByRole('status');
    expect(regions.some((r) => (r.textContent ?? '').trim().length > 0)).toBe(true);
  });
});

describe('axe-core, écrans du suivi et du partage', () => {
  const classe = { id: 'c1', label: 'P4 B', nbCodes: 6, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true };
  const stockage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const seance = (code: string, jour: string, above = false) => ({
    sessionId: `${code}-${jour}`,
    studentCode: code,
    profile: 'standard' as const,
    totalElements: 2,
    endedAt: `${jour}T10:00:00.000Z`,
    cibles: ['M.P4.1.1.i1.a1'],
    mechanic: 'trier' as const,
    labels: { devant: 'devant', derriere: 'derrière' },
    results: [
      { elementId: 'e1', mechanic: 'trier' as const, firstTry: false, tries: 2, hintUsed: false, revealed: false, wrongChoices: ['derriere'], correct: 'devant' },
      { elementId: 'e2', mechanic: 'trier' as const, firstTry: true, tries: 1, hintUsed: false, revealed: false, wrongChoices: [], correct: 'derriere' },
    ],
    origine: 'ecran' as const,
    above,
  });

  it('le tableau de bord (états, évolution, faits)', async () => {
    sansMatchMedia();
    const { TableauDeBord } = await import('../../src/ui/TableauDeBord');
    const { magasinSuiviMemoire } = await import('../../src/suivi/lecture.js');
    const store = magasinSuiviMemoire({ classes: [classe], sessions: { c1: [seance('E01', '2026-11-09'), seance('E02', '2026-11-10'), seance('E01', '2026-11-11', true)] } });
    const { container } = render(<TableauDeBord classe={classe} store={store} stockage={stockage} />);
    await screen.findByText(/codes sur 6/);
    expect(await violationsGraves(container)).toEqual([]);
  });

  it('« Mes classes » (création, prénoms, observations, invitation, niveaux par code)', async () => {
    sansMatchMedia();
    const { MesClasses } = await import('../../src/ui/MesClasses');
    const { magasinSuiviMemoire } = await import('../../src/suivi/lecture.js');
    const { magasinPartageMemoire } = await import('../../src/partage/magasin.js');
    const { container } = render(<MesClasses store={magasinSuiviMemoire({ classes: [classe] })} stockage={stockage} telecharger={() => {}} partage={magasinPartageMemoire()} />);
    await screen.findByRole('region', { name: 'Niveaux par code' });
    expect(await violationsGraves(container)).toEqual([]);
  });

  it('« Proposer à la classe » avec un QR affiché', async () => {
    sansMatchMedia();
    const { PublierActivite } = await import('../../src/ui/PublierActivite');
    const { magasinSuiviMemoire } = await import('../../src/suivi/lecture.js');
    const { magasinPartageMemoire } = await import('../../src/partage/magasin.js');
    const { brouillonVide } = await import('../../src/atelier/brouillon.js');
    const { container } = render(
      <PublierActivite brouillon={{ ...brouillonVide(), titre: 'Les positions' }} suivi={magasinSuiviMemoire({ classes: [classe] })} partage={magasinPartageMemoire()} origine="https://gameactif.jfb4plai.com" copier={async () => {}} />,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Proposer à la classe' }));
    await screen.findByRole('img', { name: /QR code/ });
    expect(await violationsGraves(container)).toEqual([]);
  });
});

describe('axe-core, blocs d’aide ouverts', () => {
  it('le parcours avec son aide ouverte', async () => {
    sansMatchMedia();
    window.location.hash = '';
    const { container } = render(<App />);
    (container.querySelector('details.aide-ecran') as HTMLDetailsElement).open = true;
    expect(await violationsGraves(container)).toEqual([]);
  });

  it('la vue élève avec son aide ouverte', async () => {
    sansMatchMedia();
    const { VueEleve } = await import('../../src/ui/VueEleve');
    const brouillon = {
      niveau: 'P4', matiere: 'mathematiques', cibles: ['M.P4.1.1.i1.a1'], titre: 'Les positions', contexte: 'Activité partagée à la classe',
      familles: [{ label: 'Position absolue', elements: 'à l’intérieur\nentre' }, { label: 'Position relative', elements: 'devant\nà gauche' }, { label: '', elements: '' }],
      paires: 'devant | derrière\nà droite | à gauche', etapes: 'premier\ndeuxième\ntroisième', comparaisons: '', qcm: '',
    };
    const client = {
      async rpc(nom: string) {
        if (nom === 'game_get_shared_activity') return { data: { titre: 'Les positions', brouillon, mode: 'meme', profilDefaut: 'standard', classCode: 'ABCD2345', nbCodes: 6 }, error: null };
        return { data: 6, error: null };
      },
    };
    const mem = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const { container } = render(
      <CalmProvider>
        <VueEleve code="K7M2XQ9A" groupe={null} client={client} stockage={mem} />
      </CalmProvider>,
    );
    await screen.findByRole('heading', { name: 'Les positions' });
    (container.querySelector('details.aide-ecran') as HTMLDetailsElement).open = true;
    expect(await violationsGraves(container)).toEqual([]);
  });
});
