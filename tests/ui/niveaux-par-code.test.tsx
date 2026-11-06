// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NiveauxParCode } from '../../src/ui/NiveauxParCode';
import { magasinPartageMemoire, type PartageStore } from '../../src/partage/magasin.js';
import { ErreurStockage } from '../../src/compte/activites.js';
import type { ClasseLue } from '../../src/suivi/lecture.js';
import type { StockageLocal } from '../../src/compte/invitation.js';

afterEach(() => cleanup());

const classe: ClasseLue = { id: 'c1', label: 'P4 B', nbCodes: 24, classCode: 'ABCD2345', purgeLe: '2027-08-30', proprietaire: true };

function stockage(roster: Record<string, string> = {}): StockageLocal {
  const d = new Map<string, string>([['gameactif.roster.v1.c1', JSON.stringify(roster)]]);
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
}

function monter(roster: Record<string, string> = {}, partage: PartageStore = magasinPartageMemoire()) {
  const espions = { definir: vi.spyOn(partage, 'definirProfil'), retirer: vi.spyOn(partage, 'retirerProfil') };
  render(<NiveauxParCode classe={classe} partage={partage} stockage={stockage(roster)} />);
  return { espions, partage };
}
const champ = (nom: string) => screen.getByLabelText(nom) as HTMLSelectElement;

describe('NiveauxParCode', () => {
  it('propose un niveau par code, « Standard » par défaut', async () => {
    monter();
    await screen.findByLabelText('Niveau de E01');
    expect(screen.getAllByRole('combobox')).toHaveLength(24);
    expect(champ('Niveau de E07').value).toBe('standard');
  });

  it('rappelle que le choix est celui de l’enseignant, enregistré sous le code, et que l’élève ne voit pas le nom du niveau', async () => {
    monter();
    expect(await screen.findByText(/Ce choix est le vôtre/)).toBeTruthy();
    expect(screen.getByText(/sans prénom/)).toBeTruthy();
    expect(screen.getByText(/supprimé le .*2027/)).toBeTruthy();
    // La même phrase est aussi une puce du bloc d'aide : on vérifie le rappel placé hors du bloc.
    const hors = screen.getAllByText(/L’élève ne voit pas le nom de son niveau/).filter((e) => !e.closest('details.aide-ecran'));
    expect(hors).toHaveLength(1);
  });

  it('relit les niveaux déjà fixés', async () => {
    const partage = magasinPartageMemoire();
    await partage.definirProfil('c1', 'E07', 'defi');
    monter({}, partage);
    await screen.findByLabelText('Niveau de E01');
    expect(champ('Niveau de E07').value).toBe('defi');
  });

  it('fixer un niveau enregistre le code et le niveau, rien d’autre', async () => {
    const { espions } = monter({ E07: 'Léa' });
    fireEvent.change(await screen.findByLabelText('Niveau de Léa'), { target: { value: 'soutien' } });
    expect(espions.definir).toHaveBeenCalledWith('c1', 'E07', 'soutien');
    for (const appel of [...espions.definir.mock.calls, ...espions.retirer.mock.calls]) expect(JSON.stringify(appel)).not.toMatch(/Léa/);
  });

  it('remettre « Standard » retire le niveau fixé', async () => {
    const { espions } = monter();
    fireEvent.change(await screen.findByLabelText('Niveau de E07'), { target: { value: 'defi' } });
    fireEvent.change(screen.getByLabelText('Niveau de E07'), { target: { value: 'standard' } });
    expect(espions.retirer).toHaveBeenCalledWith('c1', 'E07');
  });

  it('affiche le prénom de la liste locale à la place du code', async () => {
    monter({ E07: 'Léa' });
    expect(await screen.findByLabelText('Niveau de Léa')).toBeTruthy();
    expect(screen.queryByLabelText('Niveau de E07')).toBeNull();
  });

  it('un enregistrement qui échoue affiche une alerte et rend le niveau précédent', async () => {
    const partage = magasinPartageMemoire();
    partage.definirProfil = vi.fn().mockRejectedValue(new ErreurStockage('reseau'));
    monter({}, partage);
    fireEvent.change(await screen.findByLabelText('Niveau de E07'), { target: { value: 'defi' } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/n’a pas abouti/);
    expect(champ('Niveau de E07').value).toBe('standard');
  });

  it('un chargement qui échoue affiche une alerte sans planter', async () => {
    const partage = magasinPartageMemoire();
    partage.profils = vi.fn().mockRejectedValue(new ErreurStockage('reseau'));
    monter({}, partage);
    expect((await screen.findByRole('alert')).textContent).toMatch(/n’ont pas pu être chargés/);
  });
});
