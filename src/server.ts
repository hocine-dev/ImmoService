import "dotenv/config";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3001);

const server = app.listen(port, () => {
  console.log(`ImmoService : http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error(`Démarrage impossible : ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close());
}
