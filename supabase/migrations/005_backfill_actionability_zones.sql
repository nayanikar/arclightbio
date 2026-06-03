-- One-time zone backfill from confidence_score (demo thresholds 30% / 75%)
UPDATE opportunity_objects
SET actionability_zone = CASE
  WHEN confidence_score < 0.30 THEN 'too_early'
  WHEN confidence_score > 0.75 THEN 'crowded'
  ELSE 'act_now'
END
WHERE status != 'archived';
