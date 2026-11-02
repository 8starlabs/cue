import { complete } from "./complete.js";

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const zshMode = args[0] === "--zsh";
const line = (zshMode ? args.slice(1) : args).join(" ");
const results = await complete(line, process.env.CUE_CWD ?? process.cwd());
if (zshMode) {
  for (const item of results) {
    process.stdout.write(
      `${item.insertValue}\0${item.replaceValue ?? ""}\0${item.description ?? ""}\0`,
    );
  }
} else {
  process.stdout.write(`${JSON.stringify(results)}\n`);
}
