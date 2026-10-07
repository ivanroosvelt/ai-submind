import { Workspace, type DocumentUri, type LinkResult } from "@tejo/core";

/** Lo que abre una carpeta o un archivo y lo que se guarda como borrador (decisiones #37, #38). */
export interface WorkspaceSnapshot {
  files: Record<DocumentUri, string>;
  /** Contenido en disco de cada archivo; sin entrada = nunca guardado. */
  saved: Record<DocumentUri, string>;
  active: DocumentUri;
  dir: FileSystemDirectoryHandle | null;
}

/**
 * Los archivos abiertos en el editor sobre un `Workspace` del core. `link()`
 * es perezoso y se invalida con cada cambio: nadie guarda un `LinkResult`
 * entre cambios, porque el siguiente `link()` reescribe los `Ref.target`
 * del anterior (pendiente de la Fase E).
 */
export class EditorWorkspace {
  private readonly files = new Map<DocumentUri, string>();
  private readonly saved = new Map<DocumentUri, string>();
  private readonly core = new Workspace();
  private linked: LinkResult | null = null;
  active: DocumentUri;
  readonly dir: FileSystemDirectoryHandle | null;

  constructor(snapshot: WorkspaceSnapshot) {
    for (const [uri, source] of Object.entries(snapshot.files)) this.setSource(uri, source);
    for (const [uri, source] of Object.entries(snapshot.saved)) this.saved.set(uri, source);
    this.active = this.files.has(snapshot.active) ? snapshot.active : (this.uris()[0] ?? "");
    this.dir = snapshot.dir;
  }

  /** En orden de uri, como `LinkResult.documents`. */
  uris(): DocumentUri[] {
    return [...this.files.keys()].sort();
  }

  source(uri: DocumentUri): string {
    return this.files.get(uri) ?? "";
  }

  setSource(uri: DocumentUri, source: string): void {
    this.files.set(uri, source);
    this.core.setDocument(uri, source);
    this.linked = null;
  }

  isDirty(uri: DocumentUri): boolean {
    return this.saved.get(uri) !== this.files.get(uri);
  }

  /** Cambios que se perderían: difiere de disco; con carpeta, también si nunca se guardó (#43). */
  isUnsaved(uri: DocumentUri): boolean {
    return this.isDirty(uri) && (this.saved.has(uri) || this.dir !== null);
  }

  hasUnsavedChanges(): boolean {
    return this.uris().some((uri) => this.isUnsaved(uri));
  }

  markSaved(uri: DocumentUri): void {
    this.saved.set(uri, this.source(uri));
  }

  link(): LinkResult {
    return (this.linked ??= this.core.link());
  }

  snapshot(): WorkspaceSnapshot {
    return {
      files: Object.fromEntries(this.files),
      saved: Object.fromEntries(this.saved),
      active: this.active,
      dir: this.dir,
    };
  }
}
