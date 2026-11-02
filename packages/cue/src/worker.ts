import { createInterface } from "node:readline";
import { complete } from "./complete.js";
import { loadSpec } from "./specs.js";

type Request = {
  id: number;
  line: string;
  cwd: string;
  environmentVariables?: Record<string, string>;
};

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

function parseRequest(value: unknown): Request | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<Request>;
  if (
    !Number.isSafeInteger(candidate.id) ||
    (candidate.id as number) < 0 ||
    typeof candidate.line !== "string" ||
    candidate.line.length > 65_536 ||
    typeof candidate.cwd !== "string" ||
    candidate.cwd.length > 4_096
  ) {
    return undefined;
  }
  if (candidate.environmentVariables !== undefined) {
    if (!candidate.environmentVariables || typeof candidate.environmentVariables !== "object")
      return undefined;
    const variables = Object.entries(candidate.environmentVariables as object);
    if (
      variables.length > 512 ||
      variables.some(([key, entry]) => typeof key !== "string" || typeof entry !== "string") ||
      variables.reduce((size, [key, entry]) => size + key.length + String(entry).length, 0) >
        524_288
    ) {
      return undefined;
    }
  }
  return candidate as Request;
}

// Prime the most common spec before the first keystroke reaches the worker.
await loadSpec("git");

for await (const raw of input) {
  let id = -1;
  try {
    const request = parseRequest(JSON.parse(raw) as unknown);
    if (!request) throw new Error("Invalid completion request");
    id = request.id;
    const completions = await complete(
      request.line,
      request.cwd,
      undefined,
      request.environmentVariables,
    );
    process.stdout.write(`${JSON.stringify({ id: request.id, completions })}\n`);
  } catch {
    process.stdout.write(`${JSON.stringify({ id, completions: [] })}\n`);
  }
}
