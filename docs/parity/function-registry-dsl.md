# Function registry DSL (`dslVersion: 1`)

`packages/parity-checking/specs/function-registry` is the source of truth for generated dispatch metadata.

## Layout

- `manifest.yaml` — index of function files
- `functions/*.yaml` — one YAML document per canonical function key
- generated output: `packages/parity-checking/catalogs/function-registry.json`

## Manifest format

```yaml
dslVersion: 1
functions:
  - key: ephemeris.spkezr
    file: ephemeris.spkezr.yaml
  - key: time.str2et
    file: time.str2et.yaml
```

Rules:

- `dslVersion` must be `1`.
- `functions` is a non-empty array.
- every entry is `{ key, file }` with strict keys.
- duplicate keys are rejected.

## Function file format

Canonical top-level field order is enforced:

1. `input`
2. `output`
3. `buffers`

(`key` is always first.)

```yaml
key: ephemeris.spkezr
input:
  target: $.in[0]
  et: $.in[1]
  frame: $.in[2]
  abcorr: $.in[3]
  observer: $.in[4]
output:
  payload:
    state: out.state
    lightTime: out.lightTime
buffers:
  state:
    lengthFrom: $.in[5]
    elementType: spiceDouble
```

### `input`

`input` is a map of named arguments to source expressions.

- keys: non-empty strings
- values: non-empty strings

### `output`

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

### `buffers`

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

## Determinism

Generation is deterministic and sorted by canonical `key`.

Regenerate + verify:

- `pnpm -C packages/parity-checking generate:catalogs`
- `pnpm -C packages/parity-checking check:generated`
