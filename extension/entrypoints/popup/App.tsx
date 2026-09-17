import { saveJob } from '@/src/lib/db';
import { useState } from 'react';

import { PopupFooter } from '@/src/components/PopupFooter';
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const handleClipJob = async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;
    try {
      const response = await browser.tabs.sendMessage(tab.id, {
        action: 'clip-job',
      });
      if (response?.job) {
        await saveJob({
          ...response.job,
          column: 'to_apply',
          status: 'active',
        });
      } else {
        alert(
          'Could not detect a job on this page. Make sure you are on a LinkedIn or Indeed job posting.',
        );
      }
    } catch {
      alert(
        'Could not detect a job on this page. Make sure you are on a LinkedIn or Indeed job posting.',
      );
    }
  };
  return (
    <>
      <PopupFooter onClipJob={handleClipJob} />
    </>
  );
}

export default App;
