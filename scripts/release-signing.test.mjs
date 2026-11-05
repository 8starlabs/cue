import { describe, expect, it } from "vitest";
import { resolveReleaseSigningMode } from "./release-signing.mjs";

describe("release signing mode", () => {
  it("prefers a configured Developer ID identity", () => {
    expect(
      resolveReleaseSigningMode({
        CUE_CODESIGN_IDENTITY: "Developer ID Application: Cue (TEAMID)",
        CUE_ALLOW_ADHOC_RELEASE: "1",
      }),
    ).toBe("developer-id");
  });

  it("allows ad hoc signing only when explicitly opted in", () => {
    expect(resolveReleaseSigningMode({ CUE_ALLOW_ADHOC_RELEASE: "1" })).toBe("ad-hoc");
  });

  it("rejects missing signing configuration by default", () => {
    expect(() => resolveReleaseSigningMode({})).toThrow(/CUE_ALLOW_ADHOC_RELEASE=1/);
  });
});
