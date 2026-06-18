export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

export const getDocumentContentSize = (content) =>
  Buffer.byteLength(JSON.stringify(content ?? null), "utf8");

export const isDocumentContentTooLarge = (content) =>
  getDocumentContentSize(content) > MAX_DOCUMENT_BYTES;
