/** Vite's `?raw` import, used by tests to read a file as text. */
declare module "*?raw" {
  const text: string;
  export default text;
}
