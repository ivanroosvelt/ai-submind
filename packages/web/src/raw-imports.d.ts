// Vite resuelve `import x from "archivo?raw"` al contenido del archivo como
// string. El tsconfig no carga `vite/client` (types: []), así que se declara acá.
declare module "*?raw" {
  const content: string;
  export default content;
}
