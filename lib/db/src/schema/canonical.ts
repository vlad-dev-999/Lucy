import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mmfImportsTable } from "./mmf";

export const legacyItemsTable = pgTable(
  "legacy_items",
  {
    id: text("id").primaryKey(),
    importId: text("import_id")
      .notNull()
      .references(() => mmfImportsTable.id, { onDelete: "restrict" }),
    sourceWorksheet: text("source_worksheet").notNull(),
    sourceRow: integer("source_row").notNull(),
    systemId: text("system_id"),
    identifier: text("identifier"),
    nomenclature: text("nomenclature"),
    specification: text("specification"),
    unit: text("unit"),
    pvms: text("pvms"),
    niv: text("niv"),
    previousPvmsMmf: doublePrecision("previous_pvms_mmf"),
    currentPvmsMmf: doublePrecision("current_pvms_mmf"),
    previousDglpMmf: doublePrecision("previous_dglp_mmf"),
    currentDglpMmf: doublePrecision("current_dglp_mmf"),
    previousEchsMmf: doublePrecision("previous_echs_mmf"),
    currentEchsMmf: doublePrecision("current_echs_mmf"),
    lpr: text("lpr"),
    sourceValues: jsonb("source_values").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    importRowUnique: uniqueIndex("legacy_items_import_row_unique").on(
      table.importId,
      table.sourceRow,
    ),
  }),
);

export const departmentEntitiesTable = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  sourceColumnStart: integer("source_column_start").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const legacyItemDepartmentsTable = pgTable(
  "legacy_item_departments",
  {
    id: text("id").primaryKey(),
    legacyItemId: text("legacy_item_id")
      .notNull()
      .references(() => legacyItemsTable.id, { onDelete: "restrict" }),
    departmentId: text("department_id")
      .notNull()
      .references(() => departmentEntitiesTable.id, { onDelete: "restrict" }),
    pvms: text("pvms"),
    dglp: doublePrecision("dglp"),
    echs: doublePrecision("echs"),
  },
  (table) => ({
    itemDepartmentUnique: uniqueIndex("legacy_item_departments_unique").on(
      table.legacyItemId,
      table.departmentId,
    ),
  }),
);

export const canonicalItemsTable = pgTable("canonical_items", {
  id: text("id").primaryKey(),
  canonicalNumber: integer("canonical_number")
    .generatedAlwaysAsIdentity()
    .notNull()
    .unique(),
  nomenclature: text("nomenclature"),
  unit: text("unit"),
  pvms: text("pvms"),
  niv: text("niv"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const departmentItemAssignmentsTable = pgTable(
  "department_item_assignments",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id")
      .notNull()
      .references(() => departmentEntitiesTable.id, { onDelete: "restrict" }),
    canonicalItemId: text("canonical_item_id")
      .notNull()
      .references(() => canonicalItemsTable.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("ACTIVE"),
    sourceImportId: text("source_import_id").references(() => mmfImportsTable.id, {
      onDelete: "restrict",
    }),
    source: text("source"),
    currentDglpMmf: doublePrecision("current_dglp_mmf"),
    currentEchsMmf: doublePrecision("current_echs_mmf"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    departmentCanonicalUnique: uniqueIndex("department_item_assignments_unique").on(
      table.departmentId,
      table.canonicalItemId,
    ),
  }),
);

export const departmentMmfRevisionsTable = pgTable(
  "department_mmf_revisions",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id")
      .notNull()
      .references(() => departmentEntitiesTable.id, { onDelete: "restrict" }),
    canonicalItemId: text("canonical_item_id")
      .notNull()
      .references(() => canonicalItemsTable.id, { onDelete: "restrict" }),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => departmentItemAssignmentsTable.id, { onDelete: "restrict" }),
    previousDglpMmf: doublePrecision("previous_dglp_mmf"),
    newDglpMmf: doublePrecision("new_dglp_mmf"),
    previousEchsMmf: doublePrecision("previous_echs_mmf"),
    newEchsMmf: doublePrecision("new_echs_mmf"),
    changedBy: text("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

// Common-use quantities are deliberately not stored on department assignments.
// A hospital quantity is an alternative scope, not another departmental value to sum.
export const commonUseMmfTable = pgTable(
  "common_use_mmf",
  {
    id: text("id").primaryKey(),
    canonicalItemId: text("canonical_item_id").notNull().references(() => canonicalItemsTable.id, { onDelete: "restrict" }),
    currentDglpMmf: doublePrecision("current_dglp_mmf"),
    currentEchsMmf: doublePrecision("current_echs_mmf"),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({ commonUseCanonicalUnique: uniqueIndex("common_use_mmf_canonical_unique").on(table.canonicalItemId) }),
);

export const itemProposalsTable = pgTable("item_proposals", {
  id: text("id").primaryKey(),
  departmentId: text("department_id").notNull().references(() => departmentEntitiesTable.id, { onDelete: "restrict" }),
  nomenclature: text("nomenclature").notNull(),
  specification: text("specification").notNull(),
  unit: text("unit").notNull(),
  pvms: text("pvms"),
  niv: text("niv"),
  proposedDglpMmf: doublePrecision("proposed_dglp_mmf"),
  proposedEchsMmf: doublePrecision("proposed_echs_mmf"),
  justification: text("justification").notNull(),
  proposer: text("proposer").notNull(),
  status: text("status").notNull().default("PENDING"),
  reviewer: text("reviewer"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const departmentSubmissionsTable = pgTable(
  "department_submissions",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id").notNull().references(() => departmentEntitiesTable.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("SUBMITTED"),
    submittedBy: text("submitted_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    assignmentCount: integer("assignment_count").notNull(),
  },
  (table) => ({ departmentSubmissionUnique: uniqueIndex("department_submissions_department_unique").on(table.departmentId) }),
);

export const legacyCanonicalLineageTable = pgTable(
  "legacy_canonical_lineage",
  {
    id: text("id").primaryKey(),
    legacyItemId: text("legacy_item_id")
      .notNull()
      .references(() => legacyItemsTable.id, { onDelete: "restrict" }),
    canonicalItemId: text("canonical_item_id")
      .notNull()
      .references(() => canonicalItemsTable.id, { onDelete: "restrict" }),
    relationship: text("relationship").notNull().default("source"),
    decision: text("decision"),
    reviewer: text("reviewer"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    legacyLineageUnique: uniqueIndex("legacy_canonical_lineage_legacy_unique").on(
      table.legacyItemId,
    ),
  }),
);

export const vocabularyReviewsTable = pgTable("vocabulary_reviews", {
  id: text("id").primaryKey(),
  importId: text("import_id")
    .notNull()
    .references(() => mmfImportsTable.id, { onDelete: "restrict" }),
  reviewType: text("review_type").notNull(),
  identifier: text("identifier"),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  status: text("status").notNull().default("open"),
  decision: text("decision"),
  decisionNote: text("decision_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vocabularyReviewCandidatesTable = pgTable(
  "vocabulary_review_candidates",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => vocabularyReviewsTable.id, { onDelete: "restrict" }),
    legacyItemId: text("legacy_item_id")
      .notNull()
      .references(() => legacyItemsTable.id, { onDelete: "restrict" }),
  },
  (table) => ({
    reviewCandidateUnique: uniqueIndex("vocabulary_review_candidate_unique").on(
      table.reviewId,
      table.legacyItemId,
    ),
  }),
);

export const insertLegacyItemSchema = createInsertSchema(legacyItemsTable);
export type InsertLegacyItem = z.infer<typeof insertLegacyItemSchema>;
export type LegacyItem = typeof legacyItemsTable.$inferSelect;
export type DepartmentEntity = typeof departmentEntitiesTable.$inferSelect;
export type LegacyItemDepartment = typeof legacyItemDepartmentsTable.$inferSelect;
export type CanonicalItem = typeof canonicalItemsTable.$inferSelect;
export type DepartmentItemAssignment = typeof departmentItemAssignmentsTable.$inferSelect;
export type DepartmentMmfRevision = typeof departmentMmfRevisionsTable.$inferSelect;
export type CommonUseMmf = typeof commonUseMmfTable.$inferSelect;
export type ItemProposal = typeof itemProposalsTable.$inferSelect;
export type DepartmentSubmission = typeof departmentSubmissionsTable.$inferSelect;
export type LegacyCanonicalLineage = typeof legacyCanonicalLineageTable.$inferSelect;
export type VocabularyReview = typeof vocabularyReviewsTable.$inferSelect;
export type VocabularyReviewCandidate =
  typeof vocabularyReviewCandidatesTable.$inferSelect;
