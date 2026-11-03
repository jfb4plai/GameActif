// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityScreen } from '../../src/ui/ActivityScreen';
import { CalmProvider } from '../../src/ui/CalmContext';
import { PHYSICAL_TEMPLATES } from '../../src/physical/templates.js';
import { activitePilote } from '../../src/data/pilote.js';

afterEach(() => cleanup());

function mount(activity = activitePilote()) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  render(<CalmProvider><ActivityScreen activity={activity} /></CalmProvider>);
}
const fiche = (title: string) => screen.getByRole('region', { name: title });
const nombre = (title: string, matiere: string) => {
  const m = within(fiche(title)).getByText(new RegExp(`^${matiere} : \\d+$`)).textContent as string;
  return Number(m.split(' : ')[1]);
};

describe('ActivityScreen', () => {
  it('propose pour chaque jeu sur écran un jeu physique en regard (quatre et quatre)', () => {
    mount();
    expect(screen.getAllByRole('heading', { name: /^Jeu sur écran/ })).toHaveLength(4);
    const classes = screen.getAllByRole('heading', { name: /^En classe, sans écran/ });
    expect(classes).toHaveLength(4);
    for (const t of Object.values(PHYSICAL_TEMPLATES)) {
      expect(classes.some((h) => h.textContent === `En classe, sans écran : ${t.title}`)).toBe(true);
    }
  });

  it('une mécanique indisponible n’affiche ni le jeu sur écran ni le jeu physique', () => {
    const a = activitePilote();
    delete a.sceneId;
    mount(a);
    expect(screen.getAllByRole('heading', { name: /^Jeu sur écran/ })).toHaveLength(3);
    expect(screen.queryByRole('heading', { name: /Place-le dans la classe/ })).toBeNull();
  });

  it('le profil change le nombre de cartes de la fiche physique', async () => {
    mount();
    const standard = nombre('Les boîtes aux lettres', 'Cartes-mots');
    await userEvent.selectOptions(screen.getByLabelText('Profil'), 'soutien');
    const soutien = nombre('Les boîtes aux lettres', 'Cartes-mots');
    await userEvent.selectOptions(screen.getByLabelText('Profil'), 'defi');
    const defi = nombre('Les boîtes aux lettres', 'Cartes-mots');
    expect(soutien).toBeLessThan(standard);
    expect(defi).toBeGreaterThan(standard);
  });

  it('le nombre d’élèves change le nombre d’équipes et d’un carton par équipe', async () => {
    mount();
    expect(nombre('Les boîtes aux lettres', 'Cartons verts « prêt »')).toBe(Math.ceil(24 / PHYSICAL_TEMPLATES.trier.teamSize.max));
    const champ = screen.getByLabelText('Nombre d’élèves');
    await userEvent.clear(champ);
    await userEvent.type(champ, '10');
    expect(nombre('Les boîtes aux lettres', 'Cartons verts « prêt »')).toBe(Math.ceil(10 / PHYSICAL_TEMPLATES.trier.teamSize.max));
  });

  it('chaque champ a un label, un placeholder et un texte d’aide', () => {
    mount();
    const champ = screen.getByLabelText('Nombre d’élèves') as HTMLInputElement;
    expect(champ.placeholder).toBe('24');
    expect(champ.getAttribute('aria-describedby')).toBeTruthy();
    const aide = document.getElementById(champ.getAttribute('aria-describedby') as string) as HTMLElement;
    expect(aide.textContent).toContain('matériel');
    expect((screen.getByLabelText('Profil') as HTMLSelectElement).getAttribute('aria-describedby')).toBeTruthy();
  });

  it('Jouer ouvre le plateau du jeu choisi', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Jouer : Trier' }));
    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeTruthy();
  });

  it('Jouer à Placer ouvre la scène', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Jouer : Placer dans une scène' }));
    expect(screen.getByRole('region', { name: 'Place le chat' })).toBeTruthy();
  });
});
