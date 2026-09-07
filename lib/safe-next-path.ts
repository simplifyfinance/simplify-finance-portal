// WHERE TO SEND SOMEBODY AFTER THEY SIGN IN.
//
// The middleware sends anybody without a session to /login?next=<where they were
// going>, and the login page sends them on afterwards. That value arrives in the
// URL, which means it arrives from wherever the link came from - so it is
// checked before it is used, not after.
//
// Anything that is not a plain path inside this portal becomes the home page. In
// particular "//evil.example.com" is a protocol relative URL that browsers treat
// as another site: a link to
//   .../login?next=//somewhere-else
// would otherwise send a signed-in broker straight off the portal onto a page
// somebody else controls, still expecting to be signing in.

export function safeNextPath(raw: string | null | undefined): string {
  const v = String(raw ?? '').trim()
  if (!v) return '/'
  // Must be a path on this site, and must not be the "//host" form.
  if (!v.startsWith('/')) return '/'
  if (v.startsWith('//')) return '/'
  // A backslash is treated as a slash by some browsers, so /\evil.example.com
  // is the same trick wearing a different hat.
  if (v.startsWith('/\\')) return '/'
  return v
}
