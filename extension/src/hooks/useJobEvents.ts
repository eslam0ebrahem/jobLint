import { useEffect, useState } from 'react';
import type { ApplicationEvent } from '@/src/types/job';
import { sendGatewayRequest } from '@/src/lib/gateway';

export function useJobEvents(jobId: string | undefined, refreshKey?: string) {
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }
    let active = true;
    setEventsLoading(true);
    sendGatewayRequest({ action: 'get-events', jobId })
      .then((nextEvents) => { if (active) setEvents(nextEvents); })
      .catch(() => { if (active) setEvents([]); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [jobId, refreshKey]);

  return { events, eventsLoading };
}
