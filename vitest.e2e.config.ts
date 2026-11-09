import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        dedupe: ["graphql"]
    },
    test: {
        server: {
            deps: {
                inline: ["graphql", "graphql-http"]
            }
        },
        include: ["tests/e2e/**/*.test.ts"],
        globalSetup: ["./tests/e2e/global-setup.ts"],

        // Les tests partagent une même base de test.
        fileParallelism: false
    }
});