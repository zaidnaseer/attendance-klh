-- Optional section label (e.g. "A", "B") so one subject can be taught to several classes.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS section VARCHAR(50);
