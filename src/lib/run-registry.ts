/** In-flight run cancellation. Single-user local scope: a run lives in
 *  the server process that started it. Documented limitation, fine for
 *  portfolio scale. */
const controllers = new Map<string, AbortController>();

export function registerRun(id: string, controller: AbortController): void {
  controllers.set(id, controller);
}

export function unregisterRun(id: string): void {
  controllers.delete(id);
}

export function abortRun(id: string): boolean {
  const controller = controllers.get(id);
  if (!controller || controller.signal.aborted) return false;
  controller.abort();
  return true;
}
