import type { ReminderMessage, ReminderScheduler } from '@/src/application/reminder-service';

type AlarmApi = {
  create(name: string, info: { when: string }): Promise<void> | void;
  clear(name: string): Promise<boolean> | boolean;
  onAlarm: { addListener(listener: (alarm: { name: string }) => void): void; removeListener?(listener: (alarm: { name: string }) => void): void };
};

type NotificationApi = {
  create(id: string, options: { type: 'basic'; title: string; message: string }): Promise<unknown> | unknown;
};

function browserApis(): { alarms?: AlarmApi; notifications?: NotificationApi } {
  return browser as unknown as { alarms?: AlarmApi; notifications?: NotificationApi };
}

export const browserReminderScheduler: ReminderScheduler = {
  async schedule(id, when) {
    await browserApis().alarms?.create(id, { when });
  },
  async cancel(id) {
    await browserApis().alarms?.clear(id);
  },
  async notify(message: ReminderMessage) {
    await browserApis().notifications?.create(message.id, {
      type: 'basic',
      title: message.title,
      message: message.body,
    });
  },
  onAlarm(listener) {
    const alarms = browserApis().alarms;
    alarms?.onAlarm.addListener(listener);
    return () => alarms?.onAlarm.removeListener?.(listener);
  },
};
