
import "dotenv/config";

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3002;
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * Refuser tout serveur déjà présent sur le port E2E.
 * On ne doit jamais tester un serveur lancé manuellement.
 */
async function verifyPortFree(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const server = createServer();

        server.once("error", () => {
            reject(
                new Error(
                    `Port ${PORT} déjà occupé. Arrête le serveur existant.`
                )
            );
        });

        server.listen(PORT, () => {
            server.close(error => {
                if (error) reject(error);
                else resolve();
            });
        });
    });
}

export default async function setup() {
    const testUrl = process.env.DATABASE_URL_TEST;

    if (!testUrl) {
        throw new Error(
            "DATABASE_URL_TEST obligatoire pour les tests E2E"
        );
    }

    const testDb = new URL(testUrl);

    // Convention de sécurité : nom de base contenant "test".
    if (!/test/i.test(testDb.pathname)) {
        throw new Error(
            "La base E2E doit être une base dédiée aux tests"
        );
    }

    // Empêcher de réutiliser la base de développement.
    if (process.env.DATABASE_URL) {
        const devDb = new URL(process.env.DATABASE_URL);

        const sameDatabase =
            testDb.hostname === devDb.hostname &&
            (testDb.port || "5432") === (devDb.port || "5432") &&
            testDb.pathname === devDb.pathname;

        if (sameDatabase) {
            throw new Error(
                "La base E2E est identique à la base de développement"
            );
        }
    }

    await verifyPortFree();

    // Serveur enfant : DATABASE_URL forcée vers la base de test.
    const server = spawn(
        process.execPath,
        ["--import", "tsx", "src/server.ts"],
        {
            env: {
                ...process.env,
                NODE_ENV: "test",
                PORT: String(PORT),
                DATABASE_URL: testUrl
            },
            stdio: "inherit"
        }
    );

    let startupError: Error | undefined;

    server.on("error", error => {
        startupError = error;
    });

    try {
        // Attendre que notre serveur soit prêt.
        for (let attempt = 0; attempt < 100; attempt++) {
            if (startupError) throw startupError;

            if (server.exitCode !== null) {
                throw new Error("Le serveur E2E s'est arrêté");
            }

            try {
                const response = await fetch(`${BASE}/health`, {
                    signal: AbortSignal.timeout(400)
                });

                if (response.ok) {
                    // Arrêt automatique après tous les tests.
                    return () => {
                        server.kill("SIGTERM");
                    };
                }
            } catch {
                // Le serveur n'est pas encore disponible.
            }

            await sleep(100);
        }

        throw new Error("Le serveur E2E ne démarre pas");
    } catch (error) {
        server.kill("SIGTERM");
        throw error;
    }
}
