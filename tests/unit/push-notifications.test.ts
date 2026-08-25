import { describe, expect, it } from 'vitest';
import { buildSopPushMessages } from '@/lib/growlog/push-notifications';

describe('buildSopPushMessages', () => {
  it('builds one message per token with deep link payload', () => {
    const messages = buildSopPushMessages({
      tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
      sopRunId: 'run-1',
      farmId: 'farm-1',
      cycleId: 'cycle-1',
      title: 'SOP overdue',
      body: 'Morning check is overdue',
      eventType: 'sop_overdue',
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].to).toBe('ExponentPushToken[a]');
    expect(messages[0].data).toEqual({
      type: 'sop_overdue',
      sopRunId: 'run-1',
      farmId: 'farm-1',
      cycleId: 'cycle-1',
    });
    expect(messages[1].body).toBe('Morning check is overdue');
  });
});
