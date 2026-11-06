// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuiJoue } from '../../src/ui/QuiJoue';

afterEach(() => cleanup());

describe('QuiJoue, avec une classe associée', () => {
  it('propose « Jouer sans enregistrer » puis exactement les codes de la classe, et part sans code', () => {
    render(<QuiJoue classe={{ code: 'ABCD2345', nbCodes: 3 }} valeur="" onChange={() => {}} onAssocier={async () => null} />);
    const liste = screen.getByLabelText('Qui joue ?') as HTMLSelectElement;
    expect([...liste.options].map((o) => o.textContent)).toEqual(['Jouer sans enregistrer', 'E01', 'E02', 'E03']);
    expect(liste.value).toBe('');
  });

  it('signale le code choisi', async () => {
    const onChange = vi.fn();
    render(<QuiJoue classe={{ code: 'ABCD2345', nbCodes: 3 }} valeur="" onChange={onChange} onAssocier={async () => null} />);
    await userEvent.selectOptions(screen.getByLabelText('Qui joue ?'), 'E02');
    expect(onChange).toHaveBeenCalledWith('E02');
  });

  it('explique que la liste revient sur « Jouer sans enregistrer » après le tour', () => {
    render(<QuiJoue classe={{ code: 'ABCD2345', nbCodes: 3 }} valeur="" onChange={() => {}} onAssocier={async () => null} />);
    expect(screen.getByText(/revient sur « Jouer sans enregistrer »/)).toBeTruthy();
  });

  it('permet de dissocier l’appareil quand une fonction est fournie', async () => {
    const onOublier = vi.fn();
    render(<QuiJoue classe={{ code: 'ABCD2345', nbCodes: 3 }} valeur="" onChange={() => {}} onAssocier={async () => null} onOublier={onOublier} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dissocier cet appareil' }));
    expect(onOublier).toHaveBeenCalled();
  });
});

describe('QuiJoue, sans classe associée', () => {
  it('n’affiche pas de liste mais un lien pour associer l’appareil à une classe', () => {
    render(<QuiJoue classe={null} valeur="" onChange={() => {}} onAssocier={async () => null} />);
    expect(screen.queryByLabelText('Qui joue ?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Associer cet appareil à une classe' })).toBeTruthy();
  });

  it('envoie le code saisi, en majuscules et sans espaces, et affiche l’erreur renvoyée', async () => {
    const onAssocier = vi.fn(async () => 'Ce code n’est pas reconnu.');
    render(<QuiJoue classe={null} valeur="" onChange={() => {}} onAssocier={onAssocier} />);
    await userEvent.click(screen.getByRole('button', { name: 'Associer cet appareil à une classe' }));
    await userEvent.type(screen.getByLabelText('Code de la classe'), ' abcd2345 ');
    await userEvent.click(screen.getByRole('button', { name: 'Associer' }));
    expect(onAssocier).toHaveBeenCalledWith('ABCD2345');
    expect((await screen.findByRole('alert')).textContent).toBe('Ce code n’est pas reconnu.');
  });

  it('donne un exemple et une aide sous le champ du code de classe', async () => {
    render(<QuiJoue classe={null} valeur="" onChange={() => {}} onAssocier={async () => null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Associer cet appareil à une classe' }));
    const champ = screen.getByLabelText('Code de la classe') as HTMLInputElement;
    expect(champ.placeholder).toMatch(/[A-Z0-9]{8}/);
    expect(screen.getByText(/Rien d’autre que votre code élève n’est envoyé/)).toBeTruthy();
  });
});
