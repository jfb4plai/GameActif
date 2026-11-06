// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CodeQr } from '../../src/ui/CodeQr';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CodeQr', () => {
  it('dessine un QR code en SVG, avec une étiquette qui cite le libellé', () => {
    render(<CodeQr lien="https://gameactif.jfb4plai.com/?activite=K7M2XQ9A" libelle="Activité Les positions" />);
    const svg = screen.getByRole('img', { name: /Activité Les positions/ });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    const [, , largeur, hauteur] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(largeur).toBe(hauteur);
    // 21 modules au minimum, plus la zone de silence de 4 modules de chaque côté.
    expect(largeur).toBeGreaterThanOrEqual(21 + 8);
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(40);
  });

  it('est déterministe : le même lien donne le même dessin', () => {
    const { container: a } = render(<CodeQr lien="https://x.be/?activite=K7M2XQ9A" libelle="a" />);
    const premier = a.innerHTML;
    cleanup();
    const { container: b } = render(<CodeQr lien="https://x.be/?activite=K7M2XQ9A" libelle="a" />);
    expect(b.innerHTML).toBe(premier);
  });

  it('deux liens différents donnent deux dessins différents', () => {
    const { container: a } = render(<CodeQr lien="https://x.be/?activite=K7M2XQ9A" libelle="a" />);
    const premier = a.innerHTML;
    cleanup();
    const { container: b } = render(<CodeQr lien="https://x.be/?activite=K7M2XQ9B&g=1" libelle="a" />);
    expect(b.innerHTML).not.toBe(premier);
  });

  it('dessine en noir sur blanc (contraste maximal)', () => {
    const { container } = render(<CodeQr lien="https://x.be/?activite=K7M2XQ9A" libelle="a" />);
    const fonds = [...container.querySelectorAll('rect')].map((r) => r.getAttribute('fill'));
    expect(fonds).toContain('#fff');
    expect(fonds).toContain('#000');
  });

  it('n’appelle aucun service externe', () => {
    const fetchEspion = vi.fn();
    vi.stubGlobal('fetch', fetchEspion);
    render(<CodeQr lien="https://x.be/?activite=K7M2XQ9A" libelle="a" />);
    expect(fetchEspion).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('un lien trop long pour un QR affiche un message, sans planter', () => {
    render(<CodeQr lien={`https://x.be/?${'a'.repeat(5000)}`} libelle="trop long" />);
    expect(screen.getByRole('alert').textContent).toMatch(/trop long/);
  });
});
