# @rybosome/tspice-backend-shim-c

Shared C shim used by the tspice backends.

This package currently hosts CSPICE wrapper functions that are compiled into the WASM backend.

## ABI requirements

This shim currently requires a CSPICE build where `sizeof(SpiceInt) == 4` (32-bit `SpiceInt`).
