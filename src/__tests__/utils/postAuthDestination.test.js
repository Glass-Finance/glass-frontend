import { describe, it, expect } from "vitest";
import {
  resolvePostAuthDestination,
  MEMBER_HOME,
  MEMBER_INVITES,
  DASHBOARD_HOME,
  ADMIN_PANEL,
  DISCOVER_COMMUNITIES,
} from "../../utils/postAuthDestination";

const ADMIN = { isPlatformAdmin: false, isAdmin: true };
const PLATFORM_ADMIN = { isPlatformAdmin: true, isAdmin: true };
const MEMBER = { isPlatformAdmin: false, isAdmin: false };

describe("resolvePostAuthDestination", () => {
  it("routes platform admins to the admin panel", () => {
    expect(resolvePostAuthDestination({ user: PLATFORM_ADMIN })).toEqual({ to: ADMIN_PANEL });
  });

  it("routes community admins to the dashboard, honoring validated admin return paths", () => {
    expect(resolvePostAuthDestination({ user: ADMIN })).toEqual({ to: DASHBOARD_HOME });
    expect(
      resolvePostAuthDestination({ user: ADMIN, returnTo: "/dashboard/members?community=x" }),
    ).toEqual({ to: "/dashboard/members?community=x" });
    // A forged member-context return path cannot lift an admin elsewhere.
    expect(
      resolvePostAuthDestination({ user: ADMIN, returnTo: "https://evil.example.com" }),
    ).toEqual({ to: DASHBOARD_HOME });
  });

  it("routes members to the member app on desktop as well as mobile", () => {
    expect(resolvePostAuthDestination({ user: MEMBER })).toEqual({ to: MEMBER_HOME });
  });

  it("returns a join-community descriptor for pending shareable links", () => {
    expect(resolvePostAuthDestination({ user: MEMBER, pendingCommunity: "acme" })).toEqual({
      joinCommunity: "acme",
    });
  });

  it("honors validated member return paths", () => {
    expect(resolvePostAuthDestination({ user: MEMBER, returnTo: "/member/invites" })).toEqual({
      to: MEMBER_INVITES,
    });
  });

  it("resumes interrupted payments via the callback", () => {
    expect(resolvePostAuthDestination({ user: MEMBER, pendingPaymentRef: "ref-1" })).toEqual({
      to: "/payment/callback?reference=ref-1",
    });
  });

  it("routes register-path invites home and Google-path invites to manual accept", () => {
    expect(resolvePostAuthDestination({ user: MEMBER, inviteToken: "tok" })).toEqual({
      to: MEMBER_HOME,
    });
    expect(
      resolvePostAuthDestination({ user: MEMBER, inviteToken: "tok", viaGoogle: true }),
    ).toEqual({ to: MEMBER_INVITES });
  });

  it("routes pending invites to the invites page, else the fallback", () => {
    expect(resolvePostAuthDestination({ user: MEMBER, hasPendingInvites: true })).toEqual({
      to: MEMBER_INVITES,
    });
    expect(resolvePostAuthDestination({ user: MEMBER })).toEqual({ to: MEMBER_HOME });
    expect(resolvePostAuthDestination({ user: MEMBER, fallback: DISCOVER_COMMUNITIES })).toEqual({
      to: DISCOVER_COMMUNITIES,
    });
  });

  it("applies precedence: return path beats payment ref beats invites", () => {
    expect(
      resolvePostAuthDestination({
        user: MEMBER,
        returnTo: "/member/invites",
        pendingPaymentRef: "ref-1",
        hasPendingInvites: true,
      }),
    ).toEqual({ to: MEMBER_INVITES });
    expect(
      resolvePostAuthDestination({
        user: MEMBER,
        pendingPaymentRef: "ref-1",
        hasPendingInvites: true,
      }),
    ).toEqual({ to: "/payment/callback?reference=ref-1" });
  });
});
