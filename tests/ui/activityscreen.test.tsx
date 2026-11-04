// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('le jeu s’ouvre sous le bouton Jouer, dans la même paire de cartes, et la page y défile', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Jouer : Associer' }));
    const article = screen.getByRole('heading', { name: 'Jeu sur écran : Associer' }).closest('article') as HTMLElement;
    expect(within(article).getByRole('region', { name: 'Plateau de jeu' })).toBeTruthy();
    expect(scroll).toHaveBeenCalled();
    expect(screen.getAllByRole('region', { name: 'Plateau de jeu' })).toHaveLength(1);
  });

  it('ouvrir un autre jeu ferme le premier et ouvre le second sous sa propre paire de cartes', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Jouer : Trier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Jouer : Placer dans une scène' }));
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).toBeNull();
    const article = screen.getByRole('heading', { name: 'Jeu sur écran : Placer dans une scène' }).closest('article') as HTMLElement;
    expect(within(article).getByRole('region', { name: 'Place le chat' })).toBeTruthy();
  });

  it('les quatre fiches physiques sont repliées par défaut, avec un résumé clair', () => {
    mount();
    const fiches = document.querySelectorAll<HTMLDetailsElement>('details.fiche-pliee');
    expect(fiches).toHaveLength(4);
    for (const d of fiches) {
      expect(d.open).toBe(false);
      expect(d.querySelector('summary')?.textContent).toBe('Voir la fiche : matériel, déroulement, cartes');
    }
  });

  it('avant l’impression toutes les fiches s’ouvrent, après elles reprennent leur état', () => {
    mount();
    const fiches = [...document.querySelectorAll<HTMLDetailsElement>('details.fiche-pliee')];
    fiches[1].open = true;
    window.dispatchEvent(new Event('beforeprint'));
    expect(fiches.every((d) => d.open)).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    expect(fiches.map((d) => d.open)).toEqual([false, true, false, false]);
  });

  it('range « Autres jeux, avec votre IA » dans un cadre replié, masqué à l’impression', () => {
    mount();
    const cadre = screen.getByText('Autres jeux, avec votre IA').closest('details') as HTMLDetailsElement;
    expect(cadre.open).toBe(false);
    expect(cadre.classList.contains('hors-impression')).toBe(true);
    expect(within(cadre).getAllByRole('button', { name: /^Copier le prompt/ })).toHaveLength(2);
  });
});

describe('nombre d’élèves', () => {
  it('est prérempli avec l’effectif cité dans le contexte de classe, et le dit', () => {
    const a = { ...activitePilote(), context: 'Classe de 18 élèves de 4e primaire, vocabulaire vu la semaine dernière.' };
    mount(a);
    expect((screen.getByLabelText('Nombre d’élèves') as HTMLInputElement).value).toBe('18');
    expect(screen.getByText(/Prérempli d’après votre contexte de classe/)).toBeTruthy();
  });

  it('garde 24 quand le contexte ne cite aucun effectif crédible', () => {
    for (const context of ['Exemple non relu', 'Classe de 120 élèves', 'Classe de 0 élève', 'Né en 2015 : 4e primaire']) {
      cleanup();
      mount({ ...activitePilote(), context });
      expect((screen.getByLabelText('Nombre d’élèves') as HTMLInputElement).value).toBe('24');
    }
  });
});
