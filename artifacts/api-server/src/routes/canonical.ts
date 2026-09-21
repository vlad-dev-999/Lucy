import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  CreateCanonicalItemBody,
  CreateCanonicalItemResponse,
  CreateDepartmentAssignmentBody,
  CreateDepartmentAssignmentResponse,
  DecideVocabularyReviewBody,
  DecideVocabularyReviewParams,
  DecideVocabularyReviewResponse,
  GetCanonicalItemParams,
  GetCanonicalItemResponse,
  ListDepartmentAssignmentsParams,
  ListDepartmentAssignmentsResponse,
  ListCanonicalItemsQueryParams,
  ListCanonicalItemsResponse,
  ListVocabularyReviewsQueryParams,
  ListVocabularyReviewsResponse,
  UpdateDepartmentAssignmentBody,
  UpdateDepartmentAssignmentParams,
  UpdateDepartmentAssignmentResponse,
  UpdateDepartmentAssignmentMmfBody,
  UpdateDepartmentAssignmentMmfParams,
  UpdateDepartmentAssignmentMmfResponse,
  type DepartmentInput,
  type ImportInput,
  type LegacyRowInput,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  canonicalItemsTable,
  departmentItemAssignmentsTable,
  departmentMmfRevisionsTable,
  departmentEntitiesTable,
  departmentSubmissionsTable,
  legacyCanonicalLineageTable,
  legacyItemDepartmentsTable,
  legacyItemsTable,
  mmfImportsTable,
  vocabularyReviewCandidatesTable,
  vocabularyReviewsTable,
} from "@workspace/db/schema";

const router: IRouter = Router();

async function isDepartmentSubmitted(departmentId: string) {
  const [submission] = await db.select({ id: departmentSubmissionsTable.id }).from(departmentSubmissionsTable)
    .where(eq(departmentSubmissionsTable.departmentId, departmentId)).limit(1);
  return Boolean(submission);
}

type LegacyRecordWithDepartments = {
  id: string;
  importId: string;
  sourceWorksheet: string;
  sourceRow: number;
  systemId: string | null;
  identifier: string | null;
  nomenclature: string | null;
  specification: string | null;
  unit: string | null;
  pvms: string | null;
  niv: string | null;
  previousPvmsMmf: number | null;
  currentPvmsMmf: number | null;
  previousDglpMmf: number | null;
  currentDglpMmf: number | null;
  previousEchsMmf: number | null;
  currentEchsMmf: number | null;
  lpr: string | null;
  sourceValues: unknown[];
  departments: {
    name: string;
    pvms: string | null;
    dglp: number | null;
    echs: number | null;
  }[];
};

function canonicalCode(canonicalNumber: number) {
  return `CAN-${String(canonicalNumber).padStart(6, "0")}`;
}

function nullableString(value: string | null | undefined) {
  return value ?? null;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLocaleLowerCase() ?? "";
}

function splitIdentifier(identifier: string | null | undefined) {
  const value = nullableString(identifier);
  return {
    pvms: value && /^pvms(?:[/:\s]|$)/i.test(value) ? value : null,
    niv: value && /^niv(?:[/:\s]|$)/i.test(value) ? value : null,
  };
}

function legacySignature(row: LegacyRowInput) {
  const identifiers = splitIdentifier(row.identifier);
  return [
    normalizeText(row.identifier),
    normalizeText(row.nomenclature),
    normalizeText(row.specification),
    normalizeText(row.unit),
    normalizeText(row.pvms ?? identifiers.pvms),
    normalizeText(row.niv ?? identifiers.niv),
    row.previousPvmsMmf ?? "",
    row.currentPvmsMmf ?? "",
    row.previousDglpMmf ?? "",
    row.currentDglpMmf ?? "",
    row.previousEchsMmf ?? "",
    row.currentEchsMmf ?? "",
    normalizeText(row.lpr),
  ].join("|");
}

function reviewId(importId: string, reviewType: string, candidateIds: string[]) {
  const digest = createHash("sha256")
    .update(`${reviewType}|${candidateIds.slice().sort().join("|")}`)
    .digest("hex")
    .slice(0, 16);
  return `review_${importId}_${reviewType.toLowerCase()}_${digest}`;
}

function fallbackLegacyRows(input: ImportInput): LegacyRowInput[] {
  return input.previewRows.map((row) => ({
    sourceRow: row.sourceRow,
    systemId: row.systemId,
    identifier: row.identifier,
    nomenclature: row.nomenclature,
    specification: null,
    unit: row.unit,
    pvms: splitIdentifier(row.identifier).pvms,
    niv: splitIdentifier(row.identifier).niv,
    currentDglpMmf: row.currentDglp,
    currentEchsMmf: row.currentEchs,
    sourceValues: [
      row.systemId,
      row.identifier,
      row.nomenclature,
      row.unit,
      null,
      null,
      null,
      row.currentDglp,
      null,
      row.currentEchs,
    ],
    departments: [],
  }));
}

async function getLegacyRecord(id: string): Promise<LegacyRecordWithDepartments | null> {
  const [item] = await db
    .select()
    .from(legacyItemsTable)
    .where(eq(legacyItemsTable.id, id))
    .limit(1);
  if (!item) return null;

  const departmentRows = await db
    .select({
      name: departmentEntitiesTable.name,
      pvms: legacyItemDepartmentsTable.pvms,
      dglp: legacyItemDepartmentsTable.dglp,
      echs: legacyItemDepartmentsTable.echs,
    })
    .from(legacyItemDepartmentsTable)
    .innerJoin(
      departmentEntitiesTable,
      eq(legacyItemDepartmentsTable.departmentId, departmentEntitiesTable.id),
    )
    .where(eq(legacyItemDepartmentsTable.legacyItemId, id))
    .orderBy(asc(departmentEntitiesTable.sourceColumnStart));

  return { ...item, sourceValues: item.sourceValues as unknown[], departments: departmentRows };
}

async function getLegacyRecords(ids: string[]) {
  const records = await Promise.all(ids.map((id) => getLegacyRecord(id)));
  return records.filter((record): record is LegacyRecordWithDepartments => Boolean(record));
}

async function getReviewCandidateRecords(reviewId: string) {
  const candidates = await db
    .select({ legacyItemId: vocabularyReviewCandidatesTable.legacyItemId })
    .from(vocabularyReviewCandidatesTable)
    .where(eq(vocabularyReviewCandidatesTable.reviewId, reviewId));
  return getLegacyRecords(candidates.map((candidate) => candidate.legacyItemId));
}

type DepartmentAssignmentRow = {
  id: string;
  departmentId: string;
  departmentName: string;
  canonicalItemId: string;
  canonicalNumber: number;
  nomenclature: string | null;
  pvms: string | null;
  niv: string | null;
  unit: string | null;
  status: string;
  sourceImportId: string | null;
  source: string | null;
  currentDglpMmf: number | null;
  currentEchsMmf: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDepartmentAssignmentResponse(row: DepartmentAssignmentRow) {
  return {
    id: row.id,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    canonicalItemId: row.canonicalItemId,
    canonicalId: canonicalCode(row.canonicalNumber),
    nomenclature: row.nomenclature,
    pvms: row.pvms,
    niv: row.niv,
    unit: row.unit,
    status: row.status,
    sourceImportId: row.sourceImportId,
    source: row.source,
    currentDglpMmf: row.currentDglpMmf,
    currentEchsMmf: row.currentEchsMmf,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getDepartmentAssignment(id: string) {
  const [row] = await db
    .select({
      id: departmentItemAssignmentsTable.id,
      departmentId: departmentItemAssignmentsTable.departmentId,
      departmentName: departmentEntitiesTable.name,
      canonicalItemId: departmentItemAssignmentsTable.canonicalItemId,
      canonicalNumber: canonicalItemsTable.canonicalNumber,
      nomenclature: canonicalItemsTable.nomenclature,
      pvms: canonicalItemsTable.pvms,
      niv: canonicalItemsTable.niv,
      unit: canonicalItemsTable.unit,
      status: departmentItemAssignmentsTable.status,
      sourceImportId: departmentItemAssignmentsTable.sourceImportId,
      source: departmentItemAssignmentsTable.source,
      currentDglpMmf: departmentItemAssignmentsTable.currentDglpMmf,
      currentEchsMmf: departmentItemAssignmentsTable.currentEchsMmf,
      createdAt: departmentItemAssignmentsTable.createdAt,
      updatedAt: departmentItemAssignmentsTable.updatedAt,
    })
    .from(departmentItemAssignmentsTable)
    .innerJoin(
      departmentEntitiesTable,
      eq(departmentItemAssignmentsTable.departmentId, departmentEntitiesTable.id),
    )
    .innerJoin(
      canonicalItemsTable,
      eq(departmentItemAssignmentsTable.canonicalItemId, canonicalItemsTable.id),
    )
    .where(eq(departmentItemAssignmentsTable.id, id))
    .limit(1);
  return row ? toDepartmentAssignmentResponse(row) : null;
}

async function listAssignmentsForCanonical(canonicalItemId: string) {
  const rows = await db
    .select({
      id: departmentItemAssignmentsTable.id,
      departmentId: departmentItemAssignmentsTable.departmentId,
      departmentName: departmentEntitiesTable.name,
      canonicalItemId: departmentItemAssignmentsTable.canonicalItemId,
      canonicalNumber: canonicalItemsTable.canonicalNumber,
      nomenclature: canonicalItemsTable.nomenclature,
      pvms: canonicalItemsTable.pvms,
      niv: canonicalItemsTable.niv,
      unit: canonicalItemsTable.unit,
      status: departmentItemAssignmentsTable.status,
      sourceImportId: departmentItemAssignmentsTable.sourceImportId,
      source: departmentItemAssignmentsTable.source,
      currentDglpMmf: departmentItemAssignmentsTable.currentDglpMmf,
      currentEchsMmf: departmentItemAssignmentsTable.currentEchsMmf,
      createdAt: departmentItemAssignmentsTable.createdAt,
      updatedAt: departmentItemAssignmentsTable.updatedAt,
    })
    .from(departmentItemAssignmentsTable)
    .innerJoin(
      departmentEntitiesTable,
      eq(departmentItemAssignmentsTable.departmentId, departmentEntitiesTable.id),
    )
    .innerJoin(
      canonicalItemsTable,
      eq(departmentItemAssignmentsTable.canonicalItemId, canonicalItemsTable.id),
    )
    .where(eq(departmentItemAssignmentsTable.canonicalItemId, canonicalItemId))
    .orderBy(asc(departmentEntitiesTable.name));
  return rows.map(toDepartmentAssignmentResponse);
}

async function listAssignmentsForDepartment(departmentId: string) {
  const rows = await db
    .select({
      id: departmentItemAssignmentsTable.id,
      departmentId: departmentItemAssignmentsTable.departmentId,
      departmentName: departmentEntitiesTable.name,
      canonicalItemId: departmentItemAssignmentsTable.canonicalItemId,
      canonicalNumber: canonicalItemsTable.canonicalNumber,
      nomenclature: canonicalItemsTable.nomenclature,
      pvms: canonicalItemsTable.pvms,
      niv: canonicalItemsTable.niv,
      unit: canonicalItemsTable.unit,
      status: departmentItemAssignmentsTable.status,
      sourceImportId: departmentItemAssignmentsTable.sourceImportId,
      source: departmentItemAssignmentsTable.source,
      currentDglpMmf: departmentItemAssignmentsTable.currentDglpMmf,
      currentEchsMmf: departmentItemAssignmentsTable.currentEchsMmf,
      createdAt: departmentItemAssignmentsTable.createdAt,
      updatedAt: departmentItemAssignmentsTable.updatedAt,
    })
    .from(departmentItemAssignmentsTable)
    .innerJoin(
      departmentEntitiesTable,
      eq(departmentItemAssignmentsTable.departmentId, departmentEntitiesTable.id),
    )
    .innerJoin(
      canonicalItemsTable,
      eq(departmentItemAssignmentsTable.canonicalItemId, canonicalItemsTable.id),
    )
    .where(
      and(
        eq(departmentItemAssignmentsTable.departmentId, departmentId),
        eq(departmentItemAssignmentsTable.status, "ACTIVE"),
      ),
    )
    .orderBy(asc(canonicalItemsTable.canonicalNumber));
  return rows.map(toDepartmentAssignmentResponse);
}

async function toReviewResponse(review: typeof vocabularyReviewsTable.$inferSelect) {
  return {
    id: review.id,
    importId: review.importId,
    reviewType: review.reviewType,
    identifier: review.identifier,
    title: review.title,
    detail: review.detail,
    status: review.status,
    decision: review.decision,
    decisionNote: review.decisionNote,
    candidateRecords: await getReviewCandidateRecords(review.id),
  };
}

async function toCanonicalDetail(canonical: typeof canonicalItemsTable.$inferSelect) {
  const lineage = await db
    .select({ legacyItemId: legacyCanonicalLineageTable.legacyItemId })
    .from(legacyCanonicalLineageTable)
    .where(eq(legacyCanonicalLineageTable.canonicalItemId, canonical.id));
  const lineageDetails = await db
    .select({
      legacyItemId: legacyCanonicalLineageTable.legacyItemId,
      relationship: legacyCanonicalLineageTable.relationship,
      decision: legacyCanonicalLineageTable.decision,
      reviewer: legacyCanonicalLineageTable.reviewer,
      reviewedAt: legacyCanonicalLineageTable.reviewedAt,
      reason: legacyCanonicalLineageTable.reason,
    })
    .from(legacyCanonicalLineageTable)
    .where(eq(legacyCanonicalLineageTable.canonicalItemId, canonical.id));
  const legacyRecords = await getLegacyRecords(lineage.map((item) => item.legacyItemId));
  const lineageByLegacyItemId = new Map(
    lineageDetails.map((item) => [item.legacyItemId, item]),
  );
  const legacyRecordsWithLineage = legacyRecords.map((record) => {
    const lineageDetail = lineageByLegacyItemId.get(record.id);
    return {
      ...record,
      relationship: lineageDetail?.relationship ?? "source",
      decision: lineageDetail?.decision ?? null,
      reviewer: lineageDetail?.reviewer ?? null,
      reviewedAt: lineageDetail?.reviewedAt?.toISOString() ?? null,
      reason: lineageDetail?.reason ?? null,
    };
  });
  const reviews = legacyRecords.length
    ? await db
        .select({
          id: vocabularyReviewsTable.id,
          reviewType: vocabularyReviewsTable.reviewType,
          status: vocabularyReviewsTable.status,
          title: vocabularyReviewsTable.title,
          detail: vocabularyReviewsTable.detail,
        })
        .from(vocabularyReviewCandidatesTable)
        .innerJoin(
          vocabularyReviewsTable,
          eq(vocabularyReviewCandidatesTable.reviewId, vocabularyReviewsTable.id),
        )
        .where(inArray(vocabularyReviewCandidatesTable.legacyItemId, lineage.map((item) => item.legacyItemId)))
    : [];
  const departmentNames = new Set(
    legacyRecords.flatMap((record) => record.departments.map((department) => department.name)),
  );
  const assignments = await listAssignmentsForCanonical(canonical.id);

  return {
    id: canonical.id,
    canonicalId: canonicalCode(canonical.canonicalNumber),
    nomenclature: canonical.nomenclature,
    unit: canonical.unit,
    pvms: canonical.pvms,
    niv: canonical.niv,
    status: canonical.status,
    legacyRecordCount: legacyRecords.length,
    departmentCount: departmentNames.size,
    legacyRecords: legacyRecordsWithLineage,
    vocabularyHistory: reviews,
    assignments,
  };
}

export async function persistImportLineage(
  importRecord: typeof mmfImportsTable.$inferSelect,
  input: ImportInput,
) {
  const rows = input.legacyRows?.length ? input.legacyRows : fallbackLegacyRows(input);
  const departments = input.departments ?? [];
  const departmentMap = new Map<number, string>();

  for (const [index, department] of departments.entries()) {
    const existingDepartment = await db
      .select()
      .from(departmentEntitiesTable)
      .where(eq(departmentEntitiesTable.name, department.name))
      .limit(1);
    const entity =
      existingDepartment[0] ??
      (
        await db
          .insert(departmentEntitiesTable)
          .values({
            id: `dept_${crypto.randomUUID()}`,
            name: department.name,
            sourceColumnStart: department.sourceColumnStart,
          })
          .onConflictDoNothing({ target: departmentEntitiesTable.name })
          .returning()
      )[0];
    if (entity) departmentMap.set(index, entity.id);
  }

  const legacyValues = rows.map((row) => ({
    id: `legacy_${importRecord.id}_${row.sourceRow}`,
    importId: importRecord.id,
    sourceWorksheet: importRecord.worksheetName,
    sourceRow: row.sourceRow,
    systemId: nullableString(row.systemId),
    identifier: nullableString(row.identifier),
    nomenclature: nullableString(row.nomenclature),
    specification: nullableString(row.specification),
    unit: nullableString(row.unit),
    pvms: nullableString(row.pvms ?? splitIdentifier(row.identifier).pvms),
    niv: nullableString(row.niv ?? splitIdentifier(row.identifier).niv),
    previousPvmsMmf: row.previousPvmsMmf ?? null,
    currentPvmsMmf: row.currentPvmsMmf ?? null,
    previousDglpMmf: row.previousDglpMmf ?? null,
    currentDglpMmf: row.currentDglpMmf ?? null,
    previousEchsMmf: row.previousEchsMmf ?? null,
    currentEchsMmf: row.currentEchsMmf ?? null,
    lpr: nullableString(row.lpr),
    sourceValues: row.sourceValues,
  }));

  if (legacyValues.length) {
    await db.insert(legacyItemsTable).values(legacyValues).onConflictDoNothing();
  }

  const departmentValues = rows.flatMap((row) =>
    row.departments.flatMap((department) => {
      const departmentId = departmentMap.get(department.departmentIndex);
      if (!departmentId) return [];
      return [
        {
          id: `legacy_dept_${importRecord.id}_${row.sourceRow}_${department.departmentIndex}`,
          legacyItemId: `legacy_${importRecord.id}_${row.sourceRow}`,
          departmentId,
          pvms: nullableString(department.pvms),
          dglp: department.dglp ?? null,
          echs: department.echs ?? null,
        },
      ];
    }),
  );
  if (departmentValues.length) {
    await db.insert(legacyItemDepartmentsTable).values(departmentValues).onConflictDoNothing();
  }

  const persistedRows = await db
    .select()
    .from(legacyItemsTable)
    .where(eq(legacyItemsTable.importId, importRecord.id));
  const persistedBySourceRow = new Map(persistedRows.map((row) => [row.sourceRow, row]));

  type ReviewCandidate = {
    reviewType:
      | "EXACT_DUPLICATE"
      | "PROBABLE_DUPLICATE"
      | "IDENTIFIER_CONFLICT"
      | "MISSING_IDENTIFIER"
      | "OBSOLETE_CANDIDATE"
      | "NEW_ITEM";
    candidateIds: string[];
    identifier?: string | null;
    title: string;
    detail: string;
  };

  const reviewCandidates: ReviewCandidate[] = [];
  const byIdentifier = new Map<string, LegacyRowInput[]>();
  const byDescription = new Map<string, LegacyRowInput[]>();
  const missingRows: LegacyRowInput[] = [];

  for (const row of rows) {
    const identifier = normalizeText(row.identifier);
    if (!identifier) {
      missingRows.push(row);
    } else {
      const group = byIdentifier.get(identifier) ?? [];
      group.push(row);
      byIdentifier.set(identifier, group);
    }
    const descriptionKey = [
      normalizeText(row.nomenclature),
      normalizeText(row.specification),
      normalizeText(row.unit),
    ].join("|");
    if (descriptionKey !== "||") {
      const group = byDescription.get(descriptionKey) ?? [];
      group.push(row);
      byDescription.set(descriptionKey, group);
    }
  }

  const legacyIdForRow = (row: LegacyRowInput) => persistedBySourceRow.get(row.sourceRow)?.id;
  const candidateIdsForRows = (candidateRows: LegacyRowInput[]) =>
    candidateRows.map(legacyIdForRow).filter((id): id is string => Boolean(id));

  for (const [identifier, group] of byIdentifier) {
    if (group.length < 2) continue;
    const candidateIds = candidateIdsForRows(group);
    const exact = new Set(group.map(legacySignature)).size === 1;
    reviewCandidates.push({
      reviewType: exact ? "EXACT_DUPLICATE" : "IDENTIFIER_CONFLICT",
      candidateIds,
      identifier: group[0].identifier ?? identifier,
      title: exact
        ? `${group.length} rows repeat the same legacy item`
        : `${group[0].identifier ?? identifier} maps to different descriptions`,
      detail: exact
        ? "The source contains identical legacy rows. Keep each source row for lineage and review before consolidation."
        : "Matching identifiers are not proof of clinical equivalence. Keep the records separate until a human reviewer decides.",
    });
  }

  for (const [description, group] of byDescription) {
    const identifiers = new Set(group.map((row) => normalizeText(row.identifier)).filter(Boolean));
    if (group.length < 2 || identifiers.size < 2) continue;
    const candidateIds = candidateIdsForRows(group);
    reviewCandidates.push({
      reviewType: "PROBABLE_DUPLICATE",
      candidateIds,
      identifier: group[0].identifier ?? null,
      title: "Rows share a description but use different identifiers",
      detail: `Rows with the normalized description "${description.split("|")[0] || "unnamed item"}" may represent the same item. Human review is required before clinical equivalence is accepted.`,
    });
  }

  if (missingRows.length) {
    reviewCandidates.push({
      reviewType: "MISSING_IDENTIFIER",
      candidateIds: candidateIdsForRows(missingRows),
      identifier: null,
      title: `${missingRows.length} row${missingRows.length === 1 ? "" : "s"} have no PVMS/NIV identifier`,
      detail: "Blank identifiers are review warnings. Preserve the source rows and assign canonical identity only after review.",
    });
  }

  const priorImport = (
    await db
      .select({ id: mmfImportsTable.id })
      .from(mmfImportsTable)
      .where(and(eq(mmfImportsTable.status, "committed"), ne(mmfImportsTable.id, importRecord.id)))
      .orderBy(desc(mmfImportsTable.createdAt))
      .limit(1)
  )[0];
  const priorRows = priorImport
    ? await db
        .select()
        .from(legacyItemsTable)
        .where(eq(legacyItemsTable.importId, priorImport.id))
    : [];
  const priorIdentifiers = new Set(
    priorRows.map((row) => normalizeText(row.identifier)).filter(Boolean),
  );
  const newRows = rows.filter((row) => {
    const identifier = normalizeText(row.identifier);
    return Boolean(identifier) && !priorIdentifiers.has(identifier);
  });
  if (newRows.length) {
    reviewCandidates.push({
      reviewType: "NEW_ITEM",
      candidateIds: candidateIdsForRows(newRows),
      identifier: newRows.length === 1 ? newRows[0].identifier ?? null : null,
      title: `${newRows.length} new legacy item${newRows.length === 1 ? "" : "s"} detected`,
      detail: "These identifiers were not present in the latest committed import. Create or relate canonical items only after review.",
    });
  }

  const currentIdentifiers = new Set(
    rows.map((row) => normalizeText(row.identifier)).filter(Boolean),
  );
  const obsoleteRows = priorRows.filter((row) => {
    const identifier = normalizeText(row.identifier);
    return Boolean(identifier) && !currentIdentifiers.has(identifier);
  });
  if (obsoleteRows.length) {
    reviewCandidates.push({
      reviewType: "OBSOLETE_CANDIDATE",
      candidateIds: obsoleteRows.map((row) => row.id),
      identifier: null,
      title: `${obsoleteRows.length} prior legacy item${obsoleteRows.length === 1 ? "" : "s"} absent from this import`,
      detail: "These records were present in the latest committed import but are absent from the new source. Do not delete them; review whether they are obsolete.",
    });
  }

  for (const candidate of reviewCandidates.filter((item) => item.candidateIds.length)) {
    const id = reviewId(importRecord.id, candidate.reviewType, candidate.candidateIds);
    const [review] = await db
      .insert(vocabularyReviewsTable)
      .values({
        id,
        importId: importRecord.id,
        reviewType: candidate.reviewType,
        identifier: candidate.identifier ?? null,
        title: candidate.title,
        detail: candidate.detail,
      })
      .onConflictDoNothing({ target: vocabularyReviewsTable.id })
      .returning();
    if (review) {
      await db
        .insert(vocabularyReviewCandidatesTable)
        .values(
          candidate.candidateIds.map((legacyItemId) => ({
            id: `review_candidate_${review.id}_${legacyItemId}`,
            reviewId: review.id,
            legacyItemId,
          })),
        )
        .onConflictDoNothing();
    }
  }
}

async function createCanonicalFromLegacyIds(
  legacyItemIds: string[],
  overrides: {
    nomenclature?: string | null;
    unit?: string | null;
    pvms?: string | null;
    niv?: string | null;
  } = {},
  reviewMetadata: {
    decision?: string | null;
    reviewer?: string | null;
    reason?: string | null;
  } = {},
) {
  const uniqueIds = Array.from(new Set(legacyItemIds));
  const legacyRecords = await getLegacyRecords(uniqueIds);
  if (legacyRecords.length !== uniqueIds.length) {
    throw new Error("One or more legacy records were not found");
  }
  const linked = await db
    .select({ legacyItemId: legacyCanonicalLineageTable.legacyItemId })
    .from(legacyCanonicalLineageTable)
    .where(inArray(legacyCanonicalLineageTable.legacyItemId, uniqueIds));
  if (linked.length) {
    const error = new Error("A legacy record is already linked to a canonical item");
    error.name = "ALREADY_LINKED";
    throw error;
  }

  const first = legacyRecords[0];
  const firstIdentifiers = splitIdentifier(first.identifier);
  const [canonical] = await db
    .insert(canonicalItemsTable)
    .values({
      id: `canonical_${crypto.randomUUID()}`,
      nomenclature: overrides.nomenclature ?? first.nomenclature,
      unit: overrides.unit ?? first.unit,
      pvms: overrides.pvms ?? first.pvms ?? firstIdentifiers.pvms,
      niv: overrides.niv ?? first.niv ?? firstIdentifiers.niv,
    })
    .returning();
  if (!canonical) throw new Error("Canonical item could not be created");
  await db.insert(legacyCanonicalLineageTable).values(
    uniqueIds.map((legacyItemId) => ({
      id: `lineage_${crypto.randomUUID()}`,
      legacyItemId,
      canonicalItemId: canonical.id,
      relationship: "source",
      decision: reviewMetadata.decision ?? null,
      reviewer: reviewMetadata.reviewer ?? null,
      reviewedAt: reviewMetadata.decision ? new Date() : null,
      reason: reviewMetadata.reason ?? null,
    })),
  );
  return toCanonicalDetail(canonical);
}

async function updateLineage(
  legacyItemIds: string[],
  canonicalItemId: string,
  reviewMetadata: {
    decision?: string | null;
    reviewer?: string | null;
    reason?: string | null;
  },
) {
  for (const legacyItemId of Array.from(new Set(legacyItemIds))) {
    const [existing] = await db
      .select({ id: legacyCanonicalLineageTable.id })
      .from(legacyCanonicalLineageTable)
      .where(eq(legacyCanonicalLineageTable.legacyItemId, legacyItemId))
      .limit(1);
    const values = {
      canonicalItemId,
      relationship: "source",
      decision: reviewMetadata.decision ?? null,
      reviewer: reviewMetadata.reviewer ?? null,
      reviewedAt: reviewMetadata.decision ? new Date() : null,
      reason: reviewMetadata.reason ?? null,
    };
    if (existing) {
      await db
        .update(legacyCanonicalLineageTable)
        .set(values)
        .where(eq(legacyCanonicalLineageTable.id, existing.id));
    } else {
      await db.insert(legacyCanonicalLineageTable).values({
        id: `lineage_${crypto.randomUUID()}`,
        legacyItemId,
        ...values,
      });
    }
  }
}

router.get("/departments/:departmentId/assignments", async (req, res, next) => {
  try {
    const params = ListDepartmentAssignmentsParams.parse(req.params);
    const [department] = await db
      .select({ id: departmentEntitiesTable.id })
      .from(departmentEntitiesTable)
      .where(eq(departmentEntitiesTable.id, params.departmentId))
      .limit(1);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    res.json(ListDepartmentAssignmentsResponse.parse(
      await listAssignmentsForDepartment(params.departmentId),
    ));
  } catch (error) {
    req.log.error({ error }, "Failed to list department assignments");
    next(error);
  }
});

router.post("/departments/:departmentId/assignments", async (req, res, next) => {
  try {
    const params = ListDepartmentAssignmentsParams.parse(req.params);
    const input = CreateDepartmentAssignmentBody.parse(req.body);
    const [department] = await db
      .select({ id: departmentEntitiesTable.id })
      .from(departmentEntitiesTable)
      .where(eq(departmentEntitiesTable.id, params.departmentId))
      .limit(1);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    if (await isDepartmentSubmitted(params.departmentId)) {
      res.status(409).json({ error: "Submitted departments cannot be edited" });
      return;
    }
    const [canonical] = await db
      .select({ id: canonicalItemsTable.id })
      .from(canonicalItemsTable)
      .where(eq(canonicalItemsTable.id, input.canonicalItemId))
      .limit(1);
    if (!canonical) {
      res.status(404).json({ error: "Canonical item not found" });
      return;
    }
    if (input.sourceImportId) {
      const [sourceImport] = await db
        .select({ id: mmfImportsTable.id })
        .from(mmfImportsTable)
        .where(eq(mmfImportsTable.id, input.sourceImportId))
        .limit(1);
      if (!sourceImport) {
        res.status(404).json({ error: "Source import not found" });
        return;
      }
    }

    const [existing] = await db
      .select({ id: departmentItemAssignmentsTable.id })
      .from(departmentItemAssignmentsTable)
      .where(
        and(
          eq(departmentItemAssignmentsTable.departmentId, params.departmentId),
          eq(departmentItemAssignmentsTable.canonicalItemId, input.canonicalItemId),
        ),
      )
      .limit(1);
    if (existing) {
      const response = await getDepartmentAssignment(existing.id);
      if (!response) throw new Error("Existing assignment could not be loaded");
      res.status(200).json(CreateDepartmentAssignmentResponse.parse(response));
      return;
    }

    const [created] = await db
      .insert(departmentItemAssignmentsTable)
      .values({
        id: `assignment_${crypto.randomUUID()}`,
        departmentId: params.departmentId,
        canonicalItemId: input.canonicalItemId,
        status: input.status,
        sourceImportId: input.sourceImportId ?? null,
        source: input.source ?? null,
      })
      .returning({ id: departmentItemAssignmentsTable.id });
    if (!created) throw new Error("Department assignment could not be created");
    const response = await getDepartmentAssignment(created.id);
    if (!response) throw new Error("Created assignment could not be loaded");
    res.status(201).json(CreateDepartmentAssignmentResponse.parse(response));
  } catch (error) {
    req.log.error({ error }, "Failed to create department assignment");
    next(error);
  }
});

router.patch(
  "/departments/:departmentId/assignments/:canonicalItemId",
  async (req, res, next) => {
    try {
      const params = UpdateDepartmentAssignmentParams.parse(req.params);
      const input = UpdateDepartmentAssignmentBody.parse(req.body);
      if (await isDepartmentSubmitted(params.departmentId)) {
        res.status(409).json({ error: "Submitted departments cannot be edited" });
        return;
      }
      const [existing] = await db
        .select({ id: departmentItemAssignmentsTable.id })
        .from(departmentItemAssignmentsTable)
        .where(
          and(
            eq(departmentItemAssignmentsTable.departmentId, params.departmentId),
            eq(departmentItemAssignmentsTable.canonicalItemId, params.canonicalItemId),
          ),
        )
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Department assignment not found" });
        return;
      }
      await db
        .update(departmentItemAssignmentsTable)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(departmentItemAssignmentsTable.id, existing.id));
      const response = await getDepartmentAssignment(existing.id);
      if (!response) throw new Error("Updated assignment could not be loaded");
      res.json(UpdateDepartmentAssignmentResponse.parse(response));
    } catch (error) {
      req.log.error({ error }, "Failed to update department assignment");
      next(error);
    }
  },
);

router.patch(
  "/departments/:departmentId/assignments/:canonicalItemId/mmf",
  async (req, res, next) => {
    try {
      const params = UpdateDepartmentAssignmentMmfParams.parse(req.params);
      const parsedInput = UpdateDepartmentAssignmentMmfBody.safeParse(req.body);
      if (!parsedInput.success) {
        res.status(400).json({ error: "Invalid MMF quantity" });
        return;
      }
      const input = parsedInput.data;
      if (await isDepartmentSubmitted(params.departmentId)) {
        res.status(409).json({ error: "Submitted departments cannot be edited" });
        return;
      }
      const hasDglp = Object.prototype.hasOwnProperty.call(req.body ?? {}, "dglpMmf");
      const hasEchs = Object.prototype.hasOwnProperty.call(req.body ?? {}, "echsMmf");
      if (!hasDglp && !hasEchs) {
        res.status(400).json({ error: "At least one MMF quantity must be provided" });
        return;
      }

      const [assignment] = await db
        .select()
        .from(departmentItemAssignmentsTable)
        .where(
          and(
            eq(departmentItemAssignmentsTable.departmentId, params.departmentId),
            eq(departmentItemAssignmentsTable.canonicalItemId, params.canonicalItemId),
            eq(departmentItemAssignmentsTable.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (!assignment) {
        res.status(404).json({ error: "Active department assignment not found" });
        return;
      }

      const nextDglpMmf = hasDglp ? (input.dglpMmf ?? null) : assignment.currentDglpMmf;
      const nextEchsMmf = hasEchs ? (input.echsMmf ?? null) : assignment.currentEchsMmf;
      const changedBy = req.get("x-user-id")?.trim() || "demo-department-user";
      const changedAt = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(departmentItemAssignmentsTable)
          .set({
            currentDglpMmf: nextDglpMmf,
            currentEchsMmf: nextEchsMmf,
            updatedAt: changedAt,
          })
          .where(
            and(
              eq(departmentItemAssignmentsTable.id, assignment.id),
              eq(departmentItemAssignmentsTable.departmentId, params.departmentId),
              eq(departmentItemAssignmentsTable.status, "ACTIVE"),
            ),
          );

        await tx.insert(departmentMmfRevisionsTable).values({
          id: `department_mmf_revision_${crypto.randomUUID()}`,
          departmentId: assignment.departmentId,
          canonicalItemId: assignment.canonicalItemId,
          assignmentId: assignment.id,
          previousDglpMmf: assignment.currentDglpMmf,
          newDglpMmf: nextDglpMmf,
          previousEchsMmf: assignment.currentEchsMmf,
          newEchsMmf: nextEchsMmf,
          changedBy,
          changedAt,
        });
      });

      const response = await getDepartmentAssignment(assignment.id);
      if (!response) throw new Error("Updated department assignment could not be loaded");
      res.json(UpdateDepartmentAssignmentMmfResponse.parse(response));
    } catch (error) {
      req.log.error({ error }, "Failed to update department MMF");
      next(error);
    }
  },
);

router.get("/canonical-items", async (req, res, next) => {
  try {
    const params = ListCanonicalItemsQueryParams.parse(req.query);
    const filters = [];
    if (params.status) filters.push(eq(canonicalItemsTable.status, params.status));
    if (params.search) {
      filters.push(
        or(
          ilike(canonicalItemsTable.nomenclature, `%${params.search}%`),
          ilike(canonicalItemsTable.pvms, `%${params.search}%`),
          ilike(canonicalItemsTable.niv, `%${params.search}%`),
        ),
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const sortColumn = {
      canonicalId: canonicalItemsTable.canonicalNumber,
      nomenclature: canonicalItemsTable.nomenclature,
      pvms: canonicalItemsTable.pvms,
      niv: canonicalItemsTable.niv,
      unit: canonicalItemsTable.unit,
      status: canonicalItemsTable.status,
      legacyRecordCount: sql<number>`(
        select count(*)
        from legacy_canonical_lineage lcl
        where lcl.canonical_item_id = ${canonicalItemsTable.id}
      )`,
      departmentCount: sql<number>`(
        select count(distinct lid.department_id)
        from legacy_canonical_lineage lcl
        inner join legacy_item_departments lid on lid.legacy_item_id = lcl.legacy_item_id
        where lcl.canonical_item_id = ${canonicalItemsTable.id}
      )`,
    }[params.sort];
    const order = params.direction === "asc" ? asc(sortColumn) : desc(sortColumn);
    const [rows, count] = await Promise.all([
      db
        .select()
        .from(canonicalItemsTable)
        .where(where)
        .orderBy(order)
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      db.select({ total: sql<number>`count(*)` }).from(canonicalItemsTable).where(where),
    ]);
    const items = await Promise.all(
      rows.map(async (row) => {
        const detail = await toCanonicalDetail(row);
        return {
          id: detail.id,
          canonicalId: detail.canonicalId,
          nomenclature: detail.nomenclature,
          unit: detail.unit,
          pvms: detail.pvms,
          niv: detail.niv,
          status: detail.status,
          legacyRecordCount: detail.legacyRecordCount,
          departmentCount: detail.departmentCount,
        };
      }),
    );
    res.json(
      ListCanonicalItemsResponse.parse({
        items,
        page: params.page,
        pageSize: params.pageSize,
        total: Number(count[0]?.total ?? 0),
      }),
    );
  } catch (error) {
    req.log.error({ error }, "Failed to list canonical items");
    next(error);
  }
});

router.post("/canonical-items", async (req, res, next) => {
  try {
    const input = CreateCanonicalItemBody.parse(req.body);
    const detail = await createCanonicalFromLegacyIds(input.legacyItemIds, input);
    res.status(201).json(CreateCanonicalItemResponse.parse(detail));
  } catch (error) {
    if (error instanceof Error && error.name === "ALREADY_LINKED") {
      res.status(409).json({ error: error.message });
      return;
    }
    req.log.error({ error }, "Failed to create canonical item");
    next(error);
  }
});

router.get("/canonical-items/:canonicalItemId", async (req, res, next) => {
  try {
    const params = GetCanonicalItemParams.parse(req.params);
    const [canonical] = await db
      .select()
      .from(canonicalItemsTable)
      .where(eq(canonicalItemsTable.id, params.canonicalItemId))
      .limit(1);
    if (!canonical) {
      res.status(404).json({ error: "Canonical item not found" });
      return;
    }
    res.json(GetCanonicalItemResponse.parse(await toCanonicalDetail(canonical)));
  } catch (error) {
    req.log.error({ error }, "Failed to get canonical item");
    next(error);
  }
});

router.get("/vocabulary-reviews", async (req, res, next) => {
  try {
    const params = ListVocabularyReviewsQueryParams.parse(req.query);
    const filters = [];
    if (params.status && params.status !== "all") {
      filters.push(eq(vocabularyReviewsTable.status, params.status));
    }
    if (params.reviewType) {
      filters.push(eq(vocabularyReviewsTable.reviewType, params.reviewType));
    }
    if (params.search?.trim()) {
      const search = `%${params.search.trim()}%`;
      filters.push(
        or(
          ilike(vocabularyReviewsTable.title, search),
          ilike(vocabularyReviewsTable.detail, search),
          ilike(vocabularyReviewsTable.identifier, search),
        ),
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const sortColumn = {
      createdAt: vocabularyReviewsTable.createdAt,
      reviewType: vocabularyReviewsTable.reviewType,
      status: vocabularyReviewsTable.status,
      identifier: vocabularyReviewsTable.identifier,
      title: vocabularyReviewsTable.title,
    }[params.sort];
    const order = params.direction === "asc" ? asc(sortColumn) : desc(sortColumn);
    const offset = (params.page - 1) * params.pageSize;
    const [reviews, [{ total }]] = await Promise.all([
      db
      .select()
      .from(vocabularyReviewsTable)
      .where(where)
      .orderBy(order)
      .limit(params.pageSize)
      .offset(offset),
      db.select({ total: count() }).from(vocabularyReviewsTable).where(where),
    ]);
    res.json(ListVocabularyReviewsResponse.parse({
      items: await Promise.all(reviews.map(toReviewResponse)),
      page: params.page,
      pageSize: params.pageSize,
      total: Number(total),
    }));
  } catch (error) {
    req.log.error({ error }, "Failed to list vocabulary reviews");
    next(error);
  }
});

router.post("/vocabulary-reviews/:reviewId/decision", async (req, res, next) => {
  try {
    const params = DecideVocabularyReviewParams.parse(req.params);
    const input = DecideVocabularyReviewBody.parse(req.body);
    const [review] = await db
      .select()
      .from(vocabularyReviewsTable)
      .where(eq(vocabularyReviewsTable.id, params.reviewId))
      .limit(1);
    if (!review) {
      res.status(404).json({ error: "Vocabulary review not found" });
      return;
    }
    const candidateIds = await db
      .select({ legacyItemId: vocabularyReviewCandidatesTable.legacyItemId })
      .from(vocabularyReviewCandidatesTable)
      .where(eq(vocabularyReviewCandidatesTable.reviewId, review.id));
    let canonicalItemIds = input.canonicalItemIds ?? [];
    const reviewMetadata = {
      decision: input.decision,
      reviewer: "demo-operator",
      reason: input.note ?? null,
    };
    const targetIds = Array.from(new Set(input.canonicalItemIds ?? []));
    const targetCanonicals = targetIds.length
      ? await db
          .select()
          .from(canonicalItemsTable)
          .where(inArray(canonicalItemsTable.id, targetIds))
      : [];
    if (targetCanonicals.length !== targetIds.length) {
      res.status(400).json({ error: "One or more canonical targets were not found" });
      return;
    }
    if (input.decision === "MERGE") {
      if (targetIds.length !== 1) {
        res.status(400).json({ error: "MERGE requires exactly one canonical target" });
        return;
      }
      await updateLineage(candidateIds.map((candidate) => candidate.legacyItemId), targetIds[0], reviewMetadata);
      canonicalItemIds = targetIds;
    } else if (input.decision === "CORRECT") {
      if (targetIds.length !== 1) {
        res.status(400).json({ error: "CORRECT requires exactly one canonical target" });
        return;
      }
      const corrections = Object.fromEntries(
        Object.entries({
          nomenclature: input.nomenclature,
          unit: input.unit,
          pvms: input.pvms,
          niv: input.niv,
        }).filter(([, value]) => value !== undefined),
      );
      if (!Object.keys(corrections).length) {
        res.status(400).json({ error: "CORRECT requires at least one canonical value" });
        return;
      }
      await db
        .update(canonicalItemsTable)
        .set({ ...corrections, updatedAt: new Date() })
        .where(eq(canonicalItemsTable.id, targetIds[0]));
      await updateLineage(candidateIds.map((candidate) => candidate.legacyItemId), targetIds[0], reviewMetadata);
      canonicalItemIds = targetIds;
    } else if (input.decision === "CREATE_CANONICAL") {
      const available = await db
        .select({ legacyItemId: legacyCanonicalLineageTable.legacyItemId })
        .from(legacyCanonicalLineageTable)
        .where(inArray(legacyCanonicalLineageTable.legacyItemId, candidateIds.map((candidate) => candidate.legacyItemId)));
      const linkedIds = new Set(available.map((item) => item.legacyItemId));
      for (const candidate of candidateIds) {
        if (!linkedIds.has(candidate.legacyItemId)) {
          const created = await createCanonicalFromLegacyIds(
            [candidate.legacyItemId],
            {},
            reviewMetadata,
          );
          canonicalItemIds.push(created.id);
        }
      }
    } else if (input.decision === "RETIRE") {
      const linked = candidateIds.length
        ? await db
            .select({ canonicalItemId: legacyCanonicalLineageTable.canonicalItemId })
            .from(legacyCanonicalLineageTable)
            .where(inArray(legacyCanonicalLineageTable.legacyItemId, candidateIds.map((candidate) => candidate.legacyItemId)))
        : [];
      const retireIds = Array.from(new Set([
        ...targetIds,
        ...linked.map((item) => item.canonicalItemId),
      ]));
      if (retireIds.length) {
        await db
          .update(canonicalItemsTable)
          .set({ status: "retired", updatedAt: new Date() })
          .where(inArray(canonicalItemsTable.id, retireIds));
      }
    }
    const [updated] = await db
      .update(vocabularyReviewsTable)
      .set({
        status: input.decision === "INVESTIGATE" ? "open" : "resolved",
        decision: input.decision,
        decisionNote: input.note ?? null,
        resolvedAt: input.decision === "INVESTIGATE" ? null : new Date(),
      })
      .where(eq(vocabularyReviewsTable.id, review.id))
      .returning();
    if (!updated) throw new Error("Vocabulary review could not be updated");
    res.json(DecideVocabularyReviewResponse.parse(await toReviewResponse(updated)));
  } catch (error) {
    if (error instanceof Error && error.name === "ALREADY_LINKED") {
      res.status(409).json({ error: error.message });
      return;
    }
    req.log.error({ error }, "Failed to decide vocabulary review");
    next(error);
  }
});

export default router;
