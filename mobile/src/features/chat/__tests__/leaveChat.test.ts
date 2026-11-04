import { canLeaveChat } from '../leaveChat';

describe('canLeaveChat', () => {
  it('needs Going and an open chat', () => {
    expect(canLeaveChat('going', true)).toBe(true);
    expect(canLeaveChat('going', false)).toBe(false);
    expect(canLeaveChat('interested', true)).toBe(false);
    expect(canLeaveChat(null, true)).toBe(false);
  });
});
