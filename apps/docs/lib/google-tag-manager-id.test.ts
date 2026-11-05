import { describe, expect, it } from "vitest";
import { getGoogleTagManagerId } from "./google-tag-manager-id";

describe("getGoogleTagManagerId", () => {
  it("accepts a valid Google Tag Manager container ID", () => {
    expect(getGoogleTagManagerId("GTM-5TQQW6RK")).toBe("GTM-5TQQW6RK");
  });

  it.each([undefined, "", "G-5TQQW6RK", "GTM-lowercase", "GTM-5TQQW6RK<script>"])(
    "rejects an invalid container ID: %s",
    (value) => {
      expect(getGoogleTagManagerId(value)).toBeUndefined();
    },
  );
});
