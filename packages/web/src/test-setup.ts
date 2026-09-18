// ponytail: jsdom no implementa medición de layout de texto (getClientRects);
// CodeMirror la usa para dibujar el cursor/selección, sin efecto en lo que
// estos tests verifican.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
}

// ponytail: jsdom no implementa URL.createObjectURL/revokeObjectURL, usados
// por las descargas de archivo (file-io.ts).
if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock";
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}
