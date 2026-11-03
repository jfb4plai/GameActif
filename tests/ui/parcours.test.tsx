// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Parcours } from '../../src/ui/Parcours';
import { CalmProvider } from '../../src/ui/CalmContext';
import type { Stockage } from '../../src/parcours/stockage.js';

afterEach(() => cleanup());

function memoire(): Stockage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function monter(stockage: Stockage | null = memoire(), telecharger?: (nom: string, contenu: string) => void) {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return render(<CalmProvider><Parcours stockage={stockage} telecharger={telecharger} /></CalmProvider>);
}

const clic = (nom: string | RegExp, role: 'button' | 'checkbox' = 'button') => userEvent.click(screen.getByRole(role, { name: nom }));
const taper = (nom: string, texte: string) => userEvent.type(screen.getByRole('textbox', { name: nom }), texte);

async function versElements() {
  await clic('P4');
  await clic('Suivant');
  await clic('Mathématiques');
  await clic('Suivant');
  await clic(/M\.P4\.1\.1\.i1\.a1(?!\d)/, 'checkbox');
  await clic(/M\.P4\.2\.1\.i1\.a1(?!\d)/, 'checkbox');
  await clic('Suivant');
}

async function remplir() {
  await taper('Titre de l’activité', 'Les positions');
  await taper('Contexte de classe', '18 élèves de 4e primaire.');
  await taper('Nom de la famille 1', 'Absolue');
  await taper('Éléments de la famille 1', 'entre{enter}à l’intérieur');
  await taper('Nom de la famille 2', 'Relative');
  await taper('Éléments de la famille 2', 'devant{enter}à gauche');
  await taper('Paires à relier', 'devant | derrière{enter}à droite | à gauche');
}

describe('Parcours', () => {
  it('commence à l’étape 1, Suivant est désactivé et dit pourquoi', () => {
    monter();
    expect(screen.getByText('Étape 1 sur 5 : Niveau')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Suivant' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Choisissez un niveau.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Précédent' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Suivant est désactivé à chaque étape incomplète, avec la raison', async () => {
    monter();
    await clic('P4');
    await clic('Suivant');
    expect(screen.getByText('Choisissez une matière.')).toBeTruthy();
    await clic('Mathématiques');
    await clic('Suivant');
    expect((screen.getByRole('button', { name: 'Suivant' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Choisissez de 1 à 3 compétences.')).toBeTruthy();
  });

  it('un parcours complet mène aux jeux sur écran et aux jeux physiques en regard', async () => {
    monter();
    await versElements();
    expect(screen.getByText('Étape 4 sur 5 : Vos éléments')).toBeTruthy();
    await remplir();
    const suivant = screen.getByRole('button', { name: 'Suivant' }) as HTMLButtonElement;
    expect(suivant.disabled).toBe(false);
    suivant.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('Étape 5 sur 5 : Vos jeux')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Jeu sur écran : Trier' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Jeu sur écran : Associer' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'En classe, sans écran : Les boîtes aux lettres' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Placer dans une scène/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Jeu sur écran : Remettre en ordre/ })).toBeNull();
  });

  it('un attendu hors pilote affiche « À compléter par l’enseignant »', async () => {
    monter();
    await versElements();
    await remplir();
    await clic('Suivant');
    expect(screen.getAllByText('À compléter par l’enseignant : en quoi ce jeu travaille cet attendu.').length).toBeGreaterThan(0);
  });

  it('Modifier mes éléments ramène à la saisie sans rien perdre', async () => {
    monter();
    await versElements();
    await remplir();
    await clic('Suivant');
    await clic('Modifier mes éléments');
    expect(screen.getByText('Étape 4 sur 5 : Vos éléments')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Titre de l’activité' }) as HTMLInputElement).value).toBe('Les positions');
  });

  it('l’exemple des positions affiche les quatre jeux et permet de revenir', async () => {
    monter();
    await clic('Voir l’exemple des positions (P4)');
    expect(screen.getAllByRole('heading', { name: /^Jeu sur écran/ })).toHaveLength(4);
    await clic('Retour au parcours');
    expect(screen.getByText('Étape 1 sur 5 : Niveau')).toBeTruthy();
  });

  it('un rechargement retrouve l’étape de saisie et le texte déjà tapé', async () => {
    const stockage = memoire();
    const { unmount } = monter(stockage);
    await versElements();
    await taper('Titre de l’activité', 'Mon titre');
    unmount();
    monter(stockage);
    expect(screen.getByText('Étape 4 sur 5 : Vos éléments')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Titre de l’activité' }) as HTMLInputElement).value).toBe('Mon titre');
  });

  it('sans stockage disponible le parcours fonctionne quand même', async () => {
    monter(null);
    await clic('P3');
    expect(screen.getByRole('button', { name: 'P3' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Recommencer remet le parcours à l’étape 1, brouillon vide', async () => {
    monter();
    await versElements();
    await taper('Titre de l’activité', 'Mon titre');
    await clic('Recommencer');
    expect(screen.getByText('Étape 1 sur 5 : Niveau')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'P4' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('une activité téléchargée puis ouverte dans un parcours neuf retrouve titre et saisie', async () => {
    const reçu: { nom: string; contenu: string }[] = [];
    const telecharger = (nom: string, contenu: string) => void reçu.push({ nom, contenu });
    const premier = monter(memoire(), telecharger);
    await versElements();
    await remplir();
    await clic('Télécharger mon activité');
    expect(reçu).toHaveLength(1);
    expect(reçu[0].nom).toMatch(/^gameactif-les-positions-\d{4}-\d{2}-\d{2}\.json$/);
    premier.unmount();

    monter(memoire(), telecharger);
    expect(screen.getByText('Étape 1 sur 5 : Niveau')).toBeTruthy();
    await userEvent.upload(screen.getByLabelText('Ouvrir une activité (fichier)'), new File([reçu[0].contenu], reçu[0].nom, { type: 'application/json' }));
    await waitFor(() => expect(screen.getByText('Étape 4 sur 5 : Vos éléments')).toBeTruthy());
    expect((screen.getByRole('textbox', { name: 'Titre de l’activité' }) as HTMLInputElement).value).toBe('Les positions');
    expect((screen.getByRole('textbox', { name: 'Paires à relier' }) as HTMLTextAreaElement).value).toBe('devant | derrière\nà droite | à gauche');
  });

  it('la barre de fichier est visible aux étapes 1, 4 et 5 et absente aux étapes 2 et 3', async () => {
    monter();
    expect(screen.getByLabelText('Ouvrir une activité (fichier)')).toBeTruthy();
    await clic('P4');
    await clic('Suivant');
    expect(screen.queryByLabelText('Ouvrir une activité (fichier)')).toBeNull();
    await clic('Mathématiques');
    await clic('Suivant');
    expect(screen.queryByLabelText('Ouvrir une activité (fichier)')).toBeNull();
  });

  it('place le focus sur le titre de l’étape quand on change d’étape', async () => {
    monter();
    await clic('P4');
    await clic('Suivant');
    expect(document.activeElement?.id).toBe('titre-etape');
  });
});
