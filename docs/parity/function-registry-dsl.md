# Function registry DSL (`dslVersion: 1`)

`packages/parity-checking/specs/function-registry/function-registry.yaml` is the single source of truth for generated dispatch metadata.

Generated output: `packages/parity-checking/catalogs/function-registry.json`.

## Source format

```yaml
dslVersion: 1
functions:
  - key: ephemeris.spkezr
    input:
      - target
      - et
      - frame
      - abcorr
      - observer
    output:
      payload:
        state: out.state
        lightTime: out.lightTime
  - key: time.str2et
    input:
      - utc
    output:
      value:
        from: return
        type: spiceDouble
```

Rules:

- `dslVersion` must be `1`.
- `functions` must be a non-empty array.
- duplicate function `key` values are rejected.
- canonical function object field order is enforced: `input`, then `output`, then `buffers` (`key` is always first).

## `input`

`input` is an ordered array of argument names.

- each entry must be a non-empty string,
- names must be unique per function,
- empty arrays are allowed for nullary calls.

When canonical parameter names are unavailable, positional names (`arg0`, `arg1`, …) are used.

## `output`

`output` is optional. If present, define exactly one of:

- `value`
- `payload`

`value`:

```yaml
output:
  value:
    from: return        # or out.<name>
    type: spiceDouble   # optional type tag
```

`payload`:

```yaml
output:
  payload:
    found: out.found
    code: out.code
```

## `buffers`

`buffers` is optional. Each buffer uses exactly one sizing mode:

- fixed bytes: `bytes { min, max }`
- dynamic length: `lengthFrom`

```yaml
buffers:
  frameName:
    bytes:
      min: 64
      max: 1025
    elementType: char
```

```yaml
buffers:
  spaixi:
    lengthFrom: $.in[2]
    elementType: spiceInt
```

Rules:

- `bytes.min` / `bytes.max` must be positive integers with `min <= max`.
- `lengthFrom` must be a non-empty expression string.
- optional `elementType` must be a non-empty string.

## Determinism + parity coverage lock

Generation is deterministic and sorted by canonical `key`.

`generate:function-registry` also enforces an invariant against the parity harness source (`specs/methods/**`):

- no missing parity-tested methods,
- no extra registry methods.

Regenerate + verify:

- `pnpm -C packages/parity-checking generate:catalogs`
- `pnpm -C packages/parity-checking check:generated`
