// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { activitePilote } from '../../src/data/pilote.js';
import type { Activity } from '../../src/engine/types.js';
import { construirePrompt, VERIFICATION } from '../../src/prompts/construire.js';
import { AutresJeux } from '../../src/ui/AutresJeux.js';
import { eauActivity } from '../fixtures.js';

afterEach(() => cleanup());

const GRAINE = 11;

describe('AutresJeux', () => {
  it('propose deux cartes de mode avec leurs boutons', () => {
    render(<AutresJeux activity={activitePilote()} profile="standard" graine={GRAINE} />);
    expect(screen.getByRole('heading', { name: 'Tir aux bulles' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Casse-briques' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Copier le prompt/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Télécharger le prompt/ })).toHaveLength(2);
  });

  it('copie exactement le texte du constructeur pour le profil courant et le confirme', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    const a = activitePilote();
    render(<AutresJeux activity={a} profile="soutien" graine={GRAINE} copier={copier} />);
    await userEvent.click(screen.getAllByRole('button', { name: /^Copier le prompt/ })[0]);
    expect(copier).toHaveBeenCalledWith(construirePrompt(a, 'bulles', 'soutien', GRAINE).texte);
    expect(await screen.findByText('Prompt copié.')).toBeTruthy();
  });

  it('change le texte copié quand le profil change', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    const a = activitePilote();
    const { rerender } = render(<AutresJeux activity={a} profile="soutien" graine={GRAINE} copier={copier} />);
    rerender(<AutresJeux activity={a} profile="defi" graine={GRAINE} copier={copier} />);
    await userEvent.click(screen.getAllByRole('button', { name: /^Copier le prompt/ })[0]);
    expect(copier).toHaveBeenCalledWith(construirePrompt(a, 'bulles', 'defi', GRAINE).texte);
  });

  it('quand la copie échoue, le dit, ouvre l\'aperçu et sélectionne son contenu', async () => {
    const copier = vi.fn().mockRejectedValue(new Error('refusé'));
    const a = activitePilote();
    render(<AutresJeux activity={a} profile="standard" graine={GRAINE} copier={copier} />);
    await userEvent.click(screen.getAllByRole('button', { name: /^Copier le prompt/ })[0]);
    expect(await screen.findByText('La copie automatique n\'a pas fonctionné. Sélectionnez le texte ci-dessous et copiez-le.')).toBeTruthy();
    const zone = screen.getByLabelText('Prompt : Tir aux bulles') as HTMLTextAreaElement;
    const details = zone.closest('details') as HTMLDetailsElement;
    await waitFor(() => expect(details.open).toBe(true));
    expect(zone.selectionStart).toBe(0);
    expect(zone.selectionEnd).toBe(zone.value.length);
    expect(zone.value).toBe(construirePrompt(a, 'bulles', 'standard', GRAINE).texte);
  });

  it('sans presse-papiers du navigateur, retombe sur le même message', async () => {
    const avant = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    try {
      render(<AutresJeux activity={activitePilote()} profile="standard" graine={GRAINE} />);
      await userEvent.click(screen.getAllByRole('button', { name: /^Copier le prompt/ })[1]);
      expect(await screen.findByText(/La copie automatique n'a pas fonctionné/)).toBeTruthy();
    } finally {
      if (avant) Object.defineProperty(navigator, 'clipboard', avant);
      else delete (navigator as unknown as Record<string, unknown>).clipboard;
    }
  });

  it('télécharge le prompt en .txt avec un nom simplifié et le même texte', async () => {
    const telecharger = vi.fn();
    const a = activitePilote();
    render(<AutresJeux activity={a} profile="standard" graine={GRAINE} telecharger={telecharger} />);
    await userEvent.click(screen.getAllByRole('button', { name: /^Télécharger le prompt/ })[1]);
    expect(telecharger).toHaveBeenCalledTimes(1);
    const [nom, contenu] = telecharger.mock.calls[0];
    expect(nom).toBe('prompt-briques-les-positions-dans-l-espace.txt');
    expect(contenu).toBe(construirePrompt(a, 'briques', 'standard', GRAINE).texte);
  });

  it('explique pourquoi un mode manque quand l\'activité n\'a que des étapes', () => {
    const e = eauActivity();
    const a: Activity = { ...e, pairs: [], memberships: [] };
    render(<AutresJeux activity={a} profile="standard" graine={GRAINE} />);
    expect(screen.queryAllByRole('button', { name: /prompt/i })).toHaveLength(0);
    expect(screen.getByText('Il faut au moins deux familles et trois éléments (jeu Trier).')).toBeTruthy();
    expect(screen.getByText('Il faut des familles (Trier) ou des paires (Associer).')).toBeTruthy();
  });

  it('affiche l\'avertissement, la liste de vérification et la mention du compte', () => {
    render(<AutresJeux activity={activitePilote()} profile="standard" graine={GRAINE} />);
    expect(screen.getByText('Ce jeu est fabriqué par votre IA, pas par GameActif : vérifiez-le avant de le donner aux élèves.')).toBeTruthy();
    for (const v of VERIFICATION) expect(screen.getByText(v)).toBeTruthy();
    expect(screen.getByText('Vous avez besoin de votre propre compte Claude. Rien n\'est envoyé par GameActif.')).toBeTruthy();
  });

  it('ajoute le contexte facultatif au prompt copié, sans l’enregistrer', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    const a = activitePilote();
    render(<AutresJeux activity={a} profile="standard" graine={GRAINE} copier={copier} />);
    await userEvent.type(screen.getByLabelText('Votre contexte (facultatif)'), 'Classe de 4e, élèves aimant les animaux');
    await userEvent.click(screen.getAllByRole('button', { name: /^Copier le prompt/ })[0]);
    expect(copier).toHaveBeenCalledWith(construirePrompt(a, 'bulles', 'standard', GRAINE, 'Classe de 4e, élèves aimant les animaux').texte);
    expect(copier.mock.calls[0][0]).toContain('Classe de 4e, élèves aimant les animaux');
  });

  it('montre les étapes numérotées', () => {
    render(<AutresJeux activity={activitePilote()} profile="standard" graine={GRAINE} />);
    const liste = screen.getAllByRole('list', { name: /Étapes/ })[0];
    expect(within(liste).getAllByRole('listitem')).toHaveLength(4);
    expect(within(liste).getByText(/Mets ce jeu dans un fichier HTML à télécharger/)).toBeTruthy();
  });

  it('montre un élément piégé comme du texte et ne crée aucune balise script, sans réseau', () => {
    const fetchEspion = vi.spyOn(globalThis, 'fetch');
    const a = activitePilote();
    const b = { ...a, items: a.items.map((i) => (i.id === 'a-int' ? { ...i, text: '<script>alert(1)</script>' } : i)) };
    const { container } = render(<AutresJeux activity={b} profile="defi" graine={GRAINE} />);
    const zones = screen.getAllByLabelText(/^Prompt : /) as HTMLTextAreaElement[];
    expect(zones.some((z) => z.value.includes('<script>alert(1)</script>'))).toBe(true);
    expect(container.querySelector('script')).toBeNull();
    expect(fetchEspion).not.toHaveBeenCalled();
    fetchEspion.mockRestore();
  });
});
