import { createInterface } from "node:readline";
import { complete } from "./complete.js";
import { loadSpec } from "./specs.js";

type Request = {
  id: number;
  line: string;
  cwd: string;
};

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

// Prime the most common spec before the first keystroke reaches the worker.
await loadSpec("git");

for await (const raw of input) {
  try {
    const request = JSON.parse(raw) as Request;
    const completions = await complete(request.line, request.cwd);
    process.stdout.write(`${JSON.stringify({ id: request.id, completions })}\n`);
  } catch {
    process.stdout.write(`${JSON.stringify({ id: -1, completions: [] })}\n`);
  }
}
