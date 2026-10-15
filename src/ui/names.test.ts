import { describe, expect, it } from 'vitest';
import { exportNames } from './names';

describe('exportNames', () => {
  it('hängt _filmlab.jpg an und entfernt die Endung', () => {
    expect(exportNames(['DSC01603.JPEG', 'a.b.arw'])).toEqual(['DSC01603_filmlab.jpg', 'a.b_filmlab.jpg']);
  });
  it('macht doppelte Namen eindeutig', () => {
    expect(exportNames(['x.jpg', 'x.png', 'X.heic'])).toEqual(['x_filmlab.jpg', 'x_filmlab-2.jpg', 'X_filmlab-3.jpg']);
  });
  it('kommt ohne Endung und mit leerem Namen zurecht', () => {
    expect(exportNames(['bild', ''])).toEqual(['bild_filmlab.jpg', 'foto_filmlab.jpg']);
  });
});
