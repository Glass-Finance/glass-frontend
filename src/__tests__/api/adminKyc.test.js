import { beforeEach, expect, it, vi } from "vitest";
import client from "../../api/client";
import * as api from "../../api/admin";

vi.mock("../../api/client", () => ({ default: { post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it("sends manual approval to the user-level endpoint with only a reason", async () => {
  client.post.mockResolvedValue({ data: { data: { status: "APPROVED", attemptId: null } } });
  await api.approveKycBypass("user-id", { reason: "Reviewed offline" });
  expect(client.post).toHaveBeenCalledWith("/admin/users/user-id/kyc/approve", {
    reason: "Reviewed offline",
  });
});
