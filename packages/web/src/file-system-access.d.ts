export {};

declare global {
  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface FilePickerOptions {
    types?: FilePickerAcceptType[];
  }

  interface Window {
    showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>;
  }
}
