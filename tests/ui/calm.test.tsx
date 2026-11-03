// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalmProvider, CalmToggle, useCalm } from '../../src/ui/CalmContext';
import { useSpeech } from '../../src/ui/useSpeech';

function stubMatchMedia(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  document.body.className = '';
});
afterEach(() => cleanup());

describe('mode calme', () => {
  it('est désactivé sans préférence système', () => {
    stubMatchMedia(false);
    render(<CalmProvider><CalmToggle /></CalmProvider>);
    expect(screen.getByRole('button', { name: 'Mode calme : désactivé' })).toBeTruthy();
    expect(document.body.classList.contains('calme')).toBe(false);
  });

  it('est activé au départ quand le système demande moins d’animations', () => {
    stubMatchMedia(true);
    render(<CalmProvider><CalmToggle /></CalmProvider>);
    expect(screen.getByRole('button', { name: 'Mode calme : activé' })).toBeTruthy();
    expect(document.body.classList.contains('calme')).toBe(true);
  });

  it('le bouton ajoute puis retire la classe calme sur le corps de la page', async () => {
    stubMatchMedia(false);
    render(<CalmProvider><CalmToggle /></CalmProvider>);
    const bouton = screen.getByRole('button');
    await userEvent.click(bouton);
    expect(document.body.classList.contains('calme')).toBe(true);
    expect(bouton.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(bouton);
    expect(document.body.classList.contains('calme')).toBe(false);
  });

  it('useCalm donne l’état et un réglage', async () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useCalm(), { wrapper: CalmProvider });
    expect(result.current.calm).toBe(false);
  });
});

describe('useSpeech', () => {
  it('n’est pas disponible sans speechSynthesis et speak ne lève pas d’exception', () => {
    const { result } = renderHook(() => useSpeech());
    expect('speechSynthesis' in window).toBe(false);
    expect(result.current.available).toBe(false);
    expect(() => result.current.speak('Pose le chat sur la table.')).not.toThrow();
  });
});
