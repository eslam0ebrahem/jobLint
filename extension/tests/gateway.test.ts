import { describe, expect, it, vi } from 'vitest';
import { isGatewayRequest } from '@/src/lib/messages';
import { sendGatewayRequest, subscribeGateway } from '@/src/lib/gateway';

describe('typed gateway contract', () => {
  it('accepts known requests and rejects malformed messages', () => {
    expect(isGatewayRequest({ action: 'list-jobs' })).toBe(true);
    expect(isGatewayRequest({ action: 'get-extension-diagnostics' })).toBe(true);
    expect(isGatewayRequest({ action: 'scan-discovery-jobs' })).toBe(true);
    expect(isGatewayRequest({ action: 'list-discovery' })).toBe(true);
    expect(isGatewayRequest({ action: 'save-discovery', id: 'discovery-1' })).toBe(true);
    expect(isGatewayRequest({ action: 'create-follow-up', jobId: 'job-1', title: 'Call recruiter', dueAt: '2099-01-01' })).toBe(true);
    expect(isGatewayRequest({ action: 'complete-follow-up', id: 'follow-up-1' })).toBe(true);
    expect(isGatewayRequest({ action: 'get-application-packet', id: 'job-1' })).toBe(true);
    expect(isGatewayRequest({ action: 'get-outcome-analytics' })).toBe(true);
    expect(isGatewayRequest({ action: 'dismiss-discovery' })).toBe(false);
    expect(isGatewayRequest({ action: 'clip-job', job: { source: 'linkedin', title: 'Engineer', company: 'Acme' } })).toBe(true);
    expect(isGatewayRequest({ action: 'move-job', id: 'job-1', column: 'applied' })).toBe(true);
    expect(isGatewayRequest({ action: 'move-job', id: 'job-1', column: 'not-a-column' })).toBe(true);
    expect(isGatewayRequest({ action: 'delete-job' })).toBe(false);
    expect(isGatewayRequest({ action: 'clip-job', job: { source: 'linkedin' } })).toBe(false);
  });

  it('unwraps successful responses and surfaces background errors', async () => {
    const sendMessage = browser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValueOnce({ ok: true, data: [{ id: 'job-1' }] });
    await expect(sendGatewayRequest({ action: 'list-jobs' })).resolves.toEqual([{ id: 'job-1' }]);
    sendMessage.mockResolvedValueOnce({ ok: false, error: 'Database unavailable' });
    await expect(sendGatewayRequest({ action: 'list-jobs' })).rejects.toThrow('Database unavailable');
  });

  it('subscribes to and unsubscribes from runtime events', () => {
    const listeners: ((message: unknown) => void)[] = [];
    const add = browser.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>;
    const remove = browser.runtime.onMessage.removeListener as unknown as ReturnType<typeof vi.fn>;
    add.mockImplementation((listener: (message: unknown) => void) => { listeners.push(listener); });
    const received: unknown[] = [];
    const unsubscribe = subscribeGateway((event) => received.push(event));
    listeners[0]?.({ event: { type: 'jobs-changed', reason: 'test' } });
    unsubscribe();
    expect(received).toEqual([{ type: 'jobs-changed', reason: 'test' }]);
    expect(remove).toHaveBeenCalled();
  });
});
