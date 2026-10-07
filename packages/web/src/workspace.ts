import { Workspace, type DocumentUri, type LinkResult } from "@tejo/core";

/** Lo que abre una carpeta o un archivo y lo que se guarda como borrador (decisiones #37, #38). */
export interface WorkspaceSnapshot {
  files: Record<DocumentUri, string>;
  /** Contenido en disco de cada archivo; sin entrada = nunca guardado. */
  saved: Record<DocumentUri, string>;
  active: DocumentUri;
  dir: FileSystemDirectoryHandle | null;
  /** Carpeta servida por `tejo view` (decisión #66): se guarda por la API local y el disco manda. */
  local: boolean;
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
  readonly local: boolean;

  constructor(snapshot: WorkspaceSnapshot) {
    for (const [uri, source] of Object.entries(snapshot.files)) this.setSource(uri, source);
    for (const [uri, source] of Object.entries(snapshot.saved)) this.saved.set(uri, source);
    this.active = this.files.has(snapshot.active) ? snapshot.active : (this.uris()[0] ?? "");
    this.dir = snapshot.dir;
    // Un borrador viejo de IndexedDB no trae el campo.
    this.local = snapshot.local === true;
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
    return this.isDirty(uri) && (this.saved.has(uri) || this.hasFolder());
  }

  /** Con carpeta (File System Access o `tejo view`): "Nuevo" agrega y "Guardar" escribe todo lo modificado. */
  hasFolder(): boolean {
    return this.dir !== null || this.local;
  }

  hasUnsavedChanges(): boolean {
    return this.uris().some((uri) => this.isUnsaved(uri));
  }

  markSaved(uri: DocumentUri): void {
    this.saved.set(uri, this.source(uri));
  }

  /**
   * Aplica el estado del disco (modo local, #66). Lo limpio sigue al disco:
   * se actualiza, se agrega o se quita. Lo modificado en el editor se
   * conserva y, si el disco lo cambió o borró, es un conflicto. Lo nunca
   * guardado que no está en disco no se toca.
   */
  applyDisk(files: Record<DocumentUri, string>): { changed: DocumentUri[]; conflicts: DocumentUri[] } {
    const changed: DocumentUri[] = [];
    const conflicts: DocumentUri[] = [];
    const uris = new Set([...this.files.keys(), ...Object.keys(files)]);
    for (const uri of [...uris].sort()) {
      const disk = files[uri];
      const saved = this.saved.get(uri);
      if (disk === saved) continue;
      // El disco ya tiene lo del editor (p. ej. el eco de un "Guardar" propio): solo se marca guardado.
      if (disk !== undefined && disk === this.files.get(uri)) {
        this.saved.set(uri, disk);
        continue;
      }
      if (this.isDirty(uri)) {
        conflicts.push(uri);
        // El disco pasa a ser lo guardado: sigue sucio y "Guardar" lo reemplaza a sabiendas.
        if (disk !== undefined) this.saved.set(uri, disk);
        else this.saved.delete(uri);
        continue;
      }
      if (disk === undefined) {
        this.files.delete(uri);
        this.saved.delete(uri);
        this.core.removeDocument(uri);
        this.linked = null;
      } else {
        this.setSource(uri, disk);
        this.saved.set(uri, disk);
      }
      changed.push(uri);
    }
    if (!this.files.has(this.active)) this.active = this.uris()[0] ?? "";
    return { changed, conflicts };
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
      local: this.local,
    };
  }
}
