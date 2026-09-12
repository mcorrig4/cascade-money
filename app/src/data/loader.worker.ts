/// <reference lib="webworker" />
import { readStream } from './ndjson.ts';
self.onmessage = async (message: MessageEvent<{ url: string }>) => {
  try {
    const response = await fetch(message.data.url);
    if (!response.ok || !response.body) throw new Error(`Could not load events (${response.status})`);
    const index = await readStream(response.body, count => self.postMessage({ type: 'progress', count }));
    self.postMessage({ type: 'ready', index });
  } catch (error) { self.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) }); }
};
