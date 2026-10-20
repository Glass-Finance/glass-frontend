// Avatar-initials fallback, shared by the dashboard account block
// (components/dashboard/Topbar.jsx) and the member app header
// (components/memberApp/ProfileAvatar.jsx) so the two can't drift.
//
// `firstName`/`lastName` only exist after AuthContext's GET /user/me
// hydration (the login/register response itself carries just
// {id, email, role, emailVerified}), so fall back to the first two
// characters of the email while that request is still in flight — and to
// "?" when there is nothing at all to build an avatar from, rather than
// rendering an empty circle.
export function getInitials(user) {
  if (!user) return "?";
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  if (first || last) return (first + last).toUpperCase();
  return (user.email ?? "?").slice(0, 2).toUpperCase();
}
