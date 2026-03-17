# Function registry DSL (`dslVersion: 1`)

`packages/parity-checking/specs/function-registry/function-registry.yaml` is the source of truth for generated dispatch behavior.

Generated output: `packages/parity-checking/catalogs/function-registry.json`.

## Source format

```yaml
dslVersion: 1
functions:
  - key: coords-vectors.vdot
    input:
      - arg0
      - arg1
    implemented: true
    executable:
      ts:
        method: vdot
      native:
        handler: generated_dispatch_coords_vectors_vdot

  - key: time.str2et
    input:
      - utc
```

Rules:

- `dslVersion` must be `1`.
- `functions` must be a non-empty array.
- duplicate function `key` values are rejected.
- strict key validation (unknown keys hard-fail).
- canonical field order is enforced:
  - `input` -> `output` -> `buffers` -> `behaviorClass` -> `implemented` -> `executable` -> `overrideReason`
  - (`key` remains first)

## Normalization layer (code-owned defaults)

Generation applies a normalization pass before writing `catalogs/function-registry.json`:

- `implemented` defaults to `false`.
- `behaviorClass` defaults from shape conventions.
- `catalogs/contract-methods.json` is treated as the canonical key inventory.
- Source keys missing from contract inventory hard-fail.
- Contract keys missing from source are auto-filled as `implemented: false` stubs with `input: []`.

Missing/extra reconciliation diagnostics are emitted during generation so drift is actionable.

## `input`

`input` is an ordered argument-name array.

- each entry must be a non-empty string,
- names must be unique per function,
- empty arrays are allowed.

## `output`

`output` is optional. If present, define exactly one of:

- `value`
- `payload`

`value`:

```yaml
output:
  value:
    from: return        # or out.<name>
    type: spiceDouble   # optional
```

`payload`:

```yaml
output:
  payload:
    found: out.found
    code: out.code
```

## `buffers`

`buffers` is optional. Each buffer must use exactly one sizing mode:

- fixed bytes (`bytes: { min, max }`)
- dynamic (`lengthFrom`)

```yaml
buffers:
  frameName:
    bytes:
      min: 64
      max: 1025
    elementType: char
```

## Behavior classes

Allowed values:

- `input-mapping-scalar-output`
- `out-params-structured-payload`
- `integer-return-split`
- `complex-return-form`
- `string-buffer-bounds`

Validation hard-fails for:

- unknown behavior class,
- behavior class incompatible with function shape,
- override without `overrideReason`.

### Overrides

Set `behaviorClass` only when overriding the code-owned default. If you override, you must include `overrideReason`.

```yaml
- key: frames.ccifrm
  input: [frameClass, classId]
  buffers:
    frameName:
      bytes: { min: 64, max: 1025 }
      elementType: char
  behaviorClass: input-mapping-scalar-output
  overrideReason: staged rollout keeps this entry in scalar class
```

## Implemented-gating + executable metadata

`implemented` controls whether canonical dispatch may execute the entry.

- `implemented: false`
  - must not include `executable`
  - remains strict fail-closed at the generated seam
- `implemented: true`
  - requires executable metadata:

```yaml
implemented: true
executable:
  ts:
    method: vdot
  native:
    handler: generated_dispatch_coords_vectors_vdot
```

Validation hard-fails for:

- `implemented: true` without executable metadata,
- callable metadata on non-implemented entries.

## Determinism + drift checks

Generation is deterministic and key-sorted.

Recommended flow:

- `pnpm -C packages/parity-checking generate:catalogs`
- `pnpm -C packages/parity-checking check:generated`

`check:generated` regenerates catalogs/artifacts and fails when tracked generated files drift.

## Promotion path (`implemented: false` -> `true`)

1. Update DSL entry (`input`/`output`/`buffers` + behavior class override if needed).
2. Set `implemented: true`.
3. Provide `executable.ts.method` + `executable.native.handler`.
4. Regenerate catalogs/artifacts.
5. Add/refresh tests for:
   - callable success paths (TS + native),
   - strict fail-closed behavior for unimplemented/missing entries,
   - codegen determinism + drift checks.
