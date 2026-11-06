// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AideEcran } from '../../src/ui/AideEcran';
import { AIDES } from '../../src/aide/aides.js';

afterEach(() => cleanup());

describe('AideEcran', () => {
  it('est un bloc replié dont le titre est « Comment utiliser cet écran », masqué à l’impression', () => {
    render(<AideEcran id="classes" />);
    const bloc = document.querySelector('details.aide-ecran') as HTMLDetailsElement;
    expect(bloc).toBeTruthy();
    expect(bloc.open).toBe(false);
    expect(bloc.classList.contains('hors-impression')).toBe(true);
    expect(bloc.querySelector('summary')?.textContent).toBe('Comment utiliser cet écran');
  });

  it('une fois ouvert, liste les puces du texte et la limite précédée de « Limite : »', async () => {
    render(<AideEcran id="classes" />);
    await userEvent.click(screen.getByText('Comment utiliser cet écran'));
    const items = document.querySelectorAll('details.aide-ecran li');
    expect([...items].map((li) => li.textContent)).toEqual(AIDES.classes.puces);
    expect(screen.getByText(`Limite : ${AIDES.classes.limite}`)).toBeTruthy();
  });

  it('une aide sans limite (élève) n’affiche aucun paragraphe de limite', () => {
    render(<AideEcran id="eleve" />);
    expect(document.body.textContent).not.toMatch(/Limite :/);
    expect(document.querySelectorAll('details.aide-ecran li')).toHaveLength(AIDES.eleve.puces.length);
  });
});
