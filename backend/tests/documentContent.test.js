import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_DOCUMENT_BYTES,
  getDocumentContentSize,
  isDocumentContentTooLarge,
} from "../utils/documentContent.js";

test("document content size is measured from serialized JSON", () => {
  const content = { ops: [{ insert: "Hello" }] };
  assert.equal(getDocumentContentSize(content), Buffer.byteLength(JSON.stringify(content)));
});

test("document content below the limit is accepted", () => {
  assert.equal(isDocumentContentTooLarge({ ops: [{ insert: "Small document" }] }), false);
});

test("document content above the limit is rejected", () => {
  const content = { data: "x".repeat(MAX_DOCUMENT_BYTES) };
  assert.equal(isDocumentContentTooLarge(content), true);
});
