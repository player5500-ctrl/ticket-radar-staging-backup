INSERT OR IGNORE INTO data_sources (
  id,key,name,source_category,base_url,sync_method,status,agreement_status,requires_agreement,
  terms_summary,rate_limit_per_hour,sync_frequency_minutes,credibility_base_score,notes,
  created_at_utc,updated_at_utc,enabled,trust_level,terms_status,robots_status,timeout_ms,retry_limit,adapter_version
) VALUES (
  'src-manual-submission','manual_submission','Manual official URL submission','user_submitted',NULL,'manual_entry','active','not_required',0,
  'User-submitted official URLs require verification before publication.',60,NULL,20,'No automated crawl; every candidate requires admin verification.',
  '2026-08-04T00:00:00.000Z','2026-08-04T00:00:00.000Z',1,'unverified','allowed','allowed',5000,0,'phase0-manual-v1'
);
