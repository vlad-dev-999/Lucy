import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CommitImportBody,
  CommitImportParams,
  CommitImportResponse,
  CreateImportBody,
  CreateImportResponse,
  GetImportParams,
  GetImportResponse,
  GetOverviewResponse,
  ListDepartmentsResponse,
  ListImportsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { mmfImportsTable, type MmfImport } from "@workspace/db/schema";
import { persistImportLineage } from "./canonical";

const router: IRouter = Router();

export const DEPARTMENT_NAMES = [
  "A-E-MS",
  "BLOOD BANK-MS",
  "BURN CENTER",
  "CARDIAC CATH LAB (CCL)-MS",
  "CARDIO OPD-MS",
  "CHEST-MS",
  "CT-SCAN-MS",
  "DIALYSIS-MS",
  "DISPENSARY CHCC-MS",
  "ECHS POLYCLINIC (CC), LUCKNOW-MS",
  "ECHS POLYCLINIC BUTWAL-MS",
  "ECHS POLYCLINIC FATEHPUR-MS",
  "ECHS POLYCLINIC GOMTI AREA-MS",
  "ECHS POLYCLINIC KATHMANDU(NEPAL)-MS",
  "ECHS POLYCLINIC POKHARA (NEPAL)-MS",
  "ENDOCRINOLOGY-MS",
  "ENT WARD",
  "ENT-MS",
  "EYE OPD-MS",
  "GE_116-MS",
  "GEN SURGERY-MS",
  "GI SURG-MS",
  "GI-MS",
  "GYNAE DISPENSARY-MS",
  "GYNAE OPD-MS",
  "HAEMOTOLOGY-MS",
  "HQ 41 INF BDE-MS",
  "HQ CC MI ROOM-MS",
  "ICU",
  "INTERVENTIONAL RADIOLOGY-MS",
  "ISOLATION ICU-MS",
  "LAB-MS",
  "LABOUR ROOM-MS",
  "MATY-MS",
  "MED DIVISION-MS",
  "MED-I",
  "MEDICAL STORE",
  "MIR PPO POKHARA-MS",
  "MRI-MS",
  "NEPHRO-MS",
  "NEURO MED",
  "NEURO SURG-MS",
  "NICU",
  "NSC-I-MS",
  "OFFR FAMLY-MS",
  "OFFR WARD-MS",
  "ONCO DAY CARE-MS",
  "ONCO MALE WARD-MS",
  "ONCO SURG OPD",
  "OR FAM MED-MS",
  "OR FAM SURG-MS",
  "OT-MS",
  "PAED SURG-MS",
  "PEAD WD-MS",
  "PET CT-MS",
  "PHYSIOTHERAPY-MS",
  "POLYCLINIC CHCC-MS",
  "PRS DEPT-MS",
  "PSY DISPENSARY-MS",
  "PSYCHIATRY WARD-MS",
  "RADIATION ONCOLOGY-MS",
  "RHEUMATO-MS",
  "RTC",
  "SURG-I",
  "URO WD-MS",
  "URO-MS",
  "VASCULAR SURGERY-MS",
  "VETERANS-MS",
  "X-RAY-MS",
];

const fixturePreviewRows = [
  {
    sourceRow: 3,
    systemId: "20916",
    identifier: "Rheumat/HELMED/2.4",
    nomenclature: "(Beckman Coulter) IFA ANA HEP-2(10X12 WELL) (Anti Nuclear Antibodies)",
    unit: "No",
    currentDglp: 2,
    currentEchs: 2,
  },
  {
    sourceRow: 4,
    systemId: "20915",
    identifier: "Rheumat/HELMED/2.3",
    nomenclature: "Anti-CCP antibody test",
    unit: "No",
    currentDglp: 4,
    currentEchs: 1,
  },
  {
    sourceRow: 2618,
    systemId: "18871",
    identifier: "NIV/22",
    nomenclature: "Graduated compression (micro fibre) stockings above knee class II various",
    unit: "Pair",
    currentDglp: 2,
    currentEchs: 0,
  },
  {
    sourceRow: 2625,
    systemId: "18864",
    identifier: "NIV/22",
    nomenclature: "Guardian Sensor (Medtronic)",
    unit: "No",
    currentDglp: 1,
    currentEchs: 0,
  },
  {
    sourceRow: 5339,
    systemId: "20038",
    identifier: "NIV/6344",
    nomenclature: "Tab Letemovir 240 mg",
    unit: "Tab",
    currentDglp: 1,
    currentEchs: 0,
  },
  {
    sourceRow: 5341,
    systemId: "20036",
    identifier: "NIV/6344",
    nomenclature: "Tab Letermovir 240 mg",
    unit: "Tab",
    currentDglp: 1,
    currentEchs: 0,
  },
];

const fixtureIssues = [
  {
    code: "IDENTIFIER_CONFLICT",
    severity: "review" as const,
    title: "NIV/22 maps to unrelated descriptions",
    detail: "Two legacy records share NIV/22 but describe compression stockings and a glucose sensor. Do not merge without human review.",
    rowNumbers: [2618, 2625],
  },
  {
    code: "IDENTIFIER_CONFLICT",
    severity: "review" as const,
    title: "Nine duplicate identifier groups require review",
    detail: "The workbook contains nine duplicate PVMS/NIV groups; each is preserved as a separate legacy record.",
    rowNumbers: [2618, 2625, 2708, 2709, 3563, 4035, 3961, 3962],
  },
  {
    code: "MISSING_IDENTIFIER",
    severity: "warning" as const,
    title: "One record has no PVMS/NIV identifier",
    detail: "Blank identifiers are review warnings, not import errors. The record still receives an internal canonical ID later.",
    rowNumbers: [6207],
  },
];

function toSummary(item: MmfImport) {
  return {
    id: item.id,
    sourceFileName: item.sourceFileName,
    worksheetName: item.worksheetName,
    rowCount: item.rowCount,
    columnCount: item.columnCount,
    departmentCount: item.departmentCount,
    status: item.status as "review" | "committed",
    createdAt: item.createdAt.toISOString(),
    committedAt: item.committedAt?.toISOString() ?? null,
    quality: {
      warnings: item.warningCount,
      errors: item.errorCount,
      conflicts: item.conflictGroupCount,
      missingIdentifiers: item.missingIdentifierCount,
    },
  };
}

function toDetail(item: MmfImport) {
  return {
    ...toSummary(item),
    sourceFileHash: item.sourceFileHash,
    fileSize: item.fileSize,
    uniqueIdentifierCount: item.uniqueIdentifierCount,
    previewRows: item.previewRows,
    issues: item.issues,
  };
}

async function ensureFixtureImport() {
  const existing = await db
    .select()
    .from(mmfImportsTable)
    .where(eq(mmfImportsTable.sourceFileName, "MMF DGLP 2026-27.xlsx"))
    .limit(1);
  const fixtureInput = {
    sourceFileName: "MMF DGLP 2026-27.xlsx",
    sourceFileHash: "f35a8f1613ecd726e23280c20576c608aa0c933e450385ad69055290b8a6fd9c",
    fileSize: 4662898,
    worksheetName: "Worksheet",
    rowCount: 6205,
    columnCount: 219,
    departmentCount: 69,
    uniqueIdentifierCount: 6195,
    missingIdentifierCount: 1,
    conflictGroupCount: 9,
    warnings: 1,
    errors: 0,
    previewRows: fixturePreviewRows,
    issues: fixtureIssues,
    departments: DEPARTMENT_NAMES.map((name, index) => ({
      name,
      sourceColumnStart: 12 + index * 3,
    })),
  };
  if (existing[0]) {
    await persistImportLineage(existing[0], fixtureInput);
    return existing[0];
  }

  const [created] = await db
    .insert(mmfImportsTable)
    .values({
      id: "imp_fixture_2026_27",
      sourceFileName: "MMF DGLP 2026-27.xlsx",
      sourceFileHash: "f35a8f1613ecd726e23280c20576c608aa0c933e450385ad69055290b8a6fd9c",
      fileSize: 4662898,
      worksheetName: "Worksheet",
      rowCount: 6205,
      columnCount: 219,
      departmentCount: 69,
      uniqueIdentifierCount: 6195,
      missingIdentifierCount: 1,
      conflictGroupCount: 9,
      warningCount: 1,
      errorCount: 0,
      status: "review",
      previewRows: fixturePreviewRows,
        legacyRows: [],
      issues: fixtureIssues,
    })
    .onConflictDoNothing({ target: mmfImportsTable.id })
    .returning();
  if (created) {
    await persistImportLineage(created, fixtureInput);
    return created;
  }
  const [existingAfterRace] = await db
    .select()
    .from(mmfImportsTable)
    .where(eq(mmfImportsTable.id, "imp_fixture_2026_27"))
    .limit(1);
  if (!existingAfterRace) throw new Error("Fixture import could not be initialized");
  await persistImportLineage(existingAfterRace, fixtureInput);
  return existingAfterRace;
}

router.get("/overview", async (req, res, next) => {
  try {
    const fixture = await ensureFixtureImport();
    const data = {
      cycle: {
        name: "MMF 2027–28",
        status: "OPEN",
        deadline: "15 February 2027",
        daysRemaining: 149,
      },
      baseline: {
        rowCount: fixture.rowCount,
        departmentCount: fixture.departmentCount,
        uniqueIdentifiers: fixture.uniqueIdentifierCount,
        currentImportStatus: fixture.status === "committed" ? "Baseline committed" : "Review in progress",
      },
      quality: {
        conflicts: fixture.conflictGroupCount,
        warnings: fixture.warningCount,
        unresolved: fixture.conflictGroupCount + fixture.warningCount,
      },
      departments: {
        total: 69,
        ready: 0,
        inProgress: 12,
        needsReview: 57,
      },
      recentActivity: [
        {
          id: "activity-import",
          action: "Legacy workbook inspected",
          detail: "MMF DGLP 2026-27.xlsx · 6,205 rows",
          timestamp: "Today, 09:42",
          tone: "success" as const,
        },
        {
          id: "activity-conflict",
          action: "Identifier conflict detected",
          detail: "NIV/22 appears against two unrelated descriptions",
          timestamp: "Today, 09:43",
          tone: "critical" as const,
        },
        {
          id: "activity-warning",
          action: "Review warning created",
          detail: "1 legacy record has no PVMS/NIV identifier",
          timestamp: "Today, 09:43",
          tone: "warning" as const,
        },
      ],
    };
    res.json(GetOverviewResponse.parse(data));
  } catch (error) {
    req.log.error({ error }, "Failed to build MMF overview");
    next(error);
  }
});

router.get("/departments", async (req, res, next) => {
  try {
    const fixture = await ensureFixtureImport();
    const data = DEPARTMENT_NAMES.map((name, index) => ({
      id: `dept-${index + 1}`,
      name,
      itemCount: Math.max(0, Math.round(fixture.rowCount / 69) - (index % 7)),
      sourceColumnStart: 12 + index * 3,
    }));
    res.json(ListDepartmentsResponse.parse(data));
  } catch (error) {
    req.log.error({ error }, "Failed to list departments");
    next(error);
  }
});

router.get("/imports", async (req, res, next) => {
  try {
    await ensureFixtureImport();
    const rows = await db
      .select()
      .from(mmfImportsTable)
      .orderBy(desc(mmfImportsTable.createdAt));
    res.json(ListImportsResponse.parse(rows.map(toSummary)));
  } catch (error) {
    req.log.error({ error }, "Failed to list imports");
    next(error);
  }
});

router.post("/imports", async (req, res, next) => {
  try {
    const input = CreateImportBody.parse(req.body);
    const now = new Date();
    const [created] = await db
      .insert(mmfImportsTable)
      .values({
        id: `imp_${crypto.randomUUID()}`,
        sourceFileName: input.sourceFileName,
        sourceFileHash: input.sourceFileHash,
        fileSize: input.fileSize ?? 0,
        worksheetName: input.worksheetName,
        rowCount: input.rowCount,
        columnCount: input.columnCount,
        departmentCount: input.departmentCount,
        uniqueIdentifierCount: input.uniqueIdentifierCount,
        missingIdentifierCount: input.missingIdentifierCount,
        conflictGroupCount: input.conflictGroupCount,
        warningCount: input.warnings,
        errorCount: input.errors,
        status: "review",
        createdAt: now,
        sourceObjectPath: input.sourceObjectPath ?? null,
        sourceObjectContentType: input.sourceObjectContentType ?? null,
        previewRows: input.previewRows,
        legacyRows: input.legacyRows ?? [],
        issues: input.issues ?? [],
      })
      .returning();
    res.status(201).json(CreateImportResponse.parse(toSummary(created)));
  } catch (error) {
    req.log.error({ error }, "Failed to save import review");
    next(error);
  }
});

router.get("/imports/:importId", async (req, res, next) => {
  try {
    const params = GetImportParams.parse(req.params);
    const [found] = await db
      .select()
      .from(mmfImportsTable)
      .where(eq(mmfImportsTable.id, params.importId))
      .limit(1);
    if (!found) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    res.json(GetImportResponse.parse(toDetail(found)));
  } catch (error) {
    req.log.error({ error }, "Failed to get import");
    next(error);
  }
});

router.post("/imports/:importId/commit", async (req, res, next) => {
  try {
    const params = CommitImportParams.parse(req.params);
    CommitImportBody.parse(req.body ?? {});
    const [found] = await db
      .select()
      .from(mmfImportsTable)
      .where(eq(mmfImportsTable.id, params.importId))
      .limit(1);
    if (!found) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    if (found.errorCount > 0) {
      res.status(409).json({ error: "Resolve import errors before committing a baseline" });
      return;
    }
    const sourceRows = Array.isArray(found.legacyRows) ? found.legacyRows : [];
    await persistImportLineage(found, {
      sourceFileName: found.sourceFileName,
      sourceFileHash: found.sourceFileHash,
      fileSize: found.fileSize,
      worksheetName: found.worksheetName,
      rowCount: found.rowCount,
      columnCount: found.columnCount,
      departmentCount: found.departmentCount,
      uniqueIdentifierCount: found.uniqueIdentifierCount,
      missingIdentifierCount: found.missingIdentifierCount,
      conflictGroupCount: found.conflictGroupCount,
      warnings: found.warningCount,
      errors: found.errorCount,
      previewRows: found.previewRows as never,
      issues: found.issues as never,
      legacyRows: sourceRows as never,
    });
    const [committed] = await db
      .update(mmfImportsTable)
      .set({ status: "committed", committedAt: new Date() })
      .where(and(eq(mmfImportsTable.id, params.importId), eq(mmfImportsTable.status, "review")))
      .returning();
    const result = committed ?? found;
    res.json(CommitImportResponse.parse(toDetail(result)));
  } catch (error) {
    req.log.error({ error }, "Failed to commit import baseline");
    next(error);
  }
});

export default router;