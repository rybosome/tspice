import type {
  BackendKind,
  SpiceBackend,
  SpiceBackendWasm,
} from "@rybosome/tspice-backend-contract";
import { assertNever } from "@rybosome/tspice-core";

const NATIVE_PLATFORM_PACKAGES = {
  darwin: {
    arm64: "@rybosome/tspice-native-darwin-arm64",
    x64: "@rybosome/tspice-native-darwin-x64",
  },
  linux: {
    x64: "@rybosome/tspice-native-linux-x64-gnu",
  },
} as const;

export type { BackendKind, SpiceBackend, SpiceBackendWasm } from "@rybosome/tspice-backend-contract";

export type CreateBackendOptions = {
  backend?: BackendKind;
  wasmUrl?: string | URL;
};

export function createBackend(): Promise<SpiceBackend | SpiceBackendWasm>;
export function createBackend(options?: { backend?: "wasm"; wasmUrl?: string | URL }): Promise<SpiceBackendWasm>;
export function createBackend(options: { backend: "node" }): Promise<SpiceBackend>;
export function createBackend(options: { backend: "fake" }): Promise<SpiceBackend>;
export function createBackend(options: CreateBackendOptions): Promise<SpiceBackend | SpiceBackendWasm>;
export async function createBackend(
  options: CreateBackendOptions = {},
): Promise<SpiceBackend | SpiceBackendWasm> {
  const backend = options.backend ?? "auto";

  let autoNativeLoadError: unknown | undefined;
  let debugNative = false;

  const isNodeRuntime =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    typeof process !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    !!process.versions?.node;

  switch (backend) {
    case "auto":
      // If we're in Node and a matching platform package is installed, prefer
      // native. Otherwise, fall back to WASM.
      if (isNodeRuntime) {
        debugNative = process.env.TSPICE_DEBUG_NATIVE === "1";

        const { createRequire } = await import("node:module");
        const require = createRequire(import.meta.url);
        const platform = process.platform as keyof typeof NATIVE_PLATFORM_PACKAGES;
        const arch = process.arch as string;
        const nativePackage =
          NATIVE_PLATFORM_PACKAGES[platform]?.[
            arch as keyof (typeof NATIVE_PLATFORM_PACKAGES)[typeof platform]
          ];

        if (nativePackage) {
          let nativePackageResolved = false;
          try {
            // Only swallow the expected "module not installed" case. If the
            // package is present but fails to load (e.g. incompatible binary,
            // missing transitive dependency), preserve the error so we can
            // surface it when debugging and/or when WASM fallback fails.
            require.resolve(nativePackage);
            nativePackageResolved = true;

            // We only use this as a presence check here; the backend-node loader
            // will read its exported bindingPath.
            require(nativePackage);

            // Keep this import specifier non-literal so bundlers (Vite) don't
            // pull the Node backend into browser builds.
            const nodeBackendSpecifier = "@rybosome/tspice-backend-" + "node";
            const { createNodeBackend } = (await import(
              nodeBackendSpecifier
            )) as {
              createNodeBackend: () => SpiceBackend;
            };
            return createNodeBackend();
          } catch (error) {
            const isExpectedAbsent =
              !nativePackageResolved && (error as { code?: unknown }).code === "MODULE_NOT_FOUND";

            if (!isExpectedAbsent) {
              autoNativeLoadError = error;
              if (debugNative) {
                // eslint-disable-next-line no-console
                console.warn(
                  `tspice: native backend failed to load; falling back to WASM (TSPICE_DEBUG_NATIVE=1). platform=${process.platform} arch=${process.arch} pkg=${nativePackage}`,
                  error,
                );
              }
            }
          }
        }
      }

      // Fall-through: WASM fallback.
      try {
        const { createWasmBackend } = (await import(
          "@rybosome/tspice-backend-wasm"
        )) as {
          createWasmBackend: (opts?: { wasmUrl?: string | URL }) => Promise<SpiceBackendWasm>;
        };

        if (options.wasmUrl === undefined) {
          return await createWasmBackend();
        }
        return await createWasmBackend({ wasmUrl: options.wasmUrl });
      } catch (error) {
        if (autoNativeLoadError !== undefined) {
          if (debugNative) {
            // eslint-disable-next-line no-console
            console.warn(
              `tspice: WASM backend fallback also failed after native load error (TSPICE_DEBUG_NATIVE=1).`,
              error,
            );
          }
          throw new Error(
            `Failed to load WASM backend (required for backend=\"auto\" fallback) after native backend load failed: ${String(error)}`,
            { cause: autoNativeLoadError },
          );
        }
        throw new Error(
          `Failed to load WASM backend (required for backend=\"auto\" fallback): ${String(error)}`,
          { cause: error as unknown },
        );
      }

    case "node":
      try {
        // Keep this import non-static so JS-only CI can run without building
        // the native backend package.
        const nodeBackendSpecifier = "@rybosome/tspice-backend-" + "node";
        const { createNodeBackend } = (await import(nodeBackendSpecifier)) as {
          createNodeBackend: () => SpiceBackend;
        };
        return createNodeBackend();
      } catch (error) {
        throw new Error(
          `Failed to load native backend (required for backend=\"node\"): ${String(error)}`,
        );
      }
    case "wasm":
      try {
        const { createWasmBackend } = (await import(
          "@rybosome/tspice-backend-wasm"
        )) as {
          createWasmBackend: (opts?: { wasmUrl?: string | URL }) => Promise<SpiceBackendWasm>;
        };

        if (options.wasmUrl === undefined) {
          return await createWasmBackend();
        }
        return await createWasmBackend({ wasmUrl: options.wasmUrl });
      } catch (error) {
        throw new Error(
          `Failed to load WASM backend (required for backend=\"wasm\"): ${String(error)}`,
        );
      }
    case "fake":
      try {
        const { createFakeBackend } = (await import(
          "@rybosome/tspice-backend-fake"
        )) as {
          createFakeBackend: () => SpiceBackend;
        };
        return createFakeBackend();
      } catch (error) {
        throw new Error(
          `Failed to load fake backend (required for backend=\"fake\"): ${String(error)}`,
        );
      }
    default:
      return assertNever(backend, "Unsupported backend");
  }
}
