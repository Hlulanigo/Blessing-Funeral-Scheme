import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  Activity,
  CreateBeneficiaryBody,
  CreateBeneficiaryParams,
  CreateBeneficiaryResponse,
  CreateClaimBody,
  CreateClaimResponse,
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
  ListBranchesResponse,
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
  UpdateMemberBody,
  UpdateMemberParams,
  UpdateMemberResponse,
  UpdateStaffBody,
  UpdateStaffParams,
  UpdateStaffResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  activity,
  beneficiaries,
  branches,
  claims,
  contributions,
  members,
  plans,
  staff,
} from "@workspace/db/schema";
import { requireAdministrator } from "../middlewares/staffAccess";

const router: IRouter = Router();
const dayMs = 24 * 60 * 60 * 1000;

const demoBranches = [
  ["branch-soweto", "Soweto", "Johannesburg", 58],
  ["branch-mamelodi", "Mamelodi", "Pretoria", 42],
  ["branch-khayelitsha", "Khayelitsha", "Cape Town", 31],
] as const;

const demoPlans = [
  ["plan-family", "Family Cover", 180],
  ["plan-standard", "Standard Cover", 120],
  ["plan-senior", "Senior Cover", 95],
] as const;

let seedPromise: Promise<void> | undefined;

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
): "paid" | "due" | "overdue" => {
  if (paidDate) return "paid";
  return dueDate.getTime() < Date.now() ? "overdue" : "due";
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

async function seedData(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(branches)
      .values(
        demoBranches.map(([id, name, location]) => ({ id, name, location })),
      )
      .onConflictDoNothing();
    await tx
      .insert(plans)
      .values(
        demoPlans.map(([id, name, amount]) => ({
          id,
          name,
          monthlyContributionCents: amount * 100,
        })),
      )
      .onConflictDoNothing();

    const existingStaff = await tx.select({ id: staff.id }).from(staff).limit(1);
    if (existingStaff.length === 0) {
      await tx.insert(staff).values([
        {
          id: "staff-001",
          name: "Amina Mokoena",
          email: "amina.mokoena@blessing.co.za",
          phone: "082 410 9821",
          role: "administrator",
          branchId: null,
          status: "active",
          joinedAt: new Date("2023-02-01T00:00:00.000Z"),
          lastActiveAt: new Date(),
        },
        {
          id: "staff-002",
          name: "Siyabonga Ndlovu",
          email: "siyabonga.ndlovu@blessing.co.za",
          phone: "078 622 1450",
          role: "manager",
          branchId: "branch-soweto",
          status: "active",
          joinedAt: new Date("2023-08-14T00:00:00.000Z"),
          lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          id: "staff-003",
          name: "Naledi Khumalo",
          email: "naledi.khumalo@blessing.co.za",
          phone: "071 909 3341",
          role: "coordinator",
          branchId: "branch-mamelodi",
          status: "invited",
          joinedAt: new Date(),
          lastActiveAt: null,
        },
      ]);
    }

    const existing = await tx.select({ id: members.id }).from(members).limit(1);
    if (existing.length > 0) return;

    const now = new Date();
    const seededMembers = [
      {
        id: "member-001",
        memberNumber: "BFS-1001",
        name: "Nomsa Dlamini",
        phone: "071 555 0142",
        email: "nomsa.dlamini@example.com",
        address: "Soweto, Johannesburg",
        idNumber: "8001010000000",
        branchId: "branch-soweto",
        planId: "plan-family",
        status: "active",
        joinedAt: new Date(now.getTime() - 210 * dayMs),
        nextContributionDate: new Date(now.getTime() + 4 * dayMs),
      },
      {
        id: "member-002",
        memberNumber: "BFS-1002",
        name: "Thabo Mokoena",
        phone: "082 444 2088",
        email: "thabo.mokoena@example.com",
        address: "Mamelodi, Pretoria",
        idNumber: "7503120000000",
        branchId: "branch-mamelodi",
        planId: "plan-standard",
        status: "active",
        joinedAt: new Date(now.getTime() - 160 * dayMs),
        nextContributionDate: new Date(now.getTime() - 2 * dayMs),
      },
      {
        id: "member-003",
        memberNumber: "BFS-1003",
        name: "Lerato Ncube",
        phone: "079 300 7712",
        email: "lerato.ncube@example.com",
        address: "Khayelitsha, Cape Town",
        idNumber: "9006240000000",
        branchId: "branch-khayelitsha",
        planId: "plan-senior",
        status: "pending",
        joinedAt: new Date(now.getTime() - 12 * dayMs),
        nextContributionDate: new Date(now.getTime() + 12 * dayMs),
      },
    ];
    await tx.insert(members).values(seededMembers);
    await tx.insert(beneficiaries).values([
      {
        id: "beneficiary-001",
        memberId: "member-001",
        name: "Ayanda Dlamini",
        relationship: "Daughter",
        phone: "073 111 2200",
        allocation: 100,
        primary: true,
      },
      {
        id: "beneficiary-002",
        memberId: "member-002",
        name: "Mpho Mokoena",
        relationship: "Spouse",
        phone: "083 555 1122",
        allocation: 100,
        primary: true,
      },
    ]);
    await tx.insert(contributions).values([
      {
        id: "contribution-001",
        memberId: "member-001",
        amountCents: 18000,
        dueDate: new Date(now.getTime() - 28 * dayMs),
        paidDate: new Date(now.getTime() - 28 * dayMs),
        status: "paid",
        method: "Debit order",
      },
      {
        id: "contribution-002",
        memberId: "member-002",
        amountCents: 12000,
        dueDate: new Date(now.getTime() - 2 * dayMs),
        paidDate: null,
        status: "overdue",
        method: "Cash",
      },
      {
        id: "contribution-003",
        memberId: "member-003",
        amountCents: 9500,
        dueDate: new Date(now.getTime() + 12 * dayMs),
        paidDate: null,
        status: "due",
        method: "Debit order",
      },
    ]);
    await tx.insert(claims).values([
      {
        id: "claim-001",
        claimNumber: "CLM-2401",
        memberId: "member-001",
        deceasedName: "Sibusiso Dlamini",
        relationship: "Brother",
        amountCents: 12500,
        submittedAt: new Date(now.getTime() - 3 * dayMs),
        status: "reviewing",
        notes: "Waiting for certified death certificate.",
      },
      {
        id: "claim-002",
        claimNumber: "CLM-2402",
        memberId: "member-002",
        deceasedName: "Maria Mokoena",
        relationship: "Mother",
        amountCents: 12500,
        submittedAt: new Date(now.getTime() - 9 * dayMs),
        status: "approved",
        notes: "Approved for payment.",
      },
    ]);
    await tx.insert(activity).values([
      {
        id: "activity-001",
        title: "Claim moved to review",
        detail: "CLM-2401 · Nomsa Dlamini",
        type: "claim",
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        id: "activity-002",
        title: "Contribution overdue",
        detail: "Thabo Mokoena · Mamelodi branch",
        type: "contribution",
        createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      },
      {
        id: "activity-003",
        title: "New member application",
        detail: "Lerato Ncube · Khayelitsha branch",
        type: "member",
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    ]);
  });
}

async function ensureSeedData(): Promise<void> {
  seedPromise ??= seedData().catch((error) => {
    seedPromise = undefined;
    throw error;
  });
  return seedPromise;
}

async function branchViews() {
  const [branchRows, memberRows, contributionRows] = await Promise.all([
    db.select().from(branches).orderBy(asc(branches.name)),
    db.select().from(members),
    db.select().from(contributions),
  ]);
  return branchRows.map((branch) => {
    const branchMembers = memberRows.filter(
      (member) => member.branchId === branch.id,
    );
    const branchMemberIds = new Set(branchMembers.map((member) => member.id));
    const due = contributionRows.filter((item) => branchMemberIds.has(item.memberId));
    const paid = due.filter((item) => contributionStatus(item.paidDate, item.dueDate) === "paid");
    return {
      id: branch.id,
      name: branch.name,
      location: branch.location,
      memberCount: branchMembers.length,
      collectionRate: due.length ? Math.round((paid.length / due.length) * 100) : 100,
    };
  });
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
  const [[branch], [plan], beneficiaryRows, contributionRows, claimRows] =
    await Promise.all([
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
    monthlyContribution: money(plan?.monthlyContributionCents ?? 0),
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
      .map((item) => contributionView(item)),
    recentClaims: claimRows.slice(0, 8).map((item) => claimView(item)),
  };
}

function contributionView(item: typeof contributions.$inferSelect, memberName?: string) {
  return {
    id: item.id,
    memberId: item.memberId,
    memberName: memberName ?? "",
    amount: money(item.amountCents),
    dueDate: dateOnly(item.dueDate),
    paidDate: item.paidDate ? dateOnly(item.paidDate) : null,
    status: contributionStatus(item.paidDate, item.dueDate),
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

router.use(async (_req, res, next) => {
  try {
    await ensureSeedData();
    next();
  } catch (error) {
    next(error);
  }
});
router.use("/staff", requireAdministrator);

router.get("/dashboard/summary", async (_req, res) => {
  const [memberRows, contributionRows, claimRows, branchesView] = await Promise.all([
    db.select().from(members),
    db.select().from(contributions),
    db.select().from(claims),
    branchViews(),
  ]);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const currentStatuses = contributionRows.map((item) => contributionStatus(item.paidDate, item.dueDate));
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

router.get("/activity", async (_req, res) => {
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

router.get("/branches", async (_req, res) => {
  res.json(ListBranchesResponse.parse(await branchViews()));
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
  if (body.branchId) {
    const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, body.branchId)).limit(1);
    if (!branch) {
      res.status(400).json({ error: "Branch was not found" });
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
  res.status(201).json(CreateStaffResponse.parse(await staffView(staffId)));
});

router.patch("/staff/:staffId", async (req, res) => {
  const params = UpdateStaffParams.parse(req.params);
  const body = UpdateStaffBody.parse(req.body);
  const [existing] = await db.select().from(staff).where(eq(staff.id, params.staffId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  if (body.branchId) {
    const [branch] = await db.select({ id: branches.id }).from(branches).where(eq(branches.id, body.branchId)).limit(1);
    if (!branch) {
      res.status(400).json({ error: "Branch was not found" });
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

router.get("/members", async (req, res) => {
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
        monthlyContribution: money(plan.monthlyContributionCents),
        dependantsCount: dependantCounts.filter((item) => item.memberId === member.id).length,
        status: member.status,
        joinedAt: dateOnly(member.joinedAt),
        nextContributionDate: dateOnly(member.nextContributionDate),
      })),
    ),
  );
});

router.post("/members", async (req, res) => {
  const body = CreateMemberBody.parse(req.body);
  const [[branch], [plan]] = await Promise.all([
    db.select().from(branches).where(eq(branches.id, body.branchId)).limit(1),
    db.select().from(plans).where(eq(plans.name, body.planName)).limit(1),
  ]);
  if (!branch || !plan) {
    res.status(400).json({ error: "Branch or plan was not found" });
    return;
  }
  const memberId = `member-${randomUUID()}`;
  const joinedAt = new Date();
  const nextContributionDate = nextMonth();
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
      status: "active",
      joinedAt,
      nextContributionDate,
    });
    await tx.insert(contributions).values({
      id: `contribution-${randomUUID()}`,
      memberId,
      amountCents: plan.monthlyContributionCents,
      dueDate: nextContributionDate,
      paidDate: null,
      status: "due",
      method: "Debit order",
    });
  });
  await recordActivity("New member enrolled", `${body.name} · ${branch.name}`, "member");
  res.status(201).json(CreateMemberResponse.parse(await memberView(memberId)));
});

router.get("/members/:memberId", async (req, res) => {
  const params = GetMemberParams.parse(req.params);
  const member = await memberView(params.memberId);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(GetMemberResponse.parse(member));
});

router.patch("/members/:memberId", async (req, res) => {
  const params = UpdateMemberParams.parse(req.params);
  const body = UpdateMemberBody.parse(req.body);
  const [existing] = await db.select().from(members).where(eq(members.id, params.memberId)).limit(1);
  if (!existing) {
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
    const [branch] = await db.select().from(branches).where(eq(branches.id, body.branchId)).limit(1);
    if (!branch) {
      res.status(400).json({ error: "Branch was not found" });
      return;
    }
    patch.branchId = branch.id;
  }
  if (body.planName !== undefined) {
    const [plan] = await db.select().from(plans).where(eq(plans.name, body.planName)).limit(1);
    if (!plan) {
      res.status(400).json({ error: "Plan was not found" });
      return;
    }
    patch.planId = plan.id;
  }
  await db.update(members).set(patch).where(eq(members.id, existing.id));
  await recordActivity("Member profile updated", existing.name, "member");
  res.json(UpdateMemberResponse.parse(await memberView(existing.id)));
});

router.post("/members/:memberId/beneficiaries", async (req, res) => {
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

router.patch("/beneficiaries/:beneficiaryId", async (req, res) => {
  const params = UpdateBeneficiaryParams.parse(req.params);
  const body = UpdateBeneficiaryBody.parse(req.body);
  const [existing] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, params.beneficiaryId)).limit(1);
  if (!existing) {
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

router.delete("/beneficiaries/:beneficiaryId", async (req, res) => {
  const params = DeleteBeneficiaryParams.parse(req.params);
  const [existing] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, params.beneficiaryId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Beneficiary not found" });
    return;
  }
  await db.delete(beneficiaries).where(eq(beneficiaries.id, existing.id));
  res.status(204).send(DeleteBeneficiaryResponse.parse(undefined));
});

router.get("/contributions", async (req, res) => {
  const query = ListContributionsQueryParams.parse(req.query);
  const rows = await db
    .select({ contribution: contributions, member: members })
    .from(contributions)
    .innerJoin(members, eq(contributions.memberId, members.id))
    .orderBy(desc(contributions.dueDate));
  const visible = rows.filter(({ contribution }) => {
    const status = contributionStatus(contribution.paidDate, contribution.dueDate);
    return (!query.memberId || contribution.memberId === query.memberId) && (!query.status || status === query.status);
  });
  res.json(ListContributionsResponse.parse(visible.map(({ contribution, member }) => contributionView(contribution, member.name))));
});

router.post("/contributions", async (req, res) => {
  const body = RecordContributionBody.parse(req.body);
  const [member] = await db.select().from(members).where(eq(members.id, body.memberId)).limit(1);
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  const contribution = {
    id: `contribution-${randomUUID()}`,
    memberId: member.id,
    amountCents: cents(body.amount),
    dueDate: asDate(body.dueDate),
    paidDate: body.paidDate ? asDate(body.paidDate) : null,
    status: body.paidDate ? "paid" : contributionStatus(null, asDate(body.dueDate)),
    method: body.method,
    createdAt: new Date(),
  };
  await db.insert(contributions).values(contribution);
  await recordActivity("Contribution recorded", `${member.name} · R${body.amount.toFixed(2)}`, "contribution");
  res.status(201).json(RecordContributionResponse.parse(contributionView(contribution, member.name)));
});

router.get("/claims", async (req, res) => {
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
      (!search ||
        claim.claimNumber.toLowerCase().includes(search) ||
        claim.deceasedName.toLowerCase().includes(search) ||
        member.name.toLowerCase().includes(search))
    );
  });
  res.json(ListClaimsResponse.parse(visible.map(({ claim, member }) => claimView(claim, member.name))));
});

router.post("/claims", async (req, res) => {
  const body = CreateClaimBody.parse(req.body);
  const [member] = await db.select().from(members).where(eq(members.id, body.memberId)).limit(1);
  if (!member) {
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
    status: "submitted",
    notes: body.notes,
    updatedAt: new Date(),
  };
  await db.insert(claims).values(claim);
  await recordActivity("New claim submitted", `${claim.claimNumber} · ${member.name}`, "claim");
  res.status(201).json(CreateClaimResponse.parse(claimView(claim, member.name)));
});

router.patch("/claims/:claimId", async (req, res) => {
  const params = UpdateClaimParams.parse(req.params);
  const body = UpdateClaimBody.parse(req.body);
  const [existing] = await db.select().from(claims).where(eq(claims.id, params.claimId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  await db.update(claims).set({ ...body, updatedAt: new Date() }).where(eq(claims.id, existing.id));
  const [member] = await db.select().from(members).where(eq(members.id, existing.memberId)).limit(1);
  await recordActivity("Claim status updated", `${existing.claimNumber} · ${body.status ?? existing.status}`, "claim");
  res.json(UpdateClaimResponse.parse(claimView({ ...existing, ...body }, member?.name)));
});

export default router;