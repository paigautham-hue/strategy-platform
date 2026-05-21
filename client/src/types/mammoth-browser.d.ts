/**
 * Type declaration for mammoth's browser entry point.
 *
 * The `mammoth` package ships types for its main (Node) entry but not for the
 * `mammoth/mammoth.browser` subpath — the build that must be used in the
 * client bundle (the Node build pulls in `fs`). We declare only the one
 * function the app uses; Vite's CJS interop exposes it as a named export.
 */
declare module "mammoth/mammoth.browser" {
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
}
