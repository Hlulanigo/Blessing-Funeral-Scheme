import assert from "node:assert/strict";
import test from "node:test";
import { canAccessBranch, hasRoleCapability } from "../../../lib/api-zod/src/permissions.ts";
import { matchesClaimEvidenceSignature } from "../src/lib/claimEvidence.ts";

test("only administrators manage staff, settings, and branches", () => {
  for (const role of ["manager", "coordinator", "support"]) {
    assert.equal(hasRoleCapability(role, "manageStaff"), false);
    assert.equal(hasRoleCapability(role, "manageSettings"), false);
    assert.equal(hasRoleCapability(role, "manageBranches"), false);
  }
  assert.equal(hasRoleCapability("administrator", "manageSettings"), true);
});

test("coordinators and support are limited to their assigned branch", () => {
  assert.equal(canAccessBranch("coordinator", "branch-a", "branch-a"), true);
  assert.equal(canAccessBranch("support", "branch-a", "branch-b"), false);
  assert.equal(canAccessBranch("support", null, "branch-a"), false);
  assert.equal(canAccessBranch("manager", null, "branch-a"), true);
});

test("support can assist members but cannot change records or review claims", () => {
  assert.equal(hasRoleCapability("support", "viewMembers"), true);
  assert.equal(hasRoleCapability("support", "submitClaims"), true);
  assert.equal(hasRoleCapability("support", "editMembers"), false);
  assert.equal(hasRoleCapability("support", "recordContributions"), false);
  assert.equal(hasRoleCapability("support", "reviewClaims"), false);
});

test("claim evidence must match the declared PDF, JPEG, or PNG type", () => {
  assert.equal(matchesClaimEvidenceSignature("application/pdf", Buffer.from("%PDF-1.7")), true);
  assert.equal(matchesClaimEvidenceSignature("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(matchesClaimEvidenceSignature("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(matchesClaimEvidenceSignature("image/png", Buffer.from("<script>")), false);
  assert.equal(matchesClaimEvidenceSignature("text/html", Buffer.from("<html>")), false);
});