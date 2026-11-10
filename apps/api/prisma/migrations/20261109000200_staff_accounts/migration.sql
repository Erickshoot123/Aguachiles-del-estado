ALTER TABLE "users"
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
