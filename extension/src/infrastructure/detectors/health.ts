import type { DetectorHealth } from '@/src/types/job';
import { getPlatformForHost, SUPPORTED_MATCH_PATTERNS } from '@/src/lib/detectors/registry';
import { isRecord } from '@/src/domain/shared';

function isDetectorHealth(value: unknown): value is DetectorHealth {
  return isRecord(value)
    && typeof value.tabId === 'number'
    && typeof value.url === 'string'
    && typeof value.state === 'string'
    && typeof value.strategy === 'string'
    && typeof value.confidence === 'number'
    && Array.isArray(value.warnings);
}

export async function getDetectorHealth(): Promise<DetectorHealth[]> {
  const tabs = await browser.tabs.query({ url: SUPPORTED_MATCH_PATTERNS });
  return Promise.all(tabs.flatMap((tab) => {
    if (tab.id === undefined || !tab.url) return [];
    let hostname = '';
    try {
      hostname = new URL(tab.url).hostname;
    } catch {
      return [];
    }
    const platform = getPlatformForHost(hostname);
    const fallback: DetectorHealth = {
      tabId: tab.id,
      url: tab.url,
      source: platform?.source || 'other',
      label: platform?.label || 'Supported page',
      state: 'unrecognized',
      strategy: 'content-script-unavailable',
      confidence: 0,
      warnings: ['The detector did not respond on this tab. Reload the page and try again.'],
    };
    return [browser.tabs.sendMessage(tab.id, { action: 'detector-health' })
      .then((value) => isDetectorHealth(value) ? value : fallback)
      .catch(() => fallback)];
  }));
}
