-- CreateTable
CREATE TABLE "snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source_id" INTEGER NOT NULL,
    "fetched_at" DATETIME NOT NULL,
    "http_status" INTEGER,
    "content_hash" TEXT,
    "raw_path" TEXT,
    CONSTRAINT "snapshots_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "changes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source_id" INTEGER NOT NULL,
    "detected_at" DATETIME NOT NULL,
    "prev_snapshot_id" INTEGER,
    "new_snapshot_id" INTEGER NOT NULL,
    "parse_status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "changes_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "changes_prev_snapshot_id_fkey" FOREIGN KEY ("prev_snapshot_id") REFERENCES "snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "changes_new_snapshot_id_fkey" FOREIGN KEY ("new_snapshot_id") REFERENCES "snapshots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "service" TEXT NOT NULL,
    "started_at" DATETIME,
    "resolved_at" DATETIME,
    "severity" TEXT,
    "title" TEXT,
    "source_change_id" INTEGER,
    CONSTRAINT "incidents_source_change_id_fkey" FOREIGN KEY ("source_change_id") REFERENCES "changes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sources" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "company_name" TEXT NOT NULL,
    "insurance_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetch_type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fetch_interval_min" INTEGER NOT NULL DEFAULT 1440,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_sources" ("active", "company_name", "created_at", "fetch_type", "id", "insurance_type", "note", "updated_at", "url") SELECT "active", "company_name", "created_at", "fetch_type", "id", "insurance_type", "note", "updated_at", "url" FROM "sources";
DROP TABLE "sources";
ALTER TABLE "new_sources" RENAME TO "sources";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "snapshots_source_id_idx" ON "snapshots"("source_id");

-- CreateIndex
CREATE INDEX "changes_source_id_idx" ON "changes"("source_id");
