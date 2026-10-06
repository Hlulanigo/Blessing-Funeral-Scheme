import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  Activity,
  CreateBeneficiaryBody,
  CreateBeneficiaryParams,
  CreateBeneficiaryResponse,
  CreateBranchBody,
  CreateBranchResponse,
  GetSettingsResponse,
  CreateClaimBody,
  CreateClaimResponse,
  DownloadClaimDocumentParams,
  CreateMemberBody,
  CreateMemberResponse,
  CreateStaffBody,
  CreateStaffResponse,
  DashboardSummary,
  DeleteBeneficiaryParams,
  DeleteBeneficiaryResponse,
  GetDashboardSummaryResponse,
  GetMemberParams,
  GetMemberResponse,
  ListActivityResponse,
  ListBranchesQueryParams,
  ListBranchesResponse,
  ListClaimDocumentsResponse,
  ListClaimsQueryParams,
  ListClaimsResponse,
  ListContributionsQueryParams,
  ListContributionsResponse,
  ListMembersQueryParams,
  ListMembersResponse,
  ListStaffQueryParams,
  ListStaffResponse,
  RecordContributionBody,
  RecordContributionResponse,
  UpdateBeneficiaryBody,
  UpdateBeneficiaryParams,
  UpdateBeneficiaryResponse,
  UpdateClaimBody,
  UpdateClaimParams,
  UpdateClaimResponse,
  UpdateBranchBody,
  UpdateBranchParams,
  UpdateBranchResponse,
  UpdateMemberBody,
  UpdateMemberParams,
  UpdateMemberResponse,
  UpdateStaffBody,
  UpdateStaffParams,
  UpdateStaffResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
  UploadClaimDocumentBody,
  UploadClaimDocumentResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  activity,
  beneficiaries,
  branches,
  claims,
  claimDocuments,
  contributions,
  members,
  plans,
  staff,
  systemSettings,
} from "@workspace/db/schema";
import { requireAdministrator, requireCapability, staffCanAccessBranch } from "../middlewares/staffAccess";
import { matchesClaimEvidenceSignature } from "../lib/claimEvidence";

const router: IRouter = Router();

function publicAppUrl(req: Request): string {
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) return new URL(configured).origin;
  const protocol = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost").split(",")[0].trim();
  return `${protocol}://${host}`;
}

const dateOnly = (value: Date | string | null | undefined): string => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

const asDate = (value: Date | string): Date => {
  if (value instanceof Date) return value;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
};

const money = (cents: number): number => cents / 100;

const cents = (amount: number): number => Math.round(amount * 100);

const contributionStatus = (
  paidDate: Date | null,
  dueDate: Date,
  gracePeriodDays = 7,
): "paid" | "due" | "overdue" => {
  if (paidDate) return "paid";
  const graceEndsAt = dueDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000;
  return graceEndsAt < Date.now() ? "overdue" : "due";
};

const timeAgo = (value: Date): string => {
  const minutes = Math.floor(Math.max(0, Date.now() - value.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

function nextMonth(): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  return date;
}

async function branchViews(req?: Request, includeInactive = false) {
  const [branchRows, memberRows, contributionRows, settings] = await Promise.all([
    db.select().from(branches).orderBy(asc(branches.name)),
    db.select().from(members),
    db.select().from(contributions),
    settingsRecord(),
  ]);
  return branchRows
    .filter((branch) => (includeInactive || branch.active) && (!req || staffCanAccessBranch(req, branch.id)))
    .map((branch) => {
    const branchMembers = memberRows.filter(
      (member) => member.branchId === branch.id,
    );
    const branchMemberIds = new Set(branchMembers.map((member) => member.id));
    const due = contributionRows.filter((item) => branchMemberIds.has(item.memberId));
    const paid = due.filter((item) => contributionStatus(item.paidDate, item.dueDate, settings.gracePeriodDays) === "paid");
    return {
      id: branch.id,
      name: branch.name,
      location: branch.location,
      active: branch.active,
      memberCount: branchMembers.length,
      collectionRate: due.length ? Math.round((paid.length / due.length) * 100) : 100,
    };
  });
}

const defaultSettings = {
  id: "default",
  defaultPlanName: "Family Cover",
  monthlyContributionCents: 12000,
  gracePeriodDays: 7,
  contributionReminders: true,
  requireClaimReview: true,
};

async function settingsRecord() {
  const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.id, "default")).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(systemSettings).values(defaultSettings).onConflictDoNothing().returning();
  if (created) return created;
  const [raced] = await db.select().from(systemSettings).where(eq(systemSettings.id, "default")).limit(1);
  if (!raced) throw new Error("Could not initialize scheme settings");
  return raced;
}

function settingsView(settings: typeof systemSettings.$inferSelect) {
  return {
    defaultPlanName: settings.defaultPlanName,
    monthlyContribution: money(settings.monthlyContributionCents),
    gracePeriodDays: settings.gracePeriodDays,
    contributionReminders: settings.contributionReminders,
    requireClaimReview: settings.requireClaimReview,
  };
}

async function staffView(staffId: string) {
  const [row] = await db
    .select({ staff: staff, branch: branches })
    .from(staff)
    .leftJoin(branches, eq(staff.branchId, branches.id))
    .where(eq(staff.id, staffId))
    .limit(1);
  if (!row) return undefined;
  return {
    id: row.staff.id,
    name: row.staff.name,
    email: row.staff.email,
    phone: row.staff.phone,
    role: row.staff.role,
    branchId: row.staff.branchId,
    branchName: row.branch?.name ?? "All branches",
    status: row.staff.status,
    joinedAt: dateOnly(row.staff.joinedAt),
    lastActiveAt: row.staff.lastActiveAt ? dateOnly(row.staff.lastActiveAt) : null,
  };
}

async function memberView(memberId: string) {
  const [member] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) return undefined;
  const [settings, [branch], [plan], beneficiaryRows, contributionRows, claimRows] =
    await Promise.all([
      settingsRecord(),
      db.select().from(branches).where(eq(branches.id, member.branchId)).limit(1),
      db.select().from(plans).where(eq(plans.id, member.planId)).limit(1),
      db.select().from(beneficiaries).where(eq(beneficiaries.memberId, member.id)).orderBy(desc(beneficiaries.primary)),
      db.select().from(contributions).where(eq(contributions.memberId, member.id)).orderBy(desc(contributions.dueDate)),
      db.select().from(claims).where(eq(claims.memberId, member.id)).orderBy(desc(claims.submittedAt)),
    ]);
  const base = {
    id: member.id,
    memberNumber: member.memberNumber,
    name: member.name,
    phone: member.phone,
    email: member.email,
    branchId: member.branchId,
    branchName: branch?.name ?? "Unassigned",
    planName: plan?.name ?? "Unassigned",
    monthlyContribution: money(member.monthlyContributionCents || plan?.monthlyContributionCents || 0),
    dependantsCount: beneficiaryRows.length,
    status: member.status,
    joinedAt: dateOnly(member.joinedAt),
    nextContributionDate: dateOnly(member.nextContributionDate),
  };
  return {
    ...base,
    address: member.address,
    idNumber: member.idNumber,
    beneficiaries: beneficiaryRows.map((item) => ({
      id: item.id,
      memberId: item.memberId,
      name: item.name,
      relationship: item.relationship,
      phone: item.phone,
      allocation: item.allocation,
      primary: item.primary,
    })),
    recentContributions: contributionRows
      .slice(0, 8)
      .map((item) => contributionView(item, undefined, settings.gracePeriodDays)),
    recentClaims: claimRows.slice(0, 8).map((item) => claimView(item)),
  };
}

function contributionView(item: typeof contributions.$inferSelect, memberName?: string, gracePeriodDays = 7) {
  return {
    id: item.id,
    memberId: item.memberId,
    memberName: memberName ?? "",
    amount: money(item.amountCents),
    dueDate: dateOnly(item.dueDate),
    paidDate: item.paidDate ? dateOnly(item.paidDate) : null,
    status: contributionStatus(item.paidDate, item.dueDate, gracePeriodDays),
    method: item.method,
  };
}

function claimView(item: typeof claims.$inferSelect, memberName?: string) {
  return {
    id: item.id,
    claimNumber: item.claimNumber,
    memberId: item.memberId,
    memberName: memberName ?? "",
    deceasedName: item.deceasedName,
    relationship: item.relationship,
    amount: money(item.amountCents),
    submittedAt: dateOnly(item.submittedAt),
    status: item.status,
    notes: item.notes,
  };
}

async function recordActivity(title: string, detail: string, type: string) {
  await db.insert(activity).values({
    id: `activity-${randomUUID()}`,
    title,
    detail,
    type,
  });
}

router.use("/staff", requireAdministrator);

router.get("/dashboard/summary", requireCapability("viewDashboard"), async (req, res) => {
  const [allMembers, allContributions, allClaims, branchesView] = await Promise.all([
    db.select().from(members),
    db.select().from(contributions),
    db.select().from(claims),
    branchViews(req),
  ]);
  const memberRows = allMembers.filter((member) => staffCanAccessBranch(req, member.branchId));
  const memberIds = new Set(memberRows.map((member) => member.id));
  const contributionRows = allContributions.filter((item) => memberIds.has(item.memberId));
  const claimRows = allClaims.filter((item) => memberIds.has(item.memberId));
  const settings = await settingsRecord();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const currentStatuses = contributionRows.map((item) => contributionStatus(item.paidDate, item.dueDate, settings.gracePeriodDays));
  const contributionsThisMonth = contributionRows
    .filter((item) => item.paidDate && item.paidDate >= monthStart)
    .reduce((sum, item) => sum + item.amountCents, 0);
  const overdueContributions = contributionRows
    .filter((item, index) => currentStatuses[index] === "overdue")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const claimBreakdown = ["submitted", "reviewing", "approved", "paid", "declined"].map((status) => ({
    status,
    count: claimRows.filter((claim) => claim.status === status).length,
  }));
  res.json(
    GetDashboardSummaryResponse.parse({
      activeMembers: memberRows.filter((member) => member.status === "active").length,
      pendingMembers: memberRows.filter((member) => member.status === "pending").length,
      contributionsThisMonth: money(contributionsThisMonth),
      overdueContributions: money(overdueContributions),
      openClaims: claimRows.filter((claim) => ["submitted", "reviewing"].includes(claim.status)).length,
      approvedClaims: money(
        claimRows
          .filter((claim) => ["approved", "paid"].includes(claim.status))
          .reduce((sum, claim) => sum + claim.amountCents, 0),
      ),
      branches: branchesView,
      claimBreakdown,
    }),
  );
});

router.get("/activity", requireCapability("viewDashboard"), async (req, res) => {
  if (req.staff && !["administrator", "manager"].includes(req.staff.role)) {
    res.json([]);
    return;
  }
  const rows = await db.select().from(activity).orderBy(desc(activity.createdAt)).limit(12);
  res.json(
    ListActivityResponse.parse(
      rows.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
        time: timeAgo(item.createdAt),
        type: item.type,
      })),
    ),
  );
});

router.get("/settings", requireCapability("viewDashboard"), async (_req, res) => {
  res.json(GetSettingsResponse.parse(settingsView(await settingsRecord())));
});

router.patch("/settings", requireCapability("manageSettings"), async (req, res) => {
  const body = UpdateSettingsBody.parse(req.body);
  if (Object.keys(body).length === 0) {
    res.status(400).json({ error: "At least one setting must be changed" });
    return;
  }
  await settingsRecord();
  const [updated] = await db.update(systemSettings).set({
    ...(body.defaultPlanName !== undefined && { defaultPlanName: body.defaultPlanName }),
    ...(body.monthlyContribution !== undefined && { monthlyContributionCents: cents(body.monthlyContribution) }),
    ...(body.gracePeriodDays !== undefined && { gracePeriodDays: body.gracePeriodDays }),
    ...(body.contributionReminders !== undefined && { contributionReminders: body.contributionReminders }),
    ...(body.requireClaimReview !== undefined && { requireClaimReview: body.requireClaimReview }),
    updatedAt: new Date(),
  }).where(eq(systemSettings.id, "default")).returning();
  await recordActivity("Scheme settings updated", "Operational defaults were changed", "settings");
  res.json(UpdateSettingsResponse.parse(settingsView(updated)));
});

router.get("/branches", requireCapability("viewBranches"), async (req, res) => {
  const query = ListBranchesQueryParams.parse(req.query);
  const canSeeInactive = query.includeInactive && req.staff?.role === "administrator";
  res.json(ListBranchesResponse.parse(await branchViews(req, canSeeInactive)));
});

router.post("/branches", requireCapability("manageBranches"), async (req, res) => {
  const body = CreateBranchBody.parse(req.body);
  const branchId = `branch-${randomUUID()}`;
  await db.insert(branches).values({
    id: branchId,
    name: body.name,
    location: body.location,
  });
  await recordActivity("Branch added", `${body.name} - ${body.location}`, "branch");
  const [branch] = (await branchViews()).filter((item) => item.id === branchId);
  res.status(201).json(CreateBranchResponse.parse(branch));
});

router.patch("/branches/:branchId", requireCapability("manageBranches"), async (req, res) => {
  const params = UpdateBranchParams.parse(req.params);
  const body = UpdateBranchBody.parse(req.body);
  if (Object.keys(body).length === 0) {
    res.status(400).json({ error: "At least one branch field must be changed" });
    return;
  }
  const [existing] = await db.select().from(branches).where(eq(branches.id, params.branchId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }
  const [updated] = await db.update(branches).set(body).where(eq(branches.id, existing.id)).returning();
  await recordActivity(body.active === false ? "Branch deactivated" : "Branch updated", updated.name, "branch");
  const [branch] = (await branchViews(undefined, true)).filter((item) => item.id === updated.id);
  res.json(UpdateBranchResponse.parse(branch));
});

router.get("/staff", async (req, res) => {
  const query = ListStaffQueryParams.parse(req.query);
  const rows = await db
    .select({ staff: staff, branch: branches })
    .from(staff)
    .leftJoin(branches, eq(staff.branchId, branches.id))
    .orderBy(asc(staff.name));
  const search = query.search?.toLowerCase();
  const visible = rows.filter(({ staff: item }) => (
    (!search ||
      item.name.toLowerCase().includes(search) ||
      item.email.toLowerCase().includes(search) ||
      item.phone.toLowerCase().includes(search)) &&
    (!query.status || item.status === query.status) &&
    (!query.role || item.role === query.role)
  ));
  res.json(
    ListStaffResponse.parse(
      visible.map(({ staff: item, branch }) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        phone: item.phone,
        role: item.role,
        branchId: item.branchId,
        branchName: branch?.name ?? "All branches",
        status: item.status,
        joinedAt: dateOnly(item.joinedAt),
        lastActiveAt: item.lastActiveAt ? dateOnly(item.lastActiveAt) : null,
      })),
    ),
  );
});

router.post("/staff", async (req, res) => {
  const body = CreateStaffBody.parse(req.body);
  if (["coordinator", "support"].includes(body.role) && !body.branchId) {
    res.status(400).json({ error: "A branch assignment is required for this role" });
    return;
  }
  if (body.branchId) {
    const [branch] = await db.select({ id: branches.id, active: branches.active }).from(branches).where(eq(branches.id, body.branchId)).limit(1);
    if (!branch || !branch.active) {
      res.status(400).json({ error: "Branch was not found or is inactive" });
      return;
    }
  }
  const [emailMatch] = await db.select({ id: staff.id }).from(staff).where(eq(staff.email, body.email)).limit(1);
  if (emailMatch) {
    res.status(409).json({ error: "A staff member with that email already exists" });
    return;
  }
  const staffId = `staff-${randomUUID()}`;
  await db.insert(staff).values({
    id: staffId,
    name: body.name,
    email: body.email,
    phone: body.phone,
    role: body.role,
    branchId: body.branchId,
    status: "invited",
    joinedAt: new Date(),
    lastActiveAt: null,
  });
  await recordActivity("Staff member added", `${body.name} · invitation pending`, "staff");
  const inviteUrl = `${publicAppUrl(req)}/api/login?returnTo=${encodeURIComponent("/")}`;
  res.status(201).json(CreateStaffResponse.parse({ ...(await staffView(staffId)), inviteUrl }));
});

router.patch("/staff/:staffId", async (req, res) => {
  const params = UpdateStaffParams.parse(req.params);
  const body = UpdateStaffBody.parse(req.body);
  const [existing] = await db.select().from(staff).where(eq(staff.id, params.staffId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  const nextRole = body.role ?? existing.role;
  const nextBranchId = body.branchId === undefined ? existing.branchId : body.branchId;
  if (["coordinator", "support"].includes(nextRole) && !nextBranchId) {
    res.status(400).json({ error: "A branch assignment is required for this role" });
    return;
  }
  if (body.branchId) {
    const [branch] = await db.select({ id: branches.id, active: branches.active }).from(branches).where(eq(branches.id, body.branchId)).limit(1);
    if (!branch || !branch.active) {
      res.status(400).json({ error: "Branch was not found or is inactive" });
      return;
    }
  }
  if (body.email && body.email !== existing.email) {
    const [emailMatch] = await db.select({ id: staff.id }).from(staff).where(eq(staff.email, body.email)).limit(1);
    if (emailMatch) {
      res.status(409).json({ error: "A staff member with that email already exists" });
      return;
    }
  }
  await db.update(staff).set({
    ...body,
    lastActiveAt: body.status === "active" ? new Date() : existing.lastActiveAt,
    updatedAt: new Date(),
  }).where(eq(staff.id, existing.id));
  await recordActivity("Staff member updated", `${body.name ?? existing.name} · ${body.status ?? existing.status}`, "staff");
  res.json(UpdateStaffResponse.parse(await staffView(existing.id)));
});

router.get("/members", requireCapability("viewMembers"), async (req, res) => {
  const query = ListMembersQueryParams.parse(req.query);
  const rows = await db
    .select({
      member: members,
      branch: branches,
      plan: plans,
    })
    .from(members)
    .innerJoin(branches, eq(members.branchId, branches.id))
    .innerJoin(plans, eq(members.planId, plans.id))
    .orderBy(desc(members.createdAt));
  const dependantCounts = await db.select().from(beneficiaries);
  const filtered = rows.filter(({ member }) => {
    const search = query.search?.toLowerCase();
    return (
      staffCanAccessBranch(req, member.branchId) &&
      (!search ||
        member.name.toLowerCase().includes(search) ||
        member.memberNumber.toLowerCase().includes(search) ||
        member.phone.toLowerCase().includes(search)) &&
      (!query.status || member.status === query.status) &&
      (!query.branchId || member.branchId === query.branchId)
    );
  });
  res.json(
    ListMembersResponse.parse(
      filtered.map(({ member, branch, plan }) => ({
        id: member.id,
        memberNumber: member.memberNumber,
        name: member.name,
        phone: member.phone,
        email: member.email,
        branchId: member.branchId,
        branchName: branch.name,
        planName: plan.name,
        monthlyContribution: money(member.monthlyContributionCents || plan.monthlyContributionCents),
        dependantsCount: dependantCounts.filter((item) => item.memberId === member.id).length,
        status: member.status,
        joinedAt: dateOnly(member.joinedAt),
        nextContributionDate: dateOnly(member.nextContributionDate),
      })),
    ),
  );
});

router.post("/members", requireCapability("editMembers"), async (req, res) => {
  const body = CreateMemberBody.parse(req.body);
  const settings = await settingsRecord();
  const [[branch], [existingPlan]] = await Promise.all([
    db.select().from(branches).where(eq(branches.id, body.branchId)).limit(1),
    db.select().from(plans).where(eq(plans.name, body.planName)).limit(1),
  ]);
  let plan = existingPlan;
  if (!plan && body.planName === settings.defaultPlanName) {
    [plan] = await db.insert(plans).values({
      id: `plan-${randomUUID()}`,
      name: settings.defaultPlanName,
      monthlyContributionCents: settings.monthlyContributionCents,
      active: true,
    }).returning();
  }
  if (!branch || !branch.active || !plan || !plan.active) {
    res.status(400).json({ error: "Branch or plan was not found or is inactive" });
    return;
  }
  if (!staffCanAccessBranch(req, branch.id)) {
    res.status(403).json({ error: "You cannot create members for another branch" });
    return;
  }
  const memberId = `member-${randomUUID()}`;
  const joinedAt = new Date();
  const nextContributionDate = nextMonth();
  const monthlyContributionCents = body.planName === settings.defaultPlanName
    ? settings.monthlyContributionCents
    : plan.monthlyContributionCents;
  await db.transaction(async (tx) => {
    await tx.insert(members).values({
      id: memberId,
      memberNumber: `BFS-${Math.floor(1000 + Math.random() * 9000)}`,
      name: body.name,
      phone: body.phone,
      email: body.email,
      address: body.address,
      idNumber: body.idNumber,
      branchId: branch.id,
      planId: plan.id,
      monthlyContributionCents,
      status: "active",
      joinedAt,
      nextContributionDate,
    });
    await tx.insert(contributions).values({
      id: `contribution-${randomUUID()}`,
      memberId,
      amountCents: monthlyContributionCents,
      dueDate: nextContributionDate,
      paidDate: null,
      status: "due",
      method: "Debit order",
    });
  });
  await recordActivity("New member enrolled", `${body.name} · ${branch.name}`, "member");
  res.status(201).json(CreateMemberResponse.parse(await memberView(memberId)));
});

router.get("/members/:memberId", requireCapability("viewMembers"), async (req, res) => {
  const params = GetMemberParams.parse(req.params);
  const member = await memberView(params.memberId);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (!staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (!staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(GetMemberResponse.parse(member));
});

router.patch("/members/:memberId", requireCapability("editMembers"), async (req, res) => {
  const params = UpdateMemberParams.parse(req.params);
  const body = UpdateMemberBody.parse(req.body);
  const [existing] = await db.select().from(members).where(eq(members.id, params.memberId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (!staffCanAccessBranch(req, existing.branchId)) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const patch: Partial<typeof members.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) patch.name = body.name;
  if (body.phone !== undefined) patch.phone = body.phone;
  if (body.email !== undefined) patch.email = body.email;
  if (body.address !== undefined) patch.address = body.address;
  if (body.idNumber !== undefined) patch.idNumber = body.idNumber;
  if (body.status !== undefined) patch.status = body.status;
  if (body.branchId !== undefined) {
    if (!staffCanAccessBranch(req, body.branchId)) {
      res.status(403).json({ error: "You cannot move a member to another branch" });
      return;
    }
    const [branch] = await db.select().from(branches).where(eq(branches.id, body.branchId)).limit(1);
    if (!branch || !branch.active) {
      res.status(400).json({ error: "Branch was not found or is inactive" });
      return;
    }
    patch.branchId = branch.id;
  }
  if (body.planName !== undefined) {
    const settings = await settingsRecord();
    let [plan] = await db.select().from(plans).where(eq(plans.name, body.planName)).limit(1);
    if (!plan && body.planName === settings.defaultPlanName) {
      [plan] = await db.insert(plans).values({
        id: `plan-${randomUUID()}`,
        name: settings.defaultPlanName,
        monthlyContributionCents: settings.monthlyContributionCents,
        active: true,
      }).returning();
    }
    if (!plan || !plan.active) {
      res.status(400).json({ error: "Plan was not found or is inactive" });
      return;
    }
    patch.planId = plan.id;
    patch.monthlyContributionCents = body.planName === settings.defaultPlanName
      ? settings.monthlyContributionCents
      : plan.monthlyContributionCents;
  }
  await db.update(members).set(patch).where(eq(members.id, existing.id));
  await recordActivity("Member profile updated", existing.name, "member");
  res.json(UpdateMemberResponse.parse(await memberView(existing.id)));
});

router.post("/members/:memberId/beneficiaries", requireCapability("editMembers"), async (req, res) => {
  const params = CreateBeneficiaryParams.parse(req.params);
  const body = CreateBeneficiaryBody.parse(req.body);
  const [member] = await db.select().from(members).where(eq(members.id, params.memberId)).limit(1);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (body.primary) {
    await db.update(beneficiaries).set({ primary: false }).where(eq(beneficiaries.memberId, member.id));
  }
  const beneficiary = {
    id: `beneficiary-${randomUUID()}`,
    memberId: member.id,
    name: body.name,
    relationship: body.relationship,
    phone: body.phone,
    allocation: body.allocation,
    primary: body.primary,
  };
  await db.insert(beneficiaries).values(beneficiary);
  await recordActivity("Beneficiary added", `${body.name} · ${member.name}`, "member");
  res.status(201).json(CreateBeneficiaryResponse.parse(beneficiary));
});

router.patch("/beneficiaries/:beneficiaryId", requireCapability("editMembers"), async (req, res) => {
  const params = UpdateBeneficiaryParams.parse(req.params);
  const body = UpdateBeneficiaryBody.parse(req.body);
  const [existing] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, params.beneficiaryId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Beneficiary not found" });
    return;
  }
  const [member] = await db.select().from(members).where(eq(members.id, existing.memberId)).limit(1);
  if (!member || !staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Beneficiary not found" });
    return;
  }
  if (body.primary) {
    await db.update(beneficiaries).set({ primary: false }).where(eq(beneficiaries.memberId, existing.memberId));
  }
  const updated = {
    ...existing,
    ...body,
    updatedAt: new Date(),
  };
  await db.update(beneficiaries).set(body).where(eq(beneficiaries.id, existing.id));
  res.json(UpdateBeneficiaryResponse.parse(updated));
});

router.delete("/beneficiaries/:beneficiaryId", requireCapability("editMembers"), async (req, res) => {
  const params = DeleteBeneficiaryParams.parse(req.params);
  const [existing] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, params.beneficiaryId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Beneficiary not found" });
    return;
  }
  const [member] = await db.select().from(members).where(eq(members.id, existing.memberId)).limit(1);
  if (!member || !staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Beneficiary not found" });
    return;
  }
  await db.delete(beneficiaries).where(eq(beneficiaries.id, existing.id));
  res.status(204).send(DeleteBeneficiaryResponse.parse(undefined));
});

router.get("/contributions", requireCapability("viewContributions"), async (req, res) => {
  const query = ListContributionsQueryParams.parse(req.query);
  const settings = await settingsRecord();
  const rows = await db
    .select({ contribution: contributions, member: members })
    .from(contributions)
    .innerJoin(members, eq(contributions.memberId, members.id))
    .orderBy(desc(contributions.dueDate));
  const visible = rows.filter(({ contribution, member }) => {
    const status = contributionStatus(contribution.paidDate, contribution.dueDate, settings.gracePeriodDays);
    return staffCanAccessBranch(req, member.branchId) && (!query.memberId || contribution.memberId === query.memberId) && (!query.status || status === query.status);
  });
  res.json(ListContributionsResponse.parse(visible.map(({ contribution, member }) => contributionView(contribution, member.name, settings.gracePeriodDays))));
});

router.post("/contributions", requireCapability("recordContributions"), async (req, res) => {
  const body = RecordContributionBody.parse(req.body);
  const settings = await settingsRecord();
  const [member] = await db.select().from(members).where(eq(members.id, body.memberId)).limit(1);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (!staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const contribution = {
    id: `contribution-${randomUUID()}`,
    memberId: member.id,
    amountCents: cents(body.amount),
    dueDate: asDate(body.dueDate),
    paidDate: body.paidDate ? asDate(body.paidDate) : null,
    status: body.paidDate ? "paid" : contributionStatus(null, asDate(body.dueDate), settings.gracePeriodDays),
    method: body.method,
    createdAt: new Date(),
  };
  await db.insert(contributions).values(contribution);
  await recordActivity("Contribution recorded", `${member.name} · R${body.amount.toFixed(2)}`, "contribution");
  res.status(201).json(RecordContributionResponse.parse(contributionView(contribution, member.name, settings.gracePeriodDays)));
});

router.get("/claims", requireCapability("viewClaims"), async (req, res) => {
  const query = ListClaimsQueryParams.parse(req.query);
  const rows = await db
    .select({ claim: claims, member: members })
    .from(claims)
    .innerJoin(members, eq(claims.memberId, members.id))
    .orderBy(desc(claims.submittedAt));
  const visible = rows.filter(({ claim, member }) => {
    const search = query.search?.toLowerCase();
    return (
      (!query.status || claim.status === query.status) &&
      staffCanAccessBranch(req, member.branchId) &&
      (!search ||
        claim.claimNumber.toLowerCase().includes(search) ||
        claim.deceasedName.toLowerCase().includes(search) ||
        member.name.toLowerCase().includes(search))
    );
  });
  res.json(ListClaimsResponse.parse(visible.map(({ claim, member }) => claimView(claim, member.name))));
});

router.post("/claims", requireCapability("submitClaims"), async (req, res) => {
  const body = CreateClaimBody.parse(req.body);
  const [member] = await db.select().from(members).where(eq(members.id, body.memberId)).limit(1);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (!staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const claim = {
    id: `claim-${randomUUID()}`,
    claimNumber: `CLM-${Math.floor(1000 + Math.random() * 9000)}`,
    memberId: member.id,
    deceasedName: body.deceasedName,
    relationship: body.relationship,
    amountCents: cents(body.amount),
    submittedAt: new Date(),
    status: (await settingsRecord()).requireClaimReview ? "reviewing" : "submitted",
    notes: body.notes,
    updatedAt: new Date(),
  };
  await db.insert(claims).values(claim);
  await recordActivity("New claim submitted", `${claim.claimNumber} · ${member.name}`, "claim");
  res.status(201).json(CreateClaimResponse.parse(claimView(claim, member.name)));
});

router.get("/claims/:claimId/documents", requireCapability("viewClaims"), async (req, res) => {
  const params = UpdateClaimParams.parse(req.params);
  const [claim] = await db.select().from(claims).where(eq(claims.id, params.claimId)).limit(1);
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  const [member] = await db.select().from(members).where(eq(members.id, claim.memberId)).limit(1);
  if (!member || !staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  const documents = await db.select().from(claimDocuments).where(eq(claimDocuments.claimId, claim.id)).orderBy(asc(claimDocuments.createdAt));
  res.json(ListClaimDocumentsResponse.parse(documents.map((document) => ({
    id: document.id,
    claimId: document.claimId,
    fileName: document.fileName,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    uploadedAt: document.createdAt.toISOString(),
  }))));
});

router.post("/claims/:claimId/documents", requireCapability("submitClaims"), async (req, res) => {
  const params = UpdateClaimParams.parse(req.params);
  const body = UploadClaimDocumentBody.parse(req.body);
  const [claim] = await db.select().from(claims).where(eq(claims.id, params.claimId)).limit(1);
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  const [member] = await db.select().from(members).where(eq(members.id, claim.memberId)).limit(1);
  if (!member || !staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.dataBase64)) {
    res.status(400).json({ error: "File content must be valid base64" });
    return;
  }
  const content = Buffer.from(body.dataBase64, "base64");
  if (content.length === 0 || content.length > 5 * 1024 * 1024 || content.toString("base64") !== body.dataBase64) {
    res.status(400).json({ error: "Evidence files must be between 1 byte and 5 MB" });
    return;
  }
  if (!matchesClaimEvidenceSignature(body.contentType, content)) {
    res.status(400).json({ error: "File content does not match its declared type" });
    return;
  }
  const fileName = body.fileName.split(/[\\/]/).pop()?.replace(/[\r\n\"]+/g, "_") || "claim-evidence";
  const document = {
    id: `claim-document-${randomUUID()}`,
    claimId: claim.id,
    fileName,
    contentType: body.contentType,
    dataBase64: body.dataBase64,
    sizeBytes: content.length,
    uploadedBy: req.staff?.id ?? null,
  };
  const [created] = await db.insert(claimDocuments).values(document).returning();
  await recordActivity("Claim evidence uploaded", `${claim.claimNumber} · ${fileName}`, "claim");
  res.status(201).json(UploadClaimDocumentResponse.parse({
    id: created.id,
    claimId: created.claimId,
    fileName: created.fileName,
    contentType: created.contentType,
    sizeBytes: created.sizeBytes,
    uploadedAt: created.createdAt.toISOString(),
  }));
});

router.get("/claims/:claimId/documents/:documentId", requireCapability("viewClaims"), async (req, res) => {
  const params = DownloadClaimDocumentParams.parse(req.params);
  const [document] = await db.select().from(claimDocuments).where(and(eq(claimDocuments.id, params.documentId), eq(claimDocuments.claimId, params.claimId))).limit(1);
  if (!document) {
    res.status(404).json({ error: "Claim document not found" });
    return;
  }
  const [claim] = await db.select().from(claims).where(eq(claims.id, document.claimId)).limit(1);
  const [member] = claim ? await db.select().from(members).where(eq(members.id, claim.memberId)).limit(1) : [];
  if (!claim || !member || !staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Claim document not found" });
    return;
  }
  const safeName = document.fileName.replace(/[\r\n\"]+/g, "_");
  res.type(document.contentType).set("Cache-Control", "private, no-store").set("Content-Disposition", `attachment; filename="${safeName}"`).send(Buffer.from(document.dataBase64, "base64"));
});

router.patch("/claims/:claimId", requireCapability("reviewClaims"), async (req, res) => {
  const params = UpdateClaimParams.parse(req.params);
  const body = UpdateClaimBody.parse(req.body);
  const [existing] = await db.select().from(claims).where(eq(claims.id, params.claimId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  const [member] = await db.select().from(members).where(eq(members.id, existing.memberId)).limit(1);
  if (!member || !staffCanAccessBranch(req, member.branchId)) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  await db.update(claims).set({ ...body, updatedAt: new Date() }).where(eq(claims.id, existing.id));
  await recordActivity("Claim status updated", `${existing.claimNumber} · ${body.status ?? existing.status}`, "claim");
  res.json(UpdateClaimResponse.parse(claimView({ ...existing, ...body }, member?.name)));
});

export default router;