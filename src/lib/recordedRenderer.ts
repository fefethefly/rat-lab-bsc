export const supports3D = false;
/** Public-source build: original cursor replay is used without upstream 3D assets. */
export async function mountRecorded(_el: HTMLElement, _options: Record<string, unknown>): Promise<{dispose():void;seek(n:number):void} | null> {
  return null;
}
