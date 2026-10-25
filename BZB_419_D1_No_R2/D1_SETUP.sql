CREATE TABLE IF NOT EXISTS online_assignments (
 id TEXT PRIMARY KEY NOT NULL,
 token TEXT UNIQUE NOT NULL,
 data TEXT NOT NULL,
 open INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS online_submissions (
 id TEXT PRIMARY KEY NOT NULL,
 assignment_id TEXT NOT NULL REFERENCES online_assignments(id),
 request_id TEXT NOT NULL,
 name TEXT NOT NULL,
 grade TEXT NOT NULL,
 variant INTEGER NOT NULL,
 answers TEXT NOT NULL,
 scores TEXT NOT NULL,
 feedback TEXT NOT NULL DEFAULT '',
 submitted_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS submission_retry_idx ON online_submissions(assignment_id,request_id);

CREATE INDEX IF NOT EXISTS submissions_assignment_idx ON online_submissions(assignment_id);

CREATE TABLE IF NOT EXISTS online_images (
 id TEXT PRIMARY KEY NOT NULL,
 content BLOB NOT NULL,
 mime TEXT NOT NULL,
 created_at TEXT NOT NULL
);
