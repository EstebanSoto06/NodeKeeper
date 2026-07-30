-- Preserve maintenance history: a NetworkNode or Equipment that still has
-- Maintenance rows referencing it must not be deletable. Previously these
-- two foreign keys cascaded, which silently destroyed Maintenance (and, via
-- its own cascades, ChecklistTask/Evidence) whenever a catalog entry was
-- removed, without any application-level cleanup of the physical evidence
-- files on disk. Switching to RESTRICT makes the database itself the
-- authoritative defense: the delete now fails at the constraint level
-- (Postgres error 23503), independent of any prior application check.
-- No data is deleted or transformed by this migration.

ALTER TABLE "Maintenance" DROP CONSTRAINT "Maintenance_networkNodeId_fkey";
ALTER TABLE "Maintenance" DROP CONSTRAINT "Maintenance_equipmentId_fkey";

ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_networkNodeId_fkey" FOREIGN KEY ("networkNodeId") REFERENCES "NetworkNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
