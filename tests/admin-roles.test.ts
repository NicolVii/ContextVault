import { describe, expect, it } from "vitest";
import {
  APP_ROLES,
  evaluateRoleAccess,
  hasMinRole,
  isAdminRole,
  isAppRole,
  isStaffRole,
  isSuperAdminRole,
  ROLE_RANK,
  type AppRole,
} from "../src/lib/admin/roles";

describe("platform roles", () => {
  it("defines the four database-backed roles", () => {
    expect(APP_ROLES).toEqual(["user", "support", "admin", "super_admin"]);
  });

  it("ranks roles so privilege only increases", () => {
    expect(ROLE_RANK.user).toBeLessThan(ROLE_RANK.support);
    expect(ROLE_RANK.support).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.super_admin);
  });

  it("rejects unknown role strings", () => {
    expect(isAppRole("user")).toBe(true);
    expect(isAppRole("owner")).toBe(false);
    expect(isAppRole("admin@example.com")).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });
});

describe("hasMinRole / staff helpers", () => {
  const cases: Array<[AppRole, AppRole, boolean]> = [
    ["user", "user", true],
    ["user", "support", false],
    ["support", "support", true],
    ["support", "admin", false],
    ["admin", "support", true],
    ["admin", "admin", true],
    ["admin", "super_admin", false],
    ["super_admin", "admin", true],
    ["super_admin", "super_admin", true],
  ];

  it.each(cases)("%s meets minimum %s → %s", (role, minimum, expected) => {
    expect(hasMinRole(role, minimum)).toBe(expected);
  });

  it("classifies staff / admin / super_admin correctly", () => {
    expect(isStaffRole("user")).toBe(false);
    expect(isStaffRole("support")).toBe(true);
    expect(isAdminRole("support")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
    expect(isSuperAdminRole("admin")).toBe(false);
    expect(isSuperAdminRole("super_admin")).toBe(true);
  });
});

describe("evaluateRoleAccess (API/page policy)", () => {
  it("returns unauthorized without a session", () => {
    expect(evaluateRoleAccess(false, "super_admin", "support")).toBe(
      "unauthorized"
    );
    expect(evaluateRoleAccess(false, null, "user")).toBe("unauthorized");
  });

  it("denies normal users from staff and admin surfaces", () => {
    expect(evaluateRoleAccess(true, "user", "support")).toBe("forbidden");
    expect(evaluateRoleAccess(true, "user", "admin")).toBe("forbidden");
    expect(evaluateRoleAccess(true, "user", "super_admin")).toBe("forbidden");
  });

  it("allows admins into the admin console but not super-only actions", () => {
    expect(evaluateRoleAccess(true, "admin", "support")).toBe("allow");
    expect(evaluateRoleAccess(true, "admin", "admin")).toBe("allow");
    expect(evaluateRoleAccess(true, "admin", "super_admin")).toBe("forbidden");
  });

  it("allows super_admin for every minimum, including super-only", () => {
    for (const minimum of APP_ROLES) {
      expect(evaluateRoleAccess(true, "super_admin", minimum)).toBe("allow");
    }
  });

  it("treats missing/invalid roles as user (never elevates)", () => {
    expect(evaluateRoleAccess(true, null, "support")).toBe("forbidden");
    expect(evaluateRoleAccess(true, undefined, "admin")).toBe("forbidden");
    expect(evaluateRoleAccess(true, "user", "user")).toBe("allow");
  });

  it("does not authorize by email-shaped strings", () => {
    expect(isAppRole("admin@contextvault.local")).toBe(false);
    expect(
      evaluateRoleAccess(true, "admin@contextvault.local", "admin")
    ).toBe("forbidden");
  });
});
