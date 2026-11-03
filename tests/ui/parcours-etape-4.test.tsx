// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { EtapeElements } from '../../src/ui/EtapeElements';
import { etatInitial, reduire, type EtatParcours } from '../../src/parcours/etapes.js';

afterEach(() => cleanup());

const depart = (): EtatParcours => {
  const e = etatInitial();
  return { etape: 'elements', brouillon: { ...e.brouillon, niveau: 'P4', matiere: 'mathematiques', cibles: ['M.P4.1.1.i1.a1'] } };
};

function Harnais() {
  const [etat, envoyer] = useReducer(reduire, depart());
  return <EtapeElements etat={etat} envoyer={envoyer} />;
}

const zone = (nom: RegExp | string) => screen.getByRole('textbox', { name: nom }) as HTMLTextAreaElement | HTMLInputElement;

describe('EtapeElements, guidage des champs', () => {
  it('le contexte de classe a un exemple réel et rappelle de ne saisir aucun nom d’élève', () => {
    render(<Harnais />);
    const c = zone('Contexte de classe');
    expect(c.placeholder).toBe('Exemple : 18 élèves de 4e primaire, vocabulaire de position travaillé la semaine dernière');
    const aide = document.getElementById(c.getAttribute('aria-describedby') as string) as HTMLElement;
    expect(aide.textContent).toContain('aucun nom d’élève');
  });

  it('chaque champ a un label, un placeholder et un texte d’aide non vide', () => {
    render(<Harnais />);
    const champs = screen.getAllByRole('textbox') as (HTMLInputElement | HTMLTextAreaElement)[];
    expect(champs).toHaveLength(10);
    for (const c of champs) {
      expect(c.placeholder.trim().length).toBeGreaterThan(3);
      const aide = document.getElementById(c.getAttribute('aria-describedby') as string);
      expect(aide?.textContent?.trim().length).toBeGreaterThan(10);
      expect(screen.getByLabelText(c.labels?.[0]?.textContent as string)).toBe(c);
    }
  });
});

describe('EtapeElements, saisie et statuts', () => {
  it('signale une ligne de paires sans séparateur avec son numéro', async () => {
    render(<Harnais />);
    await userEvent.type(zone('Paires à relier'), 'devant | derrière{enter}à droite | à gauche{enter}sans séparateur');
    expect(screen.getByRole('status').textContent).toContain('Paires, ligne 3 : Il manque le séparateur « | » entre les deux éléments.');
  });

  it('nomme le mot écrit dans deux familles', async () => {
    render(<Harnais />);
    await userEvent.type(zone('Nom de la famille 1'), 'Famille A');
    await userEvent.type(zone('Éléments de la famille 1'), 'entre');
    await userEvent.type(zone('Nom de la famille 2'), 'Famille B');
    await userEvent.type(zone('Éléments de la famille 2'), 'entre');
    expect(screen.getByRole('status').textContent).toContain('Le mot « entre » est dans deux familles : Famille A et Famille B.');
  });

  it('les statuts par jeu se mettent à jour à la saisie', async () => {
    render(<Harnais />);
    const statut = (nom: string) => screen.getByText(new RegExp(`^${nom} :`)).textContent;
    expect(statut('Associer')).toBe('Associer : Il faut au moins 2 paires.');
    expect(statut('Trier')).toBe('Trier : Il faut au moins 2 catégories contenant chacune un élément.');
    await userEvent.type(zone('Paires à relier'), 'a | b{enter}c | d');
    expect(statut('Associer')).toBe('Associer : Disponible');
    await userEvent.type(zone('Étapes dans l’ordre'), 'un{enter}deux{enter}trois');
    expect(statut('Remettre en ordre')).toBe('Remettre en ordre : Disponible');
  });

  it('ne parle pas du jeu Placer dans une scène, réservé aux scènes PLAI', () => {
    render(<Harnais />);
    expect(screen.queryByText(/Placer dans une scène/)).toBeNull();
  });

  it('les saisies passent par un événement modifier', async () => {
    const envoyer = vi.fn();
    render(<EtapeElements etat={depart()} envoyer={envoyer} />);
    await userEvent.type(zone('Titre de l’activité'), 'L');
    expect(envoyer).toHaveBeenCalledWith({ type: 'modifier', champ: { titre: 'L' } });
    await userEvent.type(zone('Nom de la famille 2'), 'B');
    const appel = envoyer.mock.calls.at(-1)?.[0];
    expect(appel.champ.familles).toEqual([
      { label: '', elements: '' },
      { label: 'B', elements: '' },
      { label: '', elements: '' },
    ]);
  });

  it('garde une apostrophe typographique et un texte de 90 caractères tels qu’ils sont saisis', async () => {
    render(<Harnais />);
    const long = 'x'.repeat(30) + ' ' + 'y'.repeat(30) + ' ' + 'z'.repeat(28);
    await userEvent.type(zone('Étapes dans l’ordre'), `à l’intérieur{enter}${long}`);
    expect(zone('Étapes dans l’ordre').value).toBe(`à l’intérieur\n${long}`);
  });
});
