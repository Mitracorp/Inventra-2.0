-- Add soft-delete support for tables used by Undo in Audit Log
-- MySQL 8.0+ supports IF NOT EXISTS for ADD COLUMN/INDEX

ALTER TABLE SOLUTION_PRINCIPAL
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL;

ALTER TABLE PMAINTENANCE
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL;

ALTER TABLE SOLUTION_PRINCIPAL
  ADD INDEX IF NOT EXISTS idx_solution_principal_deleted_at (deleted_at);

ALTER TABLE PMAINTENANCE
  ADD INDEX IF NOT EXISTS idx_pmaintenance_deleted_at (deleted_at);
