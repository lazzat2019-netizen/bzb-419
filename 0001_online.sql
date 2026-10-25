CREATE TABLE online_assignments (
 id TEXT PRIMARY KEY NOT NULL,
 token TEXT UNIQUE NOT NULL,
 data TEXT NOT NULL,
 open INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE online_submissions (
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
--> statement-breakpoint
CREATE UNIQUE INDEX submission_retry_idx ON online_submissions(assignment_id,request_id);
--> statement-breakpoint
CREATE INDEX submissions_assignment_idx ON online_submissions(assignment_id);
