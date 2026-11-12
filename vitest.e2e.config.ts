import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        dedupe: ["graphql"]
    },
    test: {

        include: ["tests/e2e/**/*.{test,e2e}.ts"],
        server: {
            deps: {
                inline: ["graphql", "graphql-http"]
            }
        },
        globalSetup: ["./tests/e2e/global-setup.ts"],

        // Les tests partagent une même base de test.
        fileParallelism: false,
        testTimeout: 20000,
        hookTimeout: 20000

    }
});