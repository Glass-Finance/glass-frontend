import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TextInput } from "../../../components/ui/TextInput";

// The Glass focus treatment for a text field is stroke-only: the border itself
// changes to the brand blue (#002FA7, exposed as --color-brand). It is
// deliberately NOT a focus ring and NOT a background fill -- a filled active
// state reads as a button rather than a field, and a ring paints a second
// brand-coloured edge *outside* the border, which is what made focus look
// doubled across the app.
//
// This test guards that contract at the component most of the app shares
// (sign-up, join, and anything importing TextInput directly). The negative
// assertions are the point: they fail if someone "improves" the focus state by
// reaching for ring-*/shadow-*, which is exactly the regression being prevented.
//
// The focus border is asserted semantically (a focus border utility resolving
// to the brand token, spelled either `focus:border-brand` or the literal
// `focus:border-[#002FA7]`) rather than against one exact string, so switching
// between the token and the literal isn't a false failure. The rendering is
// identical either way -- both compile to #002fa7.
//
// The `focus:border-*` counterpart for controls that don't go through TextInput
// is the @layer base rule in src/index.css -- a safety net, not the source of
// truth, deliberately placed so component utilities still override it.
afterEach(cleanup);

function input() {
  return screen.getByPlaceholderText("Enter Your Password");
}

// Matches a focus-scoped border utility aimed at the brand colour.
const BRAND_FOCUS_BORDER = /focus:border-(brand|\[#002FA7\]|primary)/i;
// Matches any ring utility, in any form (ring, ring-2, ring-inset, ring-brand).
const ANY_RING = /(^|\s)ring(-|$)/;

describe("TextInput focus treatment", () => {
  it("signals focus with a brand border colour change", () => {
    render(<TextInput placeholder="Enter Your Password" />);
    expect(input().className).toMatch(BRAND_FOCUS_BORDER);
  });

  it("applies the same focus border in the sign-up variant", () => {
    render(<TextInput variant="signup" placeholder="Enter Your Password" />);
    expect(input().className).toMatch(BRAND_FOCUS_BORDER);
  });

  it("has a resting border for focus to change away from", () => {
    render(<TextInput placeholder="Enter Your Password" />);
    // Any resting border utility, and it must not already be the brand colour
    // (otherwise focus would be visually indistinguishable from rest).
    expect(input().className).toMatch(/(^|\s)border-/);
    expect(input().className).not.toMatch(/(^|\s)border-brand(\s|$)/);
  });

  it("uses no focus ring", () => {
    render(<TextInput placeholder="Enter Your Password" />);
    expect(input().className).not.toMatch(ANY_RING);
  });

  it("uses no shadow-based focus halo and no focus fill", () => {
    render(<TextInput placeholder="Enter Your Password" />);
    const cls = input().className;
    expect(cls).not.toContain("shadow");
    // Stroke-only: the active state must not fill the field.
    expect(cls).not.toMatch(/(^|\s)focus:bg-/);
  });

  it("keeps focus a border change even when the field is in an error state", () => {
    render(<TextInput error="Required" placeholder="Enter Your Password" />);
    const cls = input().className;
    expect(cls).toContain("border-danger");
    expect(cls).toMatch(BRAND_FOCUS_BORDER);
    expect(cls).not.toMatch(ANY_RING);
  });

  it("marks an invalid field for assistive tech", () => {
    render(<TextInput error="Required" placeholder="Enter Your Password" />);
    expect(input().getAttribute("aria-invalid")).toBe("true");
  });
});

// The accessible name is owned by this component, not left to each call site.
// A hand-written sibling <label> can silently lose its htmlFor, and a
// placeholder is not an accessible name -- so the `label` prop renders a real
// <label htmlFor> bound to the field, and `hideLabel` keeps that label in the
// accessibility tree without showing it.
describe("TextInput accessible name", () => {
  it("binds the label prop to the field with htmlFor", () => {
    render(<TextInput label="Email address" placeholder="Enter Your Password" />);
    const field = input();
    const label = document.querySelector(`label[for="${field.id}"]`);
    expect(label).not.toBeNull();
    expect(label.textContent).toBe("Email address");
  });

  it("keeps the label in the accessibility tree but hides it visually", () => {
    render(<TextInput label="Search members" hideLabel placeholder="Search" />);
    const field = screen.getByPlaceholderText("Search");
    const label = document.querySelector(`label[for="${field.id}"]`);
    expect(label).not.toBeNull();
    expect(label.textContent).toBe("Search members");
    expect(label.className).toContain("sr-only");
  });

  it("gives the field an id even when the caller passes none", () => {
    render(<TextInput label="Amount" placeholder="Enter Your Password" />);
    expect(input().id).toBeTruthy();
  });

  it("generates an id that is safe to use in a CSS selector", () => {
    // React's useId() returns something like ":r0:" / "«r0»". A colon is
    // legal in an id but breaks every querySelector('#...') against it.
    render(<TextInput label="Amount" placeholder="Enter Your Password" />);
    expect(input().id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("gives two fields distinct ids", () => {
    render(
      <>
        <TextInput label="First" placeholder="a" />
        <TextInput label="Second" placeholder="b" />
      </>,
    );
    expect(screen.getByPlaceholderText("a").id).not.toBe(screen.getByPlaceholderText("b").id);
  });

  it("points the field at its error text when the caller says where it is", () => {
    render(
      <>
        <TextInput error="Required" errorId="amount-error" placeholder="Enter Your Password" />
        <p id="amount-error">Required</p>
      </>,
    );
    expect(input().getAttribute("aria-describedby")).toBe("amount-error");
  });

  it("does not describe the field by an error id when there is no error", () => {
    render(<TextInput errorId="amount-error" placeholder="Enter Your Password" />);
    expect(input().getAttribute("aria-describedby")).toBeNull();
  });
});
