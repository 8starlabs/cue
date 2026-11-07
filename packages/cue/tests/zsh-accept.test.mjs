import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, it } from "vitest";

const bridge = fileURLToPath(new URL("../zsh/cue.zsh", import.meta.url));

function pressKey({ line, selected, replacement = "", cursor = line.length, key = "enter" }) {
  const result = spawnSync(
    "zsh",
    [
      "-f",
      "-c",
      `
      CUE_HOME=/dev/null
      source "$1"
      _cue_send_hide() { :; }
      zle() { [[ "$1" != .accept-line ]] || print -r -- accepted; }
      BUFFER="$2"
      CURSOR="$3"
      LBUFFER="\${BUFFER[1,$CURSOR]}"
      RBUFFER="\${BUFFER[$(( CURSOR + 1 )),-1]}"
      CUE_SELECTION_BUFFER="$BUFFER"
      CUE_SELECTION_CURSOR="$CURSOR"
      CUE_SELECTED_VALUE="$4"
      CUE_SELECTED_REPLACEMENT="$5"
      if [[ "$6" == tab ]]; then
        _cue_tab_widget
      else
        _cue_accept_widget
      fi
      print -r -- "$BUFFER"
      print -r -- "$CURSOR"
    `,
      "cue-test",
      bridge,
      line,
      String(cursor),
      selected,
      replacement,
      key,
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trimEnd().split("\n");
}

describe("Cue Enter", () => {
  it("runs an already complete npm script on the first Enter", () => {
    expect(pressKey({ line: "npm run start", selected: "start" })).toEqual([
      "accepted",
      "npm run start",
      "13",
    ]);
  });

  it("runs an unchanged full-line replacement", () => {
    expect(
      pressKey({ line: "npm run start", selected: "start", replacement: "npm run start" }),
    ).toEqual(["accepted", "npm run start", "13"]);
  });

  it("inserts a completion without running it", () => {
    expect(pressKey({ line: "npm run sta", selected: "start" })).toEqual(["npm run start", "13"]);
  });

  it("does not run when only the cursor moves", () => {
    expect(
      pressKey({ line: "echo hello", selected: "hello", replacement: "echo {cursor}hello" }),
    ).toEqual(["echo hello", "5"]);
  });

  it("does not execute an unchanged suggestion on Tab", () => {
    expect(pressKey({ line: "npm run start", selected: "start", key: "tab" })).toEqual([
      "npm run start",
      "13",
    ]);
  });
});
