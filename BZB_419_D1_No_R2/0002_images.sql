CREATE TABLE online_images (
 id TEXT PRIMARY KEY NOT NULL,
 content BLOB NOT NULL,
 mime TEXT NOT NULL,
 created_at TEXT NOT NULL
);
