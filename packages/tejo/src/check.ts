import { formatDiagnostic } from "@tejo/core";
import { FloFolder } from "@tejo/mcp";

/** `tejo check` (spec §4.4): todo diagnóstico es un error (#53). */
export function check(root: string): { lines: string[]; errors: number } {
  const folder = new FloFolder(root);
  folder.load();
  const files = Object.keys(folder.files()).length;
  const diagnostics = folder.diagnostics() ?? {};
  const lines: string[] = [];
  for (const uri of Object.keys(diagnostics).sort()) {
    for (const diagnostic of diagnostics[uri]) lines.push(`${uri} ${formatDiagnostic(diagnostic)}`);
  }
  const withErrors = Object.keys(diagnostics).length;
  lines.push(lines.length === 0 ? `Sin errores en ${files} archivos.` : `${lines.length} errores en ${withErrors} archivos.`);
  return { lines, errors: lines.length - 1 };
}
