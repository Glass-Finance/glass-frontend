import { useMutation } from "@tanstack/react-query";
import { resolveAccount } from "../api/members";

/**
 * Resolve an account number to its registered name (via the payment
 * provider).
 *
 * A mutation, so it belongs behind a hook like every other request
 * (see docs/data-fetching.md). It deliberately does NOT raise a toast on
 * failure: the account form shows the failure inline and falls back to
 * manual entry, and a toast on top of that is noise.
 */
export function useResolveAccount() {
  return useMutation({
    mutationFn: ({ bankCode, accountNumber }) => resolveAccount(bankCode, accountNumber),
  });
}
