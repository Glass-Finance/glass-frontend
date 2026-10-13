import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Regression coverage for the Role settings loading skeleton.
//
// Two things are pinned here:
//
// 1. `aria-busy` must sit on a container that is NOT `aria-hidden`. Hiding the
//    wrapper removed it from the accessibility tree, which made its own
//    `aria-busy` inert — a screen-reader user got no announcement at all while
//    the section loaded.
// 2. The skeleton keeps two tones. It went through the shared `Skeleton`,
//    which hardcoded `bg-gray-200`, so the lighter bar flattened onto the
//    darker one.

vi.mock("../../../../../hooks/useActiveCommunityId", () => ({
  useActiveCommunityId: () => "community-1",
}));

const useMyMemberRecord = vi.fn();
const updateCommunityMember = vi.fn();

vi.mock("../../../../../hooks/useMyAccount", () => ({
  useMyMemberRecord: () => useMyMemberRecord(),
}));

vi.mock("../../../../../api/communities", () => ({
  updateCommunityMember: (...args) => updateCommunityMember(...args),
}));

import Role from "../../../../../pages/dashboard/settings/account/Role";

function renderLoading() {
  useMyMemberRecord.mockReturnValue({ data: undefined, isLoading: true, error: null });
  // Role calls useQueryClient() for its role mutations, so it needs a provider
  // even though this suite only exercises the loading branch.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Role />
    </QueryClientProvider>,
  );
}

describe("Role settings loading skeleton", () => {
  it("marks the loading region busy on a container that is exposed to AT", () => {
    const { container } = renderLoading();

    const busy = container.querySelector("[aria-busy]");
    expect(busy).not.toBeNull();
    expect(busy.getAttribute("aria-busy")).toBe("true");
    // The whole point: a hidden ancestor would make the busy state inert.
    expect(busy.getAttribute("aria-hidden")).toBeNull();
  });

  it("has no ancestor that would hide the busy region", () => {
    const { container } = renderLoading();

    const busy = container.querySelector("[aria-busy]");
    let node = busy.parentElement;
    while (node) {
      expect(node.getAttribute("aria-hidden")).toBeNull();
      node = node.parentElement;
    }
  });

  it("hides the decorative option shells from assistive tech", () => {
    const { container } = renderLoading();

    // The option shells are bare pulsing divs, not `Skeleton`, so they need
    // their own aria-hidden.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it("keeps two distinct tones rather than flattening to one", () => {
    const { container } = renderLoading();

    // Narrow to the `Skeleton` bars: they carry the standalone `rounded`
    // class, whereas the option shells use `rounded-xl`. Without this filter
    // the shell's own bg-gray-100 would satisfy the check even if every
    // skeleton bar had collapsed onto a single tone.
    const bars = [...container.querySelectorAll('[aria-hidden="true"]')].filter((el) =>
      el.classList.contains("rounded"),
    );
    expect(bars.length).toBeGreaterThan(1);

    const tones = bars.map((el) =>
      ["bg-gray-200", "bg-gray-100", "bg-hairline-soft"].find((c) => el.classList.contains(c)),
    );
    expect(tones).toContain("bg-gray-200");
    expect(tones).toContain("bg-gray-100");
    expect(tones.every(Boolean)).toBe(true);
  });
});
