import assert from "node:assert/strict";
import test from "node:test";
import { isDocumentOwner } from "../controllers/versionController.js";

test("document owner is allowed to restore a version", () => {
  const document = { owner: "owner-id" };
  assert.equal(isDocumentOwner(document, "owner-id"), true);
});

test("document collaborator is not allowed to restore a version", () => {
  const document = {
    owner: "owner-id",
    collaborators: ["collaborator-id"],
  };

  assert.equal(isDocumentOwner(document, "collaborator-id"), false);
});

test("missing owner or user is denied version restore permission", () => {
  assert.equal(isDocumentOwner({}, "user-id"), false);
  assert.equal(isDocumentOwner({ owner: "owner-id" }, null), false);
});
