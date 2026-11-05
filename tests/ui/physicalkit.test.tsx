// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhysicalKitView } from '../../src/ui/PhysicalKitView';
import { buildPhysicalKit } from '../../src/physical/kit.js';
import { programmeLinks } from '../../src/physical/programme.js';
import { activitePilote } from '../../src/data/pilote.js';
import { eauActivity, toutesActivity } from '../fixtures.js';

afterEach(() => cleanup());

const A1 = 'M.P4.1.1.i1.a1';
const pilote = () => activitePilote();

function mount(mechanic: 'trier' | 'placer' = 'trier', cibles: string[] = [A1, 'M.P4.1.1.i1.a2']) {
  const kit = buildPhysicalKit(pilote(), mechanic, 'standard', 1, 24);
  const links = programmeLinks(mechanic, 'physique', cibles);
  render(<PhysicalKitView kit={kit} links={links} />);
  return { kit, links };
}

describe('PhysicalKitView', () => {
  it('affiche chaque ligne de matériel avec sa quantité', () => {
    const { kit } = mount();
    for (const m of kit.material) expect(screen.getByText(`${m.name} : ${m.count}`)).toBeTruthy();
  });

  it('dit si le jeu fait manipuler, déplacer, ou les deux', () => {
    mount();
    expect(screen.getByText('Manipulation et déplacement')).toBeTruthy();
  });

  it('affiche les garde-fous de calme et de sécurité', () => {
    const { kit } = mount();
    expect(screen.getByText('Pas de course.')).toBeTruthy();
    expect(screen.getByText('Pas de chronomètre.')).toBeTruthy();
    expect(screen.getByText('Pas de compétition entre équipes.')).toBeTruthy();
    expect(screen.getByText('Un seul groupe se déplace à la fois.')).toBeTruthy();
    expect(screen.getByText(`Signal d’arrêt : ${kit.calm.stopSignal}`)).toBeTruthy();
    expect(screen.getByText(`Matériel sûr : ${kit.calm.safeMaterial}`)).toBeTruthy();
  });

  it('affiche pour chaque attendu le code, le texte officiel et la phrase de lien', () => {
    const { links } = mount();
    for (const l of links) {
      expect(screen.getByText(l.code)).toBeTruthy();
      expect(screen.getByText(l.texte)).toBeTruthy();
    }
    expect(screen.getAllByText(links[0].phrase as string).length).toBeGreaterThan(0);
  });

  it('une phrase absente est remplacée par l’invitation à la compléter', () => {
    mount('trier', ['M.P4.2.1.i1.a1']);
    expect(screen.getByText('À compléter par l’enseignant : en quoi ce jeu travaille cet attendu.')).toBeTruthy();
  });

  it('signale l’attendu travaillé en plus en classe', () => {
    mount('placer', [A1, 'M.P4.1.1.i2.a2']);
    expect(screen.getByText('attendu travaillé en plus en classe')).toBeTruthy();
    expect(screen.getByText('M.P4.1.1.i3.a1')).toBeTruthy();
  });

  it('le corrigé liste toutes les cartes avec leur station', () => {
    const { kit } = mount();
    const corrige = screen.getByRole('table', { name: 'Corrigé' });
    for (const k of kit.answerKey) {
      const row = within(corrige).getByText(kit.cards.find((c) => c.id === k.cardId)!.text).closest('tr') as HTMLElement;
      expect(row.textContent).toContain(kit.stations.find((s) => s.id === k.stationId)!.label);
    }
  });

  it('chaque carte imprimable contient le texte complet, même long', () => {
    const a = eauActivity();
    const long = 'x'.repeat(30) + ' ' + 'y'.repeat(30) + ' ' + 'z'.repeat(28);
    a.items[8].text = long;
    const kit = buildPhysicalKit(a, 'trier', 'defi', 1, 24);
    render(<PhysicalKitView kit={kit} links={[]} />);
    const cartes = screen.getByRole('list', { name: 'Cartes à imprimer' });
    expect(within(cartes).getByText(long)).toBeTruthy();
    expect(within(cartes).getAllByRole('listitem')).toHaveLength(kit.cards.length);
  });

  it('le bouton Imprimer appelle l’impression du navigateur', async () => {
    const print = vi.fn();
    window.print = print;
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Imprimer la fiche' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('Associer : les cartes de droite sont imprimables, pas seulement celles de gauche', () => {
    const kit = buildPhysicalKit(pilote(), 'associer', 'standard', 1, 24);
    render(<PhysicalKitView kit={kit} links={[]} />);
    const droite = screen.getByRole('list', { name: 'Cartes de droite à imprimer' });
    const items = within(droite).getAllByRole('listitem');
    expect(items).toHaveLength(kit.stations.length);
    for (const st of kit.stations) expect(within(droite).getByText(st.label)).toBeTruthy();
  });

  it('Trier : les étiquettes de catégorie sont imprimables', () => {
    const kit = buildPhysicalKit(pilote(), 'trier', 'standard', 1, 24);
    render(<PhysicalKitView kit={kit} links={[]} />);
    const etiquettes = screen.getByRole('list', { name: 'Étiquettes à imprimer' });
    expect(within(etiquettes).getAllByRole('listitem')).toHaveLength(kit.stations.length);
  });

  it('Remettre en ordre et Placer n’ont pas de seconde série à imprimer', () => {
    for (const m of ['ordre', 'placer'] as const) {
      cleanup();
      render(<PhysicalKitView kit={buildPhysicalKit(pilote(), m, 'standard', 1, 24)} links={[]} />);
      expect(screen.queryByRole('list', { name: 'Cartes de droite à imprimer' })).toBeNull();
      expect(screen.queryByRole('list', { name: 'Étiquettes à imprimer' })).toBeNull();
    }
  });
});

describe('PhysicalKitView, nouveaux gabarits', () => {
  it('Mémo : « Cartes à imprimer » liste 2n cartes et le corrigé existe', () => {
    const kit = buildPhysicalKit(eauActivity(), 'memo', 'standard', 1, 24);
    render(<PhysicalKitView kit={kit} links={programmeLinks('memo', 'physique', [A1])} />);
    expect(within(screen.getByRole('list', { name: 'Cartes à imprimer' })).getAllByRole('listitem')).toHaveLength(kit.cards.length);
    expect(screen.getByRole('table', { name: 'Corrigé' })).toBeTruthy();
    expect(screen.queryByText('Cartes de droite à imprimer')).toBeNull();
  });

  it('QCM : affiche les lettres des cartons', () => {
    const kit = buildPhysicalKit(toutesActivity(), 'qcm', 'standard', 1, 24);
    render(<PhysicalKitView kit={kit} links={programmeLinks('qcm', 'physique', [A1])} />);
    expect(screen.getByText('Lettres des cartons')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Lettres des cartons' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A', 'B', 'C']);
  });
});
