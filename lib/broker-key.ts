// Broker identity is one string, compared in a dozen places. Comparing it raw is
// what broke credit-team allocation: coverage stored "fabio", the deal stored
// "Fabio", and an exact match found nothing while the screen looked correct.
//
// Every comparison of a broker string goes through here. scripts/check-broker-keys.sh
// fails the ship if a new one appears that does not.

export function brokerKey(v: unknown): string {
  return String(v ?? '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function sameBroker(a: unknown, b: unknown): boolean {
  const x = brokerKey(a)
  return !!x && x === brokerKey(b)
}

// The stored value is the key. Anywhere a person reads it, show something human.
// Where the full name matters, look it up from the register instead.
export function brokerLabel(v: unknown): string {
  const k = brokerKey(v)
  if (!k) return '—'
  return k.charAt(0).toUpperCase() + k.slice(1)
}
