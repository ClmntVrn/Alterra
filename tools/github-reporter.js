// Rapporteur de node --test pour la CI : chaque test en échec devient une annotation GitHub,
// visible sur la page de l’exécution sans ouvrir les journaux.

import { relative } from "node:path";

const escapeData = text =>
  String(text).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
const escapeProperty = text => escapeData(text).replaceAll(":", "%3A").replaceAll(",", "%2C");

export default async function* githubReporter(source) {
  for await (const event of source) {
    if (event.type !== "test:fail") continue;
    const { name, file, line, details } = event.data;
    // Les suites et fichiers en échec répètent l’erreur de leurs tests : on ne garde que les tests.
    if (details?.type === "suite" || details?.error?.failureType === "subtestsFailed") continue;
    const error = details?.error?.cause ?? details?.error;
    const message = error?.message ?? String(error);
    const path = file ? relative(process.cwd(), file).replaceAll("\\", "/") : "";
    const location = path ? `file=${escapeProperty(path)},line=${line ?? 1},` : "";
    yield `::error ${location}title=${escapeProperty(name)}::${escapeData(message)}\n`;
  }
}
