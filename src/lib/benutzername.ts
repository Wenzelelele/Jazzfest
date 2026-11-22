// Firebase-Login braucht formal eine E-Mail-Adresse. Damit Accounts nicht an
// persönliche Adressen gebunden sind ("kasse", "einlass2", ...), hängt die
// App an einen Benutzernamen ohne "@" diese feste Schein-Domain an. Die
// Endung .invalid ist reserviert (RFC 2606) - es kann nie eine echte Adresse
// sein, Firebase verschickt an diese Accounts auch nichts.
//
// In der Firebase Console legt man also z. B. "kasse@jazzfest.invalid" an,
// in der App tippt man nur "kasse".
export const BENUTZERNAME_DOMAIN = "jazzfest.invalid";

export function zuLoginEmail(eingabe: string): string {
  const getrimmt = eingabe.trim().toLowerCase();
  if (getrimmt.includes("@")) return getrimmt;
  return `${getrimmt}@${BENUTZERNAME_DOMAIN}`;
}

// Anzeige: Benutzernamen-Accounts ohne Schein-Domain, echte E-Mails
// unverändert.
export function anzeigeName(email: string | null | undefined): string {
  if (!email) return "unbekannt";
  const suffix = `@${BENUTZERNAME_DOMAIN}`;
  return email.toLowerCase().endsWith(suffix)
    ? email.slice(0, -suffix.length)
    : email;
}
