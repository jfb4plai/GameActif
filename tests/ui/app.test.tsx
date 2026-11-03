// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';

describe('App', () => {
  it('affiche le titre GameActif et le logo PLAI sans le déformer', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'GameActif' })).toBeTruthy();
    const logo = screen.getByAltText('PLAI') as HTMLImageElement;
    expect(logo.style.height).toBe('32px');
    expect(logo.style.width).not.toBe('32px');
  });
});
