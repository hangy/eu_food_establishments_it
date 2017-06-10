-- Up
CREATE TABLE IF NOT EXISTS data (
  approvalNumber TEXT,
  name TEXT,
  vat TEXT,
  taxCode TEXT,
  townRegion TEXT,
  category TEXT,
  associatedActivities TEXT,
  species TEXT,
  remarks TEXT,
  section TEXT
);

-- Down
DROP TABLE data;
