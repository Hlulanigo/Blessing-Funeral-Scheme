import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const branches = pgTable("branches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey(),
  defaultPlanName: text("default_plan_name").notNull(),
  monthlyContributionCents: integer("monthly_contribution_cents").notNull(),
  gracePeriodDays: integer("grace_period_days").notNull().default(7),
  contributionReminders: boolean("contribution_reminders").notNull().default(true),
  requireClaimReview: boolean("require_claim_review").notNull().default(true),
  updatedAt: updatedAt(),
});

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),
  authUserId: text("auth_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }).unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("coordinator"),
  branchId: text("branch_id").references(() => branches.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  monthlyContributionCents: integer("monthly_contribution_cents").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  memberNumber: text("member_number").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  idNumber: text("id_number").notNull(),
  branchId: text("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "restrict" }),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "restrict" }),
  monthlyContributionCents: integer("monthly_contribution_cents").notNull().default(0),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  nextContributionDate: timestamp("next_contribution_date", {
    withTimezone: true,
  }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const beneficiaries = pgTable("beneficiaries", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  phone: text("phone").notNull(),
  allocation: integer("allocation").notNull().default(100),
  primary: boolean("primary").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contributions = pgTable("contributions", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  paidDate: timestamp("paid_date", { withTimezone: true }),
  status: text("status").notNull(),
  method: text("method").notNull(),
  createdAt: createdAt(),
});

export const claims = pgTable("claims", {
  id: text("id").primaryKey(),
  claimNumber: text("claim_number").notNull().unique(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  deceasedName: text("deceased_name").notNull(),
  relationship: text("relationship").notNull(),
  amountCents: integer("amount_cents").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("submitted"),
  notes: text("notes").notNull().default(""),
  updatedAt: updatedAt(),
});

export const claimDocuments = pgTable("claim_documents", {
  id: text("id").primaryKey(),
  claimId: text("claim_id")
    .notNull()
    .references(() => claims.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  dataBase64: text("data_base64").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const activity = pgTable("activity", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  type: text("type").notNull(),
  createdAt: createdAt(),
});

export type BranchRecord = typeof branches.$inferSelect;
export type StaffRecord = typeof staff.$inferSelect;
export type PlanRecord = typeof plans.$inferSelect;
export type MemberRecord = typeof members.$inferSelect;
export type BeneficiaryRecord = typeof beneficiaries.$inferSelect;
export type ContributionRecord = typeof contributions.$inferSelect;
export type ClaimRecord = typeof claims.$inferSelect;
export type ClaimDocumentRecord = typeof claimDocuments.$inferSelect;
export type ActivityRecord = typeof activity.$inferSelect;

export * from "./auth";