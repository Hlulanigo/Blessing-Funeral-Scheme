import { db, staff } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface StaffAccess {
      id: string;
      role: string;
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

  const [linked] = await db
    .select({ id: staff.id, role: staff.role, status: staff.status })
    .from(staff)
    .where(eq(staff.authUserId, req.user.id))
    .limit(1);

  if (!linked) {
    res.status(403).json({ error: "Your account is not assigned to this workspace" });
    return;
  }
  if (linked.status !== "active" || !["administrator", "manager", "coordinator", "support"].includes(linked.role)) {
    res.status(403).json({ error: "Your staff access is not active" });
    return;
  }

  req.staff = linked;
  next();
}

export function requireAdministrator(req: Request, res: Response, next: NextFunction) {
  if (req.staff?.role !== "administrator") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
}