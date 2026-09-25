declare module "*viewer.js" {
  export function mountLive(
    el: HTMLElement,
    opts: Record<string, unknown>,
  ): Promise<{
    dispose(): void;
    seek(n: number): void;
    setQuality(n: number): void;
    setPaused(paused: boolean): void;
  } | null>;
}
