-- Migration 011: Add layout_modelo1 and layout_modelo2 columns to eventos table.
-- These fields store the stamp layout template for each model (motivo).
-- Values: 'derecha', 'izquierda', 'inferior', 'superior'
-- Default: 'derecha' (image on the right, text on the left)

ALTER TABLE eventos ADD COLUMN layout_modelo1 TEXT NOT NULL DEFAULT 'derecha';
ALTER TABLE eventos ADD COLUMN layout_modelo2 TEXT NOT NULL DEFAULT 'derecha';
