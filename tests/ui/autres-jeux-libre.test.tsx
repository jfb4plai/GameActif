// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { activitePilote } from '../../src/data/pilote.js';
import type { Activity } from '../../src/engine/types.js';
import { construirePromptLibre, VERIFICATION_LIBRE } from '../../src/prompts/construire.js';
import { AutresJeux } from '../../src/ui/AutresJeux.js';

afterEach(() => cleanup());

const GRAINE = 11;
const CASE = 'Je relirai le contenu et le corrigé avant de le donner aux élèves.';
const avecContexte = (context: string): Activity => ({ ...activitePilote(), context });
const copierBtn = () => screen.getByRole('button', { name: 'Copier le prompt : Libre' }) as HTMLButtonElement;
const telechargerBtn = () => screen.getByRole('button', { name: 'Télécharger le prompt (.txt) : Libre' }) as HTMLButtonElement;
const champ = () => screen.getByRole('textbox', { name: 'Votre contexte de classe' }) as HTMLTextAreaElement;
const cocher = () => userEvent.click(screen.getByRole('checkbox', { name: CASE }));

describe('AutresJeux, carte Libre', () => {
  it('propose la carte Libre avec ses deux boutons, inactifs tant que la case n’est pas cochée', async () => {
    render(<AutresJeux activity={activitePilote()} profile="standard" graine={GRAINE} />);
    expect(screen.getByRole('heading', { name: "Libre : l'IA choisit le jeu" })).toBeTruthy();
    expect(copierBtn().disabled).toBe(true);
    expect(telechargerBtn().disabled).toBe(true);
    await cocher();
    expect(copierBtn().disabled).toBe(false);
    expect(telechargerBtn().disabled).toBe(false);
  });

  it('le champ est prérempli avec le contexte de l’activité, modifiable, avec exemple et aide', async () => {
    const a = activitePilote();
    render(<AutresJeux activity={a} profile="standard" graine={GRAINE} />);
    expect(champ().value).toBe(a.context.slice(0, 500));
    expect(champ().placeholder).toContain('Exemple : 18 élèves de 4e primaire');
    const aide = document.getElementById(champ().getAttribute('aria-describedby') as string) as HTMLElement;
    expect(aide.textContent).toContain('aucun nom d’élève');
    await userEvent.type(champ(), ' Ajout.');
    expect(champ().value.endsWith(' Ajout.')).toBe(true);
  });

  it('un contexte de plus de 500 caractères avec retours à la ligne est coupé et signalé (Review Focus 2)', async () => {
    const long = Array.from({ length: 200 }, (_, i) => `ligne ${i}`).join('\n');
    render(<AutresJeux activity={avecContexte(long)} profile="standard" graine={GRAINE} />);
    expect(champ().value).toHaveLength(500);
    expect(screen.getByText('Votre contexte a été raccourci à 500 caractères.')).toBeTruthy();
    await cocher();
    expect(copierBtn().disabled).toBe(false);
  });

  it('copie exactement le texte du constructeur et le confirme', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    const a = activitePilote();
    render(<AutresJeux activity={a} profile="standard" graine={GRAINE} copier={copier} />);
    await cocher();
    await userEvent.click(copierBtn());
    expect(copier).toHaveBeenCalledWith(construirePromptLibre(a, 'standard', GRAINE, champ().value).texte);
    expect(await screen.findByText('Prompt copié.')).toBeTruthy();
  });

  it('télécharge le prompt en .txt avec un nom simplifié', async () => {
    const telecharger = vi.fn();
    const a = activitePilote();
    render(<AutresJeux activity={a} profile="standard" graine={GRAINE} telecharger={telecharger} />);
    await cocher();
    await userEvent.click(telechargerBtn());
    const [nom, contenu] = telecharger.mock.calls[0];
    expect(nom).toBe('prompt-libre-les-positions-dans-l-espace.txt');
    expect(contenu).toBe(construirePromptLibre(a, 'standard', GRAINE, champ().value).texte);
  });

  it('case décochée : rien n’est copié ni téléchargé, même au clavier (Review Focus 4)', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    const telecharger = vi.fn();
    render(<AutresJeux activity={activitePilote()} profile="standard" graine={GRAINE} copier={copier} telecharger={telecharger} />);
    await userEvent.click(copierBtn());
    await userEvent.click(telechargerBtn());
    screen.getByRole('checkbox', { name: CASE }).focus();
    await userEvent.keyboard('{Enter}');
    expect(copier).not.toHaveBeenCalled();
    expect(telecharger).not.toHaveBeenCalled();
    const raison = document.getElementById(copierBtn().getAttribute('aria-describedby') as string) as HTMLElement;
    expect(raison.textContent).toBe('Pour copier le prompt : écrire un contexte d’au moins 20 caractères et cocher la case de relecture.');
  });

  it('contexte trop court : rien n’est copié même case cochée (Review Focus 4)', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    render(<AutresJeux activity={avecContexte('court')} profile="standard" graine={GRAINE} copier={copier} />);
    await cocher();
    expect(copierBtn().disabled).toBe(true);
    await userEvent.click(copierBtn());
    expect(copier).not.toHaveBeenCalled();
    await userEvent.type(champ(), ' et un contexte maintenant assez long');
    expect(copierBtn().disabled).toBe(false);
  });

  it('change le texte copié quand le profil change', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    const a = activitePilote();
    const { rerender } = render(<AutresJeux activity={a} profile="soutien" graine={GRAINE} copier={copier} />);
    rerender(<AutresJeux activity={a} profile="defi" graine={GRAINE} copier={copier} />);
    await cocher();
    await userEvent.click(copierBtn());
    expect(copier).toHaveBeenCalledWith(construirePromptLibre(a, 'defi', GRAINE, champ().value).texte);
  });

  it('quand la copie échoue, le dit, ouvre l’aperçu et sélectionne son contenu', async () => {
    const copier = vi.fn().mockRejectedValue(new Error('refusé'));
    const a = activitePilote();
    render(<AutresJeux activity={a} profile="standard" graine={GRAINE} copier={copier} />);
    await cocher();
    await userEvent.click(copierBtn());
    expect(await screen.findByText("La copie automatique n'a pas fonctionné. Sélectionnez le texte ci-dessous et copiez-le.")).toBeTruthy();
    const zone = screen.getByLabelText('Prompt : Libre') as HTMLTextAreaElement;
    await waitFor(() => expect((zone.closest('details') as HTMLDetailsElement).open).toBe(true));
    expect(zone.selectionEnd).toBe(zone.value.length);
    expect(zone.value).toBe(construirePromptLibre(a, 'standard', GRAINE, champ().value).texte);
  });

  it('affiche les étapes et les vérifications propres au mode Libre', () => {
    render(<AutresJeux activity={activitePilote()} profile="standard" graine={GRAINE} />);
    expect(screen.getByRole('list', { name: 'Étapes : Libre' })).toBeTruthy();
    for (const v of VERIFICATION_LIBRE) expect(screen.getByText(v)).toBeTruthy();
  });
});
