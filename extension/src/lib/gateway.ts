import type { GatewayAction, GatewayData, GatewayEvent, GatewayRequest, GatewayResponse } from './messages';

export async function sendGatewayRequest<K extends GatewayAction>(
  request: Extract<GatewayRequest, { action: K }>,
): Promise<GatewayData[K]> {
  const response = await browser.runtime.sendMessage({ request }) as GatewayResponse<GatewayData[K]>;
  if (!response?.ok) throw new Error(response?.error || 'The extension background did not respond.');
  return response.data;
}

export function subscribeGateway(listener: (event: GatewayEvent) => void): () => void {
  const handler = (message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const candidate = message as { event?: GatewayEvent };
    if (candidate.event) listener(candidate.event);
  };
  browser.runtime.onMessage.addListener(handler);
  return () => browser.runtime.onMessage.removeListener(handler);
}

