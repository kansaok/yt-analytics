/* Proses terpisah dari web: `npm run worker`. */
import "./load-env";
import { registerSchedule, startWorkers } from "./workers";

async function main() {
  await registerSchedule();
  const ws = startWorkers();
  console.log(JSON.stringify({ msg: "worker siap", queues: Object.keys(ws) }));
  const stop = async () => {
    await Promise.all(Object.values(ws).map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main();
