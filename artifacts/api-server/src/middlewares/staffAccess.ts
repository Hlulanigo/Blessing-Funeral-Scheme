import { db, branches, staff } from "@workspace/db";
import { canAccessBranch, hasRoleCapability, isStaffRole } from "@workspace/api-zod";
import type { RoleCapability, StaffRole } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface StaffAccess {
      id: string;
      role: StaffRole;
      branchId: string | null;
      status: string;
    }

    interface Request {
      staff?: StaffAccess;
    }
  }
}

export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let [linked] = await db
    .select({ id: staff.id, role: staff.role, branchId: staff.branchId, status: staff.status })
    .from(staff)
    .where(eq(staff.authUserId, req.user.id))
    .limit(1);

  if (!linked && req.user.email) {
    [linked] = await db
      .select({ id: staff.id, role: staff.role, branchId: staff.branchId, status: staff.status })
      .from(staff)
      .where(eq(staff.email, req.user.email))
      .limit(1);
    if (linked && !linked.status.includes("suspended")) {
      await db.update(staff).set({
        authUserId: req.user.id,
        status: "active",
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(staff.id, linked.id));
    }
  }

  if (!linked) {
    res.status(403).json({ error: "Your account is not assigned to this workspace" });
    return;
  }
  if (linked.status === "suspended") {
    res.status(403).json({ error: "Your staff access is suspended" });
    return;
  }
  const role = linked.role;
  if (!isStaffRole(role)) {
    res.status(403).json({ error: "Your staff role is invalid" });
    return;
  }
  if (!hasRoleCapability(role, "allBranches") && !linked.branchId) {
    res.status(403).json({ error: "A branch assignment is required for this role" });
    return;
  }
  if (!hasRoleCapability(role, "allBranches") && linked.branchId) {
    const [branch] = await db.select({ active: branches.active }).from(branches).where(eq(branches.id, linked.branchId)).limit(1);
    if (!branch?.active) {
      res.status(403).json({ error: "Your assigned branch is inactive" });
      return;
    }
  }

  req.staff = { ...linked, role };
  next();
}

export function requireAdministrator(req: Request, res: Response, next: NextFunction) {
  if (req.staff?.role !== "administrator") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
}

export function requireCapability(capability: RoleCapability) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.staff || !hasRoleCapability(req.staff.role, capability)) {
      res.status(403).json({ error: "Your staff role cannot perform this action" });
      return;
    }
    next();
  };
}

export function staffCanAccessBranch(req: Request, branchId: string): boolean {
  return Boolean(req.staff && canAccessBranch(req.staff.role, req.staff.branchId, branchId));
}