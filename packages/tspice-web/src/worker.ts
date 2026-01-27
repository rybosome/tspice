import * as Comlink from "comlink";
import { createSpice, type SpiceTime } from "@rybosome/tspice";
import type { KernelSource } from "@rybosome/tspice";

import type { Mat3, TspiceWorkerApi, Vec3 } from "./shared.js";

function bodyRefToSpiceString(body: number | string): string {
  return typeof body === "number" ? String(body) : body;
}

function transposeMat3RowMajorToColumnMajor(m: readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]): Mat3 {
  // row-major => column-major
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function createTspiceWorkerApi(): TspiceWorkerApi {
  let spice:
    | {
        loadKernel(kernel: KernelSource): void;
        unloadKernel(path: string): void;
        utcToEt(utc: string): SpiceTime;
        etToUtc(et: SpiceTime, format?: string, prec?: number): string;
        frameTransform(from: string, to: string, et: SpiceTime): readonly [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ];
        getState(args: {
          target: string;
          observer: string;
          at: SpiceTime;
          frame?: string;
          aberration?: string;
        }): {
          position: Vec3;
          velocity: Vec3;
        };
      }
    | undefined;

  const ensureInit = () => {
    if (!spice) throw new Error("tspice worker not initialized; call init() first");
    return spice;
  };

  return {
    async init() {
      if (spice) return;
      spice = await createSpice({ backend: "wasm" });
    },

    async loadKernel(kernel) {
      ensureInit().loadKernel(kernel);
    },

    async unloadKernel(path) {
      ensureInit().unloadKernel(path);
    },

    async utcToEt(utc) {
      return ensureInit().utcToEt(utc) as unknown as number;
    },

    async etToUtc(et) {
      return ensureInit().etToUtc(et as unknown as SpiceTime, "ISOC", 0);
    },

    async getBodyState(input) {
      const state = ensureInit().getState({
        target: bodyRefToSpiceString(input.target),
        observer: bodyRefToSpiceString(input.observer),
        at: input.et as unknown as SpiceTime,
        frame: input.frame,
        ...(input.abcorr ? { aberration: input.abcorr } : {}),
      });

      return {
        positionKm: state.position,
        velocityKmPerSec: state.velocity,
      };
    },

    async getFrameTransform(input) {
      const m = ensureInit().frameTransform(
        input.from,
        input.to,
        input.et as unknown as SpiceTime,
      );

      return transposeMat3RowMajorToColumnMajor(m);
    },
  };
}

export function exposeTspiceWorker(): void {
  Comlink.expose(createTspiceWorkerApi());
}
