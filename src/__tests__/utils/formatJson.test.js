import { describe, expect, it } from "vitest";
import { formatJson } from "../../utils/formatJson";

describe("formatJson", () => {
  it.each([
    {},
    [],
    { bands: [{ rate: 1.5, upToMinor: null }, { nested: [] }] },
    { text: 'braces {}[],: and escaped quotes " with a slash \\ and newline\n' },
    [true, false, null, {}, [], "two words"],
    "two words",
    0,
    null,
  ])("formats nested structures and string contents correctly: %j", (value) => {
    expect(formatJson(JSON.stringify(value))).toBe(JSON.stringify(value, null, 2));
  });

  it.each(["", "{", '{"rate":', '{"rate":1,}', "undefined"])(
    "leaves invalid JSON unformatted: %s",
    (value) => {
      expect(formatJson(value)).toBeNull();
    },
  );
});
