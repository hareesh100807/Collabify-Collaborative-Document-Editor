import assert from "node:assert/strict";
import test from "node:test";
import { filterDuplicateVersions, getContentSignature } from "../utils/versionHistory.js";

test("content signatures are stable for equivalent content", () => {
  const content = { ops: [{ insert: "Hello\n" }] };
  assert.equal(getContentSignature(content), getContentSignature(content));
});

test("consecutive duplicate versions are filtered", () => {
  const versions = [
    { _id: "3", content: { ops: [{ insert: "New" }] } },
    { _id: "2", content: { ops: [{ insert: "New" }] } },
    { _id: "1", content: { ops: [{ insert: "Old" }] } },
  ];

  assert.deepEqual(
    filterDuplicateVersions(versions).map((version) => version._id),
    ["3", "1"]
  );
});
