/**
 * Declaraciones de módulos para importar assets estáticos en el renderer.
 * Vite resuelve estos imports en runtime devolviendo la URL del recurso;
 * estas declaraciones dan el tipo correspondiente a TypeScript.
 */

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}
