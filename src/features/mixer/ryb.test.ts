import { describe, expect, it } from 'vitest';
import { mixPaints, nameColour } from './ryb';

const p = (o: Partial<Record<'red' | 'yellow' | 'blue' | 'white' | 'black', number>>) => ({ red: 0, yellow: 0, blue: 0, white: 0, black: 0, ...o });

describe('mixPaints', () => {
  it('gult + blått = grønt (ikke grått som i v1)', () => {
    expect(nameColour(mixPaints(p({ yellow: 1, blue: 1 })), 'no')).toBe('grønn');
  });
  it('rødt + gult = oransje', () => {
    expect(nameColour(mixPaints(p({ red: 1, yellow: 1 })), 'no')).toBe('oransje');
  });
  it('rødt + blått = lilla', () => {
    expect(nameColour(mixPaints(p({ red: 1, blue: 1 })), 'no')).toBe('lilla');
  });
  it('ingenting = hvitt', () => {
    expect(mixPaints(p({}))).toBe('#ffffff');
  });
  it('svart gjør mørkere', () => {
    const light = parseInt(mixPaints(p({ red: 1 })).slice(1, 3), 16);
    const dark = parseInt(mixPaints(p({ red: 1, black: 1 })).slice(1, 3), 16);
    expect(dark).toBeLessThan(light);
  });
});
