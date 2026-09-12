import { parseLine } from './adapters.ts';
import { appendEvent, createIndex, finishIndex } from './index.ts';

export async function readStream(stream: ReadableStream<Uint8Array>, progress?: (count: number) => void) {
  const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }), index = createIndex();
  let remainder = '', lineNumber = 0;
  const consume = (line: string) => {
    lineNumber++;
    if (!line.trim()) return;
    try { appendEvent(index, parseLine(line)); }
    catch (error) { throw new Error(`Line ${lineNumber}: ${error instanceof Error ? error.message : error}`); }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      remainder += decoder.decode(value, { stream: !done });
      let newline;
      while ((newline = remainder.indexOf('\n')) !== -1) {
        consume(remainder.slice(0, newline)); remainder = remainder.slice(newline + 1);
      }
      progress?.(index.eventCount);
      if (done) break;
    }
    if (remainder.trim()) consume(remainder);
    if (!index.eventCount) throw new Error('The event stream is empty');
    return finishIndex(index);
  } finally { reader.releaseLock(); }
}
