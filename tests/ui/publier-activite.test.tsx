// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublierActivite } from '../../src/ui/PublierActivite';
import { magasinSuiviMemoire, type ClasseLue } from '../../src/suivi/lecture.js';
import { ErreurPartage, magasinPartageMemoire, type PartageStore } from '../../src/partage/magasin.js';
import { brouillonVide } from '../../src/atelier/brouillon.js';

afterEach(() => cleanup());

const ORIGINE = 'https://gameactif.jfb4plai.com';
const brouillon = () => ({ ...brouillonVide(), niveau: 'P4', matiere: 'mathematiques', cibles: ['M.P4.1.1.i1.a1'], titre: 'Les positions', contexte: 'Classe de Léa, 24 élèves' });
const classe: ClasseLue = { id: 'c1', label: 'P4 B', nbCodes: 24, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true };

function monter(classes: ClasseLue[] = [classe], partage: PartageStore = magasinPartageMemoire()) {
  const espions = { publier: vi.spyOn(partage, 'publier'), retirer: vi.spyOn(partage, 'retirer') };
  const copier = vi.fn(async () => {});
  render(<PublierActivite brouillon={brouillon()} suivi={magasinSuiviMemoire({ classes })} partage={partage} origine={ORIGINE} copier={copier} />);
  return { espions, copier, partage };
}
const proposer = async () => userEvent.click(await screen.findByRole('button', { name: 'Proposer à la classe' }));

describe('PublierActivite', () => {
  it('sans classe : renvoie vers « Mes classes », sans bouton de publication', async () => {
    monter([]);
    expect(await screen.findByText('Créez d’abord une classe dans Mes classes.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Proposer à la classe' })).toBeNull();
  });

  it('une classe seulement lue (personne invitée) ne compte pas', async () => {
    monter([{ ...classe, proprietaire: false }]);
    expect(await screen.findByText('Créez d’abord une classe dans Mes classes.')).toBeTruthy();
  });

  it('guide chaque champ : libellé, aide sur la portée', async () => {
    monter();
    await screen.findByRole('button', { name: 'Proposer à la classe' });
    for (const nom of ['Classe', 'Façon de décider du niveau', 'Niveau de départ']) {
      const champ = screen.getByLabelText(nom);
      const aide = document.getElementById(champ.getAttribute('aria-describedby') as string);
      expect(aide?.textContent?.trim().length, nom).toBeGreaterThan(20);
    }
  });

  it('publie en « même niveau » : lien, QR, copie et retrait', async () => {
    const { espions, copier } = monter();
    await proposer();
    expect(espions.publier).toHaveBeenCalledWith('c1', expect.objectContaining({ titre: 'Les positions' }), 'meme', 'standard', undefined);
    const code = await espions.publier.mock.results[0].value;
    const lien = `${ORIGINE}/?activite=${code}`;
    expect(await screen.findByText(lien)).toBeTruthy();
    expect(screen.getByRole('img', { name: /QR code/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Copier le lien' }));
    expect(copier).toHaveBeenCalledWith(lien);
    expect(await screen.findByText('Lien copié.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le lien' }));
    expect(espions.retirer).toHaveBeenCalledWith(code);
    expect(screen.queryByText(lien)).toBeNull();
  });

  it('« un lien par groupe » : trois liens aux couleurs neutres, jamais le mot « Soutien »', async () => {
    const { espions } = monter();
    fireEvent.change(await screen.findByLabelText('Façon de décider du niveau'), { target: { value: 'groupes' } });
    await proposer();
    const code = await espions.publier.mock.results[0].value;
    for (const [g, couleur] of [[1, 'vert'], [2, 'bleu'], [3, 'orange']] as const) {
      expect(await screen.findByText(`${ORIGINE}/?activite=${code}&g=${g}`)).toBeTruthy();
      expect(screen.getByText(new RegExp(`Groupe ${couleur}`))).toBeTruthy();
    }
    expect(screen.getAllByRole('img', { name: /QR code/ })).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(/Soutien/);
  });

  it('« niveau par code » : un lien, et le renvoi vers les niveaux par code dans Mes classes', async () => {
    const { espions } = monter();
    fireEvent.change(await screen.findByLabelText('Façon de décider du niveau'), { target: { value: 'par-code' } });
    await proposer();
    expect(espions.publier.mock.calls[0][2]).toBe('par-code');
    expect(await screen.findByText(/Niveaux par code/)).toBeTruthy();
  });

  it('republier garde le même lien', async () => {
    const { espions } = monter();
    await proposer();
    const code = await espions.publier.mock.results[0].value;
    await userEvent.click(await screen.findByRole('button', { name: 'Mettre à jour le lien' }));
    expect(espions.publier.mock.calls[1][4]).toBe(code);
    expect(await screen.findByText(`${ORIGINE}/?activite=${code}`)).toBeTruthy();
  });

  it('une erreur de publication affiche le message en français', async () => {
    const partage = magasinPartageMemoire();
    partage.publier = vi.fn().mockRejectedValue(new ErreurPartage('Vingt activités partagées au plus par classe : retirez-en une avant d’en proposer une nouvelle.'));
    monter([classe], partage);
    await proposer();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Vingt activités/);
  });

  it('ne montre jamais le contexte de classe du brouillon', async () => {
    monter();
    await proposer();
    await screen.findByRole('img', { name: /QR code/ });
    expect(document.body.textContent).not.toMatch(/Léa/);
  });

  it('liste les activités déjà proposées à la classe et permet d’en retirer une', async () => {
    const partage = magasinPartageMemoire();
    const code = await partage.publier('c1', brouillon(), 'meme', 'standard');
    const { espions } = monter([classe], partage);
    const liste = await screen.findByRole('list', { name: 'Activités déjà proposées' });
    expect(within(liste).getByText(new RegExp(code))).toBeTruthy();
    await userEvent.click(within(liste).getByRole('button', { name: /Retirer/ }));
    expect(espions.retirer).toHaveBeenCalledWith(code);
  });
});
