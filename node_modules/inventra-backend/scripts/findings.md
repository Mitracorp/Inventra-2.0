Diagnostic findings (summary)

1) Controllers that work with simple DB queries:
   - `historyLogController.js` (audit logs)
   - `profileController.js` (account settings)

2) Controllers with frequent failures / heavier dependencies:
   - `assetController.js` (many JOINs, Asset model helpers, filesystem usage in import flows)
   - `pmController.js` (PDF generation, archiver, multer, heavy SQL)
   - `pmReportController.js` (ExcelJS, large queries)
   - `solutionPrincipalController.js` (depends on SOLUTION_PRINCIPAL table)

3) Likely root causes:
   - Missing node modules in the Passenger runtime (nodevenv mismatch).  Evidence: heavy controllers import `exceljs`, `archiver`, `pdfGenerator`.
   - Missing DB tables or permission issues (PMAINTENANCE, INVENTORY, CUSTOMER, PROJECT, SOLUTION_PRINCIPAL).
   - Filesystem permission or missing generated PDF files causing runtime errors in PM endpoints.

4) Immediate recommended actions (run on server):
   - Run `node scripts/diagnose_runtime.js` from backend (with DB env vars set if possible).
   - Install npm modules into the nodevenv path and symlink `node_modules` (see remediation.md).
   - Tail passenger log and reproduce failing request to capture stack trace.

5) Next steps I can take for you:
   - Parse and summarize the Passenger stack trace if you paste it here.
   - Help craft SQL checks or small schema fixes if tables are missing.
   - Update controllers to fail more gracefully or add feature toggles to avoid PDF/Excel generation until modules are available.
