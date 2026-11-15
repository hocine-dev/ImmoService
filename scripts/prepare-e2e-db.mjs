import "dotenv/config";
import { execFileSync } from "node:child_process";

const testUrl = process.env.DATABASE_URL_TEST;
const devUrl = process.env.DATABASE_URL;

// Vérifier que la base de test est correctement configurée.
if (!testUrl || !/test/i.test(new URL(testUrl).pathname)) {
    throw new Error("DATABASE_URL_TEST doit désigner une base de test");
}

// Interdire toute opération sur la base de développement.
if (devUrl) {
    const test = new URL(testUrl);
    const dev = new URL(devUrl);

    if (
        test.hostname === dev.hostname &&
        (test.port || "5432") === (dev.port || "5432") &&
        test.pathname === dev.pathname
    ) {
        throw new Error("La base E2E est identique à la base de développement");
    }
}

// Forcer Prisma à utiliser exclusivement la base E2E.
const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: testUrl
};

// Appliquer les migrations.
execFileSync("npm", ["run", "db:deploy"], {
    env,
    stdio: "inherit"
});

// Initialiser les comptes et les annonces de démonstration.
execFileSync("npm", ["run", "db:seed"], {
    env,
    stdio: "inherit"
});
