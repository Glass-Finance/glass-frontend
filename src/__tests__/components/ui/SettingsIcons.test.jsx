import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as SettingsIcons from "../../../components/ui/icons/SettingsIcons";

// SVG <mask> is luminance-based by default, and its fill never reaches the
// screen -- it only decides *where* the drawn path shows. Painting it with
// `currentColor` resolves to --color-ink (#000000) inside the settings rows,
// which has luminance 0, so the mask erases the glyph and the row renders
// with a blank leading icon. That is what shipped for IconSecurity and
// IconAutopay, blanking the member Security, Auto-Pay and Multi-Factor
// Authentication rows while every unmasked icon looked fine.
//
// The colour the user actually sees comes from the drawn path's
// stroke="currentColor" outside the mask, so the two must stay decoupled:
// masks stay white, drawn paths stay currentColor.
const MASKED = ["IconRole", "IconSecurity", "IconAutopay"];

describe("SettingsIcons — masked glyphs", () => {
  it.each(MASKED)("%s paints its mask white, not currentColor", (name) => {
    const { container } = render(SettingsIcons[name]({ size: 24 }));
    const masks = [...container.querySelectorAll("mask")];

    expect(masks.length).toBeGreaterThan(0);
    for (const mask of masks) {
      expect(mask.getAttribute("fill")).toBe("#fff");
    }
  });

  it("catches any new masked glyph so the list above cannot quietly go stale", () => {
    const withMask = [];

    for (const [name, Icon] of Object.entries(SettingsIcons)) {
      if (typeof Icon !== "function") continue;
      const { container, unmount } = render(<Icon size={24} />);
      if (container.querySelector("mask") !== null) withMask.push(name);
      unmount();
    }

    expect(withMask.sort()).toEqual([...MASKED].sort());
  });

  it("draws the glyph itself in currentColor so rows keep their text colour", () => {
    const { container } = render(SettingsIcons.IconSecurity({ size: 24 }));
    const drawn = [...container.querySelectorAll("path")].filter(
      (p) => p.getAttribute("mask") !== null,
    );

    expect(drawn.length).toBeGreaterThan(0);
    for (const path of drawn) {
      expect(path.getAttribute("stroke")).toBe("currentColor");
    }
  });
});
