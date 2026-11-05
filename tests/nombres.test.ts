import { describe, it, expect } from 'vitest';
import { parseNombre, symboleJuste } from '../src/engine/nombres.js';

describe('parseNombre', () => {
  it('lit entiers, décimaux, fractions et négatifs', () => {
    expect(parseNombre('12')).toBe(12);
    expect(parseNombre(' 7 ')).toBe(7);
    expect(parseNombre('3,5')).toBe(3.5);
    expect(parseNombre('3.5')).toBe(3.5);
    expect(parseNombre('3/4')).toBe(0.75);
    expect(parseNombre('-2')).toBe(-2);
  });

  it('refuse ce qui n’est pas un nombre', () => {
    for (const t of ['', 'abc', '1/0', '1,2,3', '3/', '/4', '1 2']) expect(parseNombre(t)).toBeNull();
  });
});

describe('symboleJuste', () => {
  it('compare deux nombres', () => {
    expect(symboleJuste(12, 8)).toBe('>');
    expect(symboleJuste(7, 9)).toBe('<');
    expect(symboleJuste(parseNombre('0,5') as number, parseNombre('1/2') as number)).toBe('=');
    expect(symboleJuste(parseNombre('2/6') as number, parseNombre('1/3') as number)).toBe('=');
  });
});
