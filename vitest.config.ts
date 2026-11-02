import "dotenv/config";
import { defineConfig } from "vitest/config";

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl || !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL et DATABASE_URL_TEST sont obligatoires.");
}
const dev = new URL(process.env.DATABASE_URL);
const test = new URL(testUrl);
if (dev.pathname === test.pathname || !test.pathname.endsWith("_test")) {
  throw new Error("Une base de test distincte avec suffixe _test est obligatoire.");
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    fileParallelism: false,
    env: { NODE_ENV: "test", DATABASE_URL: testUrl },
  },
});
