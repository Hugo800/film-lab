import { describe, expect, it } from 'vitest';
import { encodeErrorMessage } from './encode';

describe('encodeErrorMessage', () => {
  it.each(['Aborted(OOM). Build with -sASSERTIONS', 'Cannot enlarge memory arrays to size 1073741824', 'RuntimeError: memory access out of bounds', 'RangeError: Array buffer allocation failed'])(
    'übersetzt Speichermangel: %s',
    (raw) => {
      expect(encodeErrorMessage(raw)).toBe('Das Foto ist zu groß für den Export in diesem Browser.');
    },
  );
  it('lässt andere Fehler mit Präfix durch', () => {
    expect(encodeErrorMessage('Worker konnte nicht starten')).toBe('JPEG-Kodierung fehlgeschlagen: Worker konnte nicht starten');
  });
});
