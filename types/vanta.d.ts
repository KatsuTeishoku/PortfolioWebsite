declare module "vanta/dist/vanta.net.min" {
  import type * as THREE from "three";

  export type VantaNetInstance = {
    destroy: () => void;
    setOptions: (options: Record<string, unknown>) => void;
  };

  export type VantaNetOptions = {
    el: HTMLElement | string;
    THREE: typeof THREE;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minWidth?: number;
    minHeight?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    backgroundColor?: number;
    backgroundAlpha?: number;
    points?: number;
    maxDistance?: number;
    spacing?: number;
    showDots?: boolean;
  };

  export default function NET(options: VantaNetOptions): VantaNetInstance;
}
