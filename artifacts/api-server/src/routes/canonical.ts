import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  CreateCanonicalItemBody,
  CreateCanonicalItemResponse,
  DecideVocabularyReviewBody,
  DecideVocabularyReviewParams,
  DecideVocabularyReviewResponse,
  GetCanonicalItemParams,
  GetCanonicalItemResponse,
  ListCanonicalItemsQueryParams,
  ListCanonicalItemsResponse,
  ListVocabularyReviewsQueryParams,
  ListVocabularyReviewsResponse,
  type DepartmentInput,
  type ImportInput,
  type LegacyRowInput,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  canonicalItemsTable,
  departmentEntitiesTable,
  legacyCanonicalLineageTable,
  legacyItemDepartmentsTable,
  legacyItemsTable,
  mmfImportsTable,
  vocabularyReviewCandidatesTable,
  vocabularyReviewsTable,
} from "@workspace/db/schema";

const router: IRouter = Router();

type LegacyRecordWithDepartments = {
  id: string;
  importId: string;
  sourceWorksheet: string;
  sourceRow: number;
  systemId: string | null;
  identifier: string | null;
  nomenclature: string | null;
  unit: string | null;
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

function fallbackLegacyRows(input: ImportInput): LegacyRowInput[] {
  return input.previewRows.map((row) => ({
    sourceRow: row.sourceRow,
    systemId: row.systemId,
    identifier: row.identifier,
    nomenclature: row.nomenclature,
    unit: row.unit,
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
  const legacyRecords = await getLegacyRecords(lineage.map((item) => item.legacyItemId));
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
    legacyRecords,
    vocabularyHistory: reviews,
  };
}

export async function persistImportLineage(
  importRecord: typeof mmfImportsTable.$inferSelect,
  input: ImportInput,
) {
  const existing = await db
    .select({ id: legacyItemsTable.id })
    .from(legacyItemsTable)
    .where(eq(legacyItemsTable.importId, importRecord.id))
    .limit(1);
  if (existing.length) return;

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
    unit: nullableString(row.unit),
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

  const issues = (input.issues ?? []).filter((issue) => issue.code === "IDENTIFIER_CONFLICT");
  for (const issue of issues) {
    const reviewId = `review_${importRecord.id}_${crypto.randomUUID()}`;
    const candidateIds = issue.rowNumbers
      .map((sourceRow) => `legacy_${importRecord.id}_${sourceRow}`)
      .filter((id) => legacyValues.some((item) => item.id === id));
    const identifier =
      legacyValues.find((item) => candidateIds.includes(item.id))?.identifier ?? null;
    const [review] = await db
      .insert(vocabularyReviewsTable)
      .values({
        id: reviewId,
        importId: importRecord.id,
        reviewType: "identifier_conflict",
        identifier,
        title: issue.title,
        detail: issue.detail,
      })
      .onConflictDoNothing({ target: vocabularyReviewsTable.id })
      .returning();
    if (review && candidateIds.length) {
      await db
        .insert(vocabularyReviewCandidatesTable)
        .values(
          candidateIds.map((legacyItemId) => ({
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
  const [canonical] = await db
    .insert(canonicalItemsTable)
    .values({
      id: `canonical_${crypto.randomUUID()}`,
      nomenclature: overrides.nomenclature ?? first.nomenclature,
      unit: overrides.unit ?? first.unit,
      pvms: overrides.pvms ?? first.identifier?.startsWith("PVMS") ? first.identifier : null,
      niv: overrides.niv ?? first.identifier?.startsWith("NIV") ? first.identifier : null,
    })
    .returning();
  if (!canonical) throw new Error("Canonical item could not be created");
  await db.insert(legacyCanonicalLineageTable).values(
    uniqueIds.map((legacyItemId) => ({
      id: `lineage_${crypto.randomUUID()}`,
      legacyItemId,
      canonicalItemId: canonical.id,
      relationship: "source",
    })),
  );
  return toCanonicalDetail(canonical);
}

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
    const [rows, count] = await Promise.all([
      db
        .select()
        .from(canonicalItemsTable)
        .where(where)
        .orderBy(desc(canonicalItemsTable.updatedAt))
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
    const where = params.status && params.status !== "all"
      ? eq(vocabularyReviewsTable.status, params.status)
      : undefined;
    const reviews = await db
      .select()
      .from(vocabularyReviewsTable)
      .where(where)
      .orderBy(asc(vocabularyReviewsTable.status), desc(vocabularyReviewsTable.createdAt));
    res.json(ListVocabularyReviewsResponse.parse(await Promise.all(reviews.map(toReviewResponse))));
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
    if (input.decision === "MERGE") {
      const created = await createCanonicalFromLegacyIds(
        candidateIds.map((candidate) => candidate.legacyItemId),
      );
      canonicalItemIds = [created.id];
    } else if (input.decision === "CREATE_CANONICAL") {
      const available = await db
        .select({ legacyItemId: legacyCanonicalLineageTable.legacyItemId })
        .from(legacyCanonicalLineageTable)
        .where(inArray(legacyCanonicalLineageTable.legacyItemId, candidateIds.map((candidate) => candidate.legacyItemId)));
      const linkedIds = new Set(available.map((item) => item.legacyItemId));
      for (const candidate of candidateIds) {
        if (!linkedIds.has(candidate.legacyItemId)) {
          const created = await createCanonicalFromLegacyIds([candidate.legacyItemId]);
          canonicalItemIds.push(created.id);
        }
      }
    }
    const [updated] = await db
      .update(vocabularyReviewsTable)
      .set({
        status: "resolved",
        decision: input.decision,
        decisionNote: input.note ?? null,
        resolvedAt: new Date(),
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