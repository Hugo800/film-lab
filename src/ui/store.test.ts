import { beforeEach, describe, expect, it } from 'vitest';
import { NONE_ID } from './lookRegistry';
import { useStore } from './store';

const file = (name: string) => new File([], name, { type: 'image/jpeg' });
const looks = () => useStore.getState().photos.map((p) => p.settings.lookId);

beforeEach(() => {
  useStore.setState({ photos: [], activeId: null, notice: null, undoState: null });
  useStore.getState().addFiles([file('a.jpg'), file('b.jpg')]);
});

describe('Rückgängig', () => {
  it('stellt ein entferntes Foto wieder her, solange die Meldung es anbietet', () => {
    const s = useStore.getState();
    s.removePhoto(s.photos[0].id);
    expect(useStore.getState().photos).toHaveLength(1);
    useStore.getState().undo();
    expect(useStore.getState().photos.map((p) => p.name)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('verfällt mit der geschlossenen Meldung und verwirft dann keine spätere Änderung', () => {
    const s = useStore.getState();
    s.removePhoto(s.photos[0].id);
    useStore.getState().setLook(NONE_ID);
    useStore.getState().dismissNotice();
    expect(useStore.getState().undoState).toBeNull();
    useStore.getState().undo();
    expect(looks()).toEqual([NONE_ID]);
  });

  it('verfällt, wenn eine Meldung ohne Rückgängig die alte ersetzt', () => {
    const s = useStore.getState();
    s.applyToAll();
    useStore.getState().notify('Rezept angewendet');
    expect(useStore.getState().undoState).toBeNull();
  });

  it('behält Filmstreifen-Bilder, die nach dem Merken fertig wurden', () => {
    const s = useStore.getState();
    s.applyToAll();
    const b = useStore.getState().photos[1].id;
    useStore.getState().setPhotoThumb(b, 'blob:fertig');
    useStore.getState().undo();
    expect(useStore.getState().photos[1].thumb).toBe('blob:fertig');
  });
});
