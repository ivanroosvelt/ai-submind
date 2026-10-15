// Node version guard of the CLI (REQ-001 criterion 3); kept free of imports so old Node can run it.

export const MIN_NODE_MAJOR = 22;

/** Error message when `version` (e.g. `process.versions.node`) is too old, otherwise `undefined`. */
export function nodeVersionError(version: string): string | undefined {
  const major = Number.parseInt(version, 10);
  return major >= MIN_NODE_MAJOR
    ? undefined
    : `ai-submind requires Node.js ${String(MIN_NODE_MAJOR)} or later (found ${version})`;
}
