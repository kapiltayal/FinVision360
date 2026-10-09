import type { TransactionImportEvent } from "@shared/transaction-import";

export async function readTransactionImportStream(
  response: Response,
  onEvent: (event: TransactionImportEvent) => void,
) {
  if (!response.body) throw new Error("The preview response could not be read. Please try again.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event: TransactionImportEvent;
    try {
      event = JSON.parse(trimmed) as TransactionImportEvent;
    } catch {
      throw new Error("The preview returned an unreadable update. Please try again.");
    }
    if ("error" in event) throw new Error(event.error);
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
  } finally {
    reader.releaseLock();
  }
}

export function createImportRequestId(cryptoApi: Crypto = globalThis.crypto): string {
  if (typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
