import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveParams, type EffectiveParams } from '../engine/plan';
import { LOOKS } from '../looks';
import { DEFAULT_PARAMS } from '../types';
import { NONE_ID, recipeDefaultsOf, withLookDefaults } from './lookRegistry';
import type { UserPreset } from './storage';
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

describe('Eingefügte und eigene Rezepte: Stärke misst an deren Vorgaben', () => {
  const portra = LOOKS.find((l) => l.id === 'kodak-portra-400')!.defaults;
  const active = () => useStore.getState().photos.find((p) => p.id === useStore.getState().activeId)!.settings;
  const effective = (s = active()) => effectiveParams(withLookDefaults(s.lookId, s.params, s.recipeDefaults));
  const neutral = (e: EffectiveParams) => {
    const { strength: _s, grainSize: _g, leakSeed: _l, ...rest } = e;
    return rest;
  };
  const ORIGINAL = neutral(effectiveParams(DEFAULT_PARAMS));

  it('eingefügtes Rezept auf Fuji-Basis: 0 % = Original, Zurücksetzen = Rezept, Look-Wechsel vergisst es', () => {
    useStore.getState().applyRecipe('classic-chrome', portra);
    useStore.getState().setParam('strength', 0);
    const e = effective();
    expect(neutral({ ...e, wbKelvin: 0 })).toEqual(ORIGINAL);
    expect([0, 5500]).toContain(e.wbKelvin);
    useStore.getState().setParam('color', 4);
    useStore.getState().resetAll();
    expect(active().params.color).toBe(portra.color);
    expect(active().params.strength).toBe(1);
    useStore.getState().setLook('velvia');
    expect(active().recipeDefaults).toBeUndefined();
  });

  it('eigenes Rezept (Preset): 0 % = Original, auch als Kachel und nach „auf alle“', () => {
    const preset: UserPreset = { id: 'preset:x', name: 'X', lookId: 'kodak-portra-400', params: { ...DEFAULT_PARAMS, ...portra, color: 4, strength: 0 } };
    useStore.getState().applyPreset(preset);
    expect(neutral({ ...effective(), wbKelvin: 0 })).toEqual(ORIGINAL);
    const tile = effectiveParams(withLookDefaults(preset.lookId, preset.params, recipeDefaultsOf(preset.params)));
    expect(neutral({ ...tile, wbKelvin: 0 })).toEqual(ORIGINAL);
    useStore.getState().applyToAll();
    for (const p of useStore.getState().photos) expect(neutral({ ...effective(p.settings), wbKelvin: 0 })).toEqual(ORIGINAL);
    // Zurücksetzen der Stärke → 50 %, der Rest bleibt beim Rezept.
    useStore.getState().resetParam('strength');
    expect(active().params.strength).toBe(1);
    expect(effective().color).toBe(4);
  });
});
