ALTER TABLE data_sources ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1));
ALTER TABLE data_sources ADD COLUMN trust_level TEXT NOT NULL DEFAULT 'unverified' CHECK (trust_level IN ('low','medium','high','unverified'));
ALTER TABLE data_sources ADD COLUMN terms_status TEXT NOT NULL DEFAULT 'unknown' CHECK (terms_status IN ('unknown','review_required','allowed','prohibited'));
ALTER TABLE data_sources ADD COLUMN robots_status TEXT NOT NULL DEFAULT 'unknown' CHECK (robots_status IN ('unknown','review_required','allowed','prohibited'));
ALTER TABLE data_sources ADD COLUMN timeout_ms INTEGER NOT NULL DEFAULT 5000;
ALTER TABLE data_sources ADD COLUMN retry_limit INTEGER NOT NULL DEFAULT 1;
ALTER TABLE data_sources ADD COLUMN adapter_version TEXT NOT NULL DEFAULT 'phase0-placeholder';
CREATE INDEX idx_data_sources_runtime_gate ON data_sources(enabled, terms_status, robots_status);
