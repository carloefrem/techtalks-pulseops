// Load backend/.env so TEST_DATABASE_URL reaches the database tests.
// Without this, tests/integration/database.test.ts is always skipped.
// The test guard (tests/setup/guard.ts) still refuses anything that is not a separate local *_test database.
import "dotenv/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
