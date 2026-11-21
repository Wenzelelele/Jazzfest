// Suche, die an der Einlass-Realität orientiert ist:
// - Umlaute/Akzente egal: "Mueller" findet "Müller", "Rene" findet "René"
// - Wortreihenfolge egal: "Max Müller" findet "Müller, Max"
// - jedes eingetippte Wort muss irgendwo im Namen vorkommen (Teilstring)

export function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function suchBegriffe(suche: string): string[] {
  return normalisiere(suche)
    .split(/[\s,;]+/)
    .filter((teil) => teil.length > 0);
}

export function namePasst(name: string, begriffe: readonly string[]): boolean {
  if (begriffe.length === 0) return true;
  const normalisiert = normalisiere(name);
  return begriffe.every((begriff) => normalisiert.includes(begriff));
}
