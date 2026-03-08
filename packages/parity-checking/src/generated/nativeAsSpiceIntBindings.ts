/* eslint-disable */
// GENERATED FILE - DO NOT EDIT.
// Source: packages/parity-checking/registry/functions.registry.yml

export type NativeAsSpiceIntBindingKind =
  | "cellOrWindowRefToSpiceInt"
;

export type NativeAsSpiceIntBindingEntry = {
  id: string;
  enumId: string;
  cSymbol: string;
  backendMethod: string;
  kind: NativeAsSpiceIntBindingKind;
};

export const nativeAsSpiceIntBindings: readonly NativeAsSpiceIntBindingEntry[] = [
  {
    id: "cells-windows.card",
    enumId: "V2_FUNCTION_ID_CELLS_WINDOWS_CARD",
    cSymbol: "card_c",
    backendMethod: "card",
    kind: "cellOrWindowRefToSpiceInt",
  },
  {
    id: "cells-windows.size",
    enumId: "V2_FUNCTION_ID_CELLS_WINDOWS_SIZE",
    cSymbol: "size_c",
    backendMethod: "size",
    kind: "cellOrWindowRefToSpiceInt",
  },
];

const nativeAsSpiceIntBindingById = new Map<string, NativeAsSpiceIntBindingEntry>();
for (const entry of nativeAsSpiceIntBindings) {
  nativeAsSpiceIntBindingById.set(entry.id, entry);
}

export function lookupNativeAsSpiceIntBindingEntry(fnId: string): NativeAsSpiceIntBindingEntry | undefined {
  return nativeAsSpiceIntBindingById.get(fnId);
}

