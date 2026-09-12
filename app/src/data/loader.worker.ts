/// <reference lib="webworker" />
import { readStream } from './ndjson.ts';
import { handoff } from './handoff.ts';
let acknowledge: (() => void) | undefined;
self.onmessage = async (message: MessageEvent<{ url?: string; type?: string }>) => {
  if (message.data.type === 'ack') { acknowledge?.(); acknowledge = undefined; return; }
  try {
    const response = await fetch(message.data.url!);
    if (!response.ok || !response.body) throw new Error(`Could not load events (${response.status})`);
    const index = await readStream(response.body);
    await handoff(index, header => self.postMessage({ type: 'header', header }), (n, bucket) => new Promise<void>(resolve => {
      acknowledge = resolve; self.postMessage({ type: 'day', n, bucket });
    }));
    self.postMessage({ type: 'ready' }); self.close();
  } catch (error) { self.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) }); self.close(); }
};
