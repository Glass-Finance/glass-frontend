import { useCallback, useEffect, useRef, useState } from "react";
import { notifyError, getRetryAfterSeconds } from "../utils/errorHandler";
import { useCountdown } from "./useCountdown";

// ---------------------------------------------------------------------------
// useOtpSend — the one owner of "ask the backend to send me a code".
//
// Every OTP surface used to hand-roll this: fire the request, and on failure
// write a line of text and swallow the toast (`notifyError(..., { silent:
// true })`). That made a failed send indistinguishable from a slow one —
//
//   - the screen kept saying a code had been sent,
//   - nothing was toasted, so on a phone the only signal was a `text-xs`
//     line under six empty boxes,
//   - a 4xx is filtered out of Sentry by monitoring.js, and notifyError only
//     writes to the console in dev, so production had NO trace of it.
//
// The API's own limiters are per-IP (POST /auth/otp/request allows 3 a
// minute, POST /auth/verify/resend 5), and a phone on mobile data shares one
// public IP with every other subscriber behind the same carrier NAT. A send
// can therefore be refused for reasons that have nothing to do with the
// person tapping — and until now that refusal was invisible. So a send
// failure is LOUD here: toasted, kept inline, and the screen is told what
// happened instead of claiming a code is on its way.
//
// The hook owns:
//   - the status machine (idle -> sending -> sent | failed),
//   - the error message (toasted AND returned, for inline display),
//   - the cooldown on the send action, driven by the server's Retry-After
//     when a 429 comes back, so a rate-limited person is told to wait
//     exactly as long as the server asked instead of hitting the endpoint
//     again and being refused again.
// ---------------------------------------------------------------------------

// Seconds the send action stays locked after a code was actually dispatched.
// Long enough that a screen full of taps can't outrun the API's per-minute
// limiter.
const SUCCESS_COOLDOWN = 60;

// Seconds the send action stays locked after a failure that carried no
// Retry-After. Short: nothing was sent, so the person is free to try again
// once whatever broke has had a moment to recover.
const FAILURE_COOLDOWN = 15;

export function useOtpSend({
  sendRequest,
  onSent,
  context = "Send code",
  fallback = "We couldn't send a code. Please try again.",
  autoSend = false,
  initialCooldown = 0,
  successCooldown = SUCCESS_COOLDOWN,
  failureCooldown = FAILURE_COOLDOWN,
} = {}) {
  const [status, setStatus] = useState(autoSend ? "sending" : "idle");
  const [error, setError] = useState("");
  // Sticky: true once any send has gone out, and never reset. A FAILED
  // resend after a successful send means "the new one didn't arrive", not
  // "no code was ever sent" -- the caller needs both facts to word the
  // screen correctly.
  const [everSent, setEverSent] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);
  // The countdown only restarts when this key changes — see useCountdown.
  const [cooldownKey, setCooldownKey] = useState(0);
  const cooldownSeconds = useCountdown(cooldown, cooldownKey);

  // `sendRequest` and `onSent` are read through refs so the mount effect
  // below can stay dependency-free: a caller may pass an inline closure
  // without that re-firing the send.
  const sendRef = useRef(sendRequest);
  const onSentRef = useRef(onSent);
  useEffect(() => {
    sendRef.current = sendRequest;
    onSentRef.current = onSent;
  });

  // StrictMode double-invokes effects in dev, which would otherwise fire two
  // real OTP sends off a single mount. The ref guard survives the simulated
  // remount (React 19 keeps the same ref object across it), so exactly one
  // send goes out.
  const didAutoSend = useRef(false);

  const attempt = useCallback(async () => {
    setStatus("sending");
    setError("");
    try {
      const result = await sendRef.current();
      setStatus("sent");
      setEverSent(true);
      setCooldown(successCooldown);
      setCooldownKey((k) => k + 1);
      onSentRef.current?.(result);
      return result;
    } catch (err) {
      // Deliberately NOT silent. A send that failed is the difference between
      // "check your inbox" and "nothing was ever dispatched", and the person
      // is the only one who can act on the difference.
      const message = notifyError(err, { context, fallback });
      const retryAfter = getRetryAfterSeconds(err);
      setStatus("failed");
      setError(retryAfter ? `${message} Try again in ${retryAfter}s.` : message);
      // A 429 is the API's own limiter answering: wait exactly as long as it
      // asked (Retry-After), not a guess.
      setCooldown(retryAfter ?? failureCooldown);
      setCooldownKey((k) => k + 1);
      return null;
    }
  }, [context, fallback, successCooldown, failureCooldown]);

  useEffect(() => {
    if (!autoSend || didAutoSend.current) return;
    didAutoSend.current = true;
    // Bypasses the cooldown on purpose: the lock exists to stop a person
    // hammering the endpoint, not to hold back the very first request.
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The user-facing trigger. Respects the cooldown, so a screen full of taps
  // can't outrun the API's per-minute limiter.
  const send = useCallback(async () => {
    if (cooldownSeconds > 0) return null;
    return attempt();
  }, [attempt, cooldownSeconds]);

  return {
    status,
    sending: status === "sending",
    sent: status === "sent",
    failed: status === "failed",
    everSent,
    error,
    cooldownSeconds,
    send,
  };
}
