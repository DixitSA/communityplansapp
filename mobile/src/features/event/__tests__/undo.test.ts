import { shortTitle, undoMessage } from '../plansLogic';
import { useUndoStore } from '../undoStore';

describe('undoMessage', () => {
  it('offers undo when a plan is removed', () => {
    expect(undoMessage('interested', null, 'Jazz Night')).toBe('Removed from your plans');
    expect(undoMessage('down_if_friends', null, 'Jazz Night')).toBe('Removed from your plans');
  });
  it('warns about chat when leaving Going, cleared or not', () => {
    const msg = 'You left Jazz Night. Chat access removed.';
    expect(undoMessage('going', null, 'Jazz Night')).toBe(msg);
    expect(undoMessage('going', 'interested', 'Jazz Night')).toBe(msg);
  });
  it('stays quiet when adding or upgrading a plan', () => {
    expect(undoMessage(null, 'interested', 'x')).toBeNull();
    expect(undoMessage(null, 'going', 'x')).toBeNull();
    expect(undoMessage('interested', 'going', 'x')).toBeNull();
    expect(undoMessage('interested', 'down_if_friends', 'x')).toBeNull();
    expect(undoMessage('going', 'going', 'x')).toBeNull();
  });
  it('shortens long titles on a word edge', () => {
    expect(shortTitle('Charlotte Summer Food Truck Festival')).toBe('Charlotte Summer Food…');
    expect(shortTitle('Jazz')).toBe('Jazz');
  });
});

describe('undoStore', () => {
  it('shows and dismisses one toast', () => {
    useUndoStore.getState().showUndo({ message: 'a', onUndo: () => {} });
    expect(useUndoStore.getState().toast?.message).toBe('a');
    useUndoStore.getState().dismiss();
    expect(useUndoStore.getState().toast).toBeNull();
  });
});
