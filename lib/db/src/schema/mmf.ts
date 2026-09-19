import { jsonb, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mmfImportsTable = pgTable("mmf_imports", {
  id: text("id").primaryKey(),
  sourceFileName: text("source_file_name").notNull(),
  sourceFileHash: text("source_file_hash").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  worksheetName: text("worksheet_name").notNull(),
  rowCount: integer("row_count").notNull(),
  columnCount: integer("column_count").notNull(),
  departmentCount: integer("department_count").notNull(),
  uniqueIdentifierCount: integer("unique_identifier_count").notNull(),
  missingIdentifierCount: integer("missing_identifier_count").notNull(),
  conflictGroupCount: integer("conflict_group_count").notNull(),
  warningCount: integer("warning_count").notNull(),
  errorCount: integer("error_count").notNull(),
  status: text("status").notNull().default("review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  committedAt: timestamp("committed_at", { withTimezone: true }),
  uploadedBy: text("uploaded_by").notNull().default("demo-operator"),
  importerVersion: text("importer_version").notNull().default("stage-1-browser-parser"),
  sourceObjectPath: text("source_object_path"),
  sourceObjectContentType: text("source_object_content_type"),
  previewRows: jsonb("preview_rows").notNull().default([]),
  issues: jsonb("issues").notNull().default([]),
});

export const insertMmfImportSchema = createInsertSchema(mmfImportsTable);
export type InsertMmfImport = z.infer<typeof insertMmfImportSchema>;
export type MmfImport = typeof mmfImportsTable.$inferSelect;