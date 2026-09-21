import { Router, type IRouter } from "express";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { canonicalItemsTable, commonUseMmfTable, departmentEntitiesTable, departmentItemAssignmentsTable, departmentSubmissionsTable, itemProposalsTable } from "@workspace/db/schema";

const router: IRouter = Router();
const quantity = z.number().finite().nonnegative().nullable().optional();
const proposalInput = z.object({ nomenclature: z.string().trim().min(1), specification: z.string().trim().min(1), unit: z.string().trim().min(1), pvms: z.string().trim().min(1).optional().nullable(), niv: z.string().trim().min(1).optional().nullable(), dglpMmf: quantity, echsMmf: quantity, justification: z.string().trim().min(1), proposer: z.string().trim().min(1) });
const mmfInput = z.object({ dglpMmf: quantity, echsMmf: quantity }).refine((value) => value.dglpMmf !== undefined || value.echsMmf !== undefined, "Provide at least one MMF value");

function invalid(res: any, result: z.SafeParseError<unknown>) { res.status(400).json({ error: result.error.issues[0]?.message ?? "Invalid request" }); }
async function submitted(departmentId: string) { return Boolean((await db.select({ id: departmentSubmissionsTable.id }).from(departmentSubmissionsTable).where(eq(departmentSubmissionsTable.departmentId, departmentId)).limit(1))[0]); }

router.get("/canonical-items/search", async (req, res, next) => { try {
  const search = String(req.query.q ?? "").trim();
  if (!search) { res.json([]); return; }
  const rows = await db.select({ id: canonicalItemsTable.id, nomenclature: canonicalItemsTable.nomenclature, unit: canonicalItemsTable.unit, pvms: canonicalItemsTable.pvms, niv: canonicalItemsTable.niv }).from(canonicalItemsTable).where(and(eq(canonicalItemsTable.status, "active"), or(ilike(canonicalItemsTable.nomenclature, `%${search}%`), ilike(canonicalItemsTable.pvms, `%${search}%`), ilike(canonicalItemsTable.niv, `%${search}%`)))).limit(20);
  res.json(rows);
} catch (error) { next(error); } });

router.get("/departments/:departmentId/proposals", async (req, res, next) => { try { res.json(await db.select().from(itemProposalsTable).where(eq(itemProposalsTable.departmentId, req.params.departmentId)).orderBy(asc(itemProposalsTable.createdAt))); } catch (error) { next(error); } });
router.post("/departments/:departmentId/proposals", async (req, res, next) => { try {
  if (await submitted(req.params.departmentId)) return res.status(409).json({ error: "Submitted departments cannot be edited" });
  const input = proposalInput.safeParse(req.body); if (!input.success) return invalid(res, input);
  const department = await db.select({ id: departmentEntitiesTable.id }).from(departmentEntitiesTable).where(eq(departmentEntitiesTable.id, req.params.departmentId)).limit(1); if (!department[0]) return res.status(404).json({ error: "Department not found" });
  const [proposal] = await db.insert(itemProposalsTable).values({ id: `proposal_${crypto.randomUUID()}`, departmentId: req.params.departmentId, nomenclature: input.data.nomenclature, specification: input.data.specification, unit: input.data.unit, pvms: input.data.pvms ?? null, niv: input.data.niv ?? null, proposedDglpMmf: input.data.dglpMmf ?? null, proposedEchsMmf: input.data.echsMmf ?? null, justification: input.data.justification, proposer: input.data.proposer }).returning();
  res.status(201).json(proposal);
} catch (error) { next(error); } });
router.get("/proposals", async (_req, res, next) => { try { const rows = await db.select({ proposal: itemProposalsTable, departmentName: departmentEntitiesTable.name }).from(itemProposalsTable).innerJoin(departmentEntitiesTable, eq(itemProposalsTable.departmentId, departmentEntitiesTable.id)).orderBy(asc(itemProposalsTable.createdAt)); res.json(rows.map(({ proposal, departmentName }) => ({ ...proposal, departmentName }))); } catch (error) { next(error); } });
router.patch("/proposals/:proposalId", async (req, res, next) => { try { const status = z.enum(["APPROVED", "REJECTED"]).safeParse(req.body?.status); if (!status.success) return invalid(res, status); const [proposal] = await db.update(itemProposalsTable).set({ status: status.data, reviewer: req.get("x-user-id")?.trim() || "demo-reviewer", reviewedAt: new Date() }).where(and(eq(itemProposalsTable.id, req.params.proposalId), eq(itemProposalsTable.status, "PENDING"))).returning(); if (!proposal) return res.status(404).json({ error: "Pending proposal not found" }); res.json(proposal); } catch (error) { next(error); } });

router.get("/common-use-mmf", async (_req, res, next) => { try { const rows = await db.select({ id: commonUseMmfTable.id, canonicalItemId: canonicalItemsTable.id, nomenclature: canonicalItemsTable.nomenclature, dglpMmf: commonUseMmfTable.currentDglpMmf, echsMmf: commonUseMmfTable.currentEchsMmf, updatedAt: commonUseMmfTable.updatedAt }).from(commonUseMmfTable).innerJoin(canonicalItemsTable, eq(commonUseMmfTable.canonicalItemId, canonicalItemsTable.id)); res.json(rows); } catch (error) { next(error); } });
router.put("/canonical-items/:canonicalItemId/common-use-mmf", async (req, res, next) => { try { const input = mmfInput.safeParse(req.body); if (!input.success) return invalid(res, input); const [canonical] = await db.select({ id: canonicalItemsTable.id }).from(canonicalItemsTable).where(eq(canonicalItemsTable.id, req.params.canonicalItemId)).limit(1); if (!canonical) return res.status(404).json({ error: "Canonical item not found" }); const [existing] = await db.select().from(commonUseMmfTable).where(eq(commonUseMmfTable.canonicalItemId, canonical.id)).limit(1); const hasDglp = Object.prototype.hasOwnProperty.call(req.body ?? {}, "dglpMmf"); const hasEchs = Object.prototype.hasOwnProperty.call(req.body ?? {}, "echsMmf"); const values = { currentDglpMmf: hasDglp ? (input.data.dglpMmf ?? null) : (existing?.currentDglpMmf ?? null), currentEchsMmf: hasEchs ? (input.data.echsMmf ?? null) : (existing?.currentEchsMmf ?? null), updatedBy: req.get("x-user-id")?.trim() || "demo-hospital-user", updatedAt: new Date() }; const [row] = await db.insert(commonUseMmfTable).values({ id: `common_use_${crypto.randomUUID()}`, canonicalItemId: canonical.id, ...values }).onConflictDoUpdate({ target: commonUseMmfTable.canonicalItemId, set: values }).returning(); res.json(row); } catch (error) { next(error); } });

router.get("/departments/submission-status", async (_req, res, next) => { try { const departments = await db.select().from(departmentEntitiesTable).orderBy(asc(departmentEntitiesTable.sourceColumnStart)); const submissions = await db.select().from(departmentSubmissionsTable); const map = new Map(submissions.map((row) => [row.departmentId, row])); const assignments = await db.select({ departmentId: departmentItemAssignmentsTable.departmentId, d: departmentItemAssignmentsTable.currentDglpMmf, e: departmentItemAssignmentsTable.currentEchsMmf }).from(departmentItemAssignmentsTable).where(eq(departmentItemAssignmentsTable.status, "ACTIVE")); res.json(departments.map((department) => { const active = assignments.filter((row) => row.departmentId === department.id); const complete = active.length > 0 && active.every((row) => row.d !== null && row.e !== null); const submission = map.get(department.id); return { departmentId: department.id, departmentName: department.name, status: submission ? "SUBMITTED" : complete ? "READY" : "INCOMPLETE", submittedAt: submission?.submittedAt ?? null, assignmentCount: active.length }; })); } catch (error) { next(error); } });
router.post("/departments/:departmentId/submit", async (req, res, next) => { try {
  if (await submitted(req.params.departmentId)) { res.status(409).json({ error: "Department is already submitted" }); return; }
  const active = await db.select().from(departmentItemAssignmentsTable).where(and(eq(departmentItemAssignmentsTable.departmentId, req.params.departmentId), eq(departmentItemAssignmentsTable.status, "ACTIVE")));
  if (!active.length || active.some((row) => row.currentDglpMmf === null || row.currentEchsMmf === null)) { res.status(422).json({ error: "Every active assignment requires DGLP and ECHS MMF before submission" }); return; }
  const [row] = await db.insert(departmentSubmissionsTable).values({ id: `submission_${crypto.randomUUID()}`, departmentId: req.params.departmentId, submittedBy: req.get("x-user-id")?.trim() || "demo-department-user", assignmentCount: active.length }).returning();
  res.status(201).json(row);
} catch (error) { next(error); } });
export default router;
