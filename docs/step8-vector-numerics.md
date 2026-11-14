# Step 8 vector numerical observations

A08's `ucrss` preserves the floating-point behavior of its underlying CSPICE
build. Its original parallel-vector parity fixture exposed a compiler-dependent
result in CSPICE N0067 itself. The investigation below explains the fixture
choice and the limit of the cross-backend parity claim. It does not establish
universal numerical behavior across platforms or compiler configurations.

## Observed failure and direct reproduction

The original `coords-vectors-ucrss-zero-parallel-opposed` fixture included these
mathematically parallel and opposed inputs. The Node and WASM implementations
returned the same results as a direct call into the pinned NAIF native archive;
the independent SpiceyPy library returned different results.

| Input `a`   | Input `b`      | tspice Node and WASM; direct pinned native archive | Live SpiceyPy 6.0.3 / N0067 |
| ----------- | -------------- | -------------------------------------------------- | --------------------------- |
| `[1, 2, 3]` | `[2, 4, 6]`    | `[0, 0, 0]`                                        | `[0, 0, -1]`                |
| `[1, 2, 3]` | `[-2, -4, -6]` | `[0, 0, 0]`                                        | `[0, 0, 1]`                 |
| `[1, 2, 4]` | `[2, 4, 8]`    | `[0, 0, 0]`                                        | `[0, 0, 0]`                 |
| `[1, 2, 4]` | `[-2, -4, -8]` | `[0, 0, 0]`                                        | `[0, 0, 0]`                 |

These observations were made on macOS arm64. The oracle reported SpiceyPy
`6.0.3` and `CSPICE_N0067`. They identify the tested artifacts, not every artifact
with those version strings. SHA-256 fingerprints:

| Artifact                                                                              | SHA-256                                                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| NAIF macOS arm64 N0067 distribution archive, pinned in `scripts/cspice.manifest.json` | `0deae048443e11ca4d093cac651d9785d4f2594631a183d85a3d58949f4d0aa9` |
| Extracted `src/cspice/ucrss_c.c`                                                      | `5827e4b1310bcc1fcd274c5682c48a8c2f2f073164e30b978cafd358abc40037` |
| Extracted `lib/cspice.a`                                                              | `f3a1adf1742c7a63c390834f4227936a36e3c18dd78bf427bc96a04b703946f3` |
| Current oracle's `spiceypy/utils/libcspice.so`                                        | `3dc7060bc5c2f21ed799f86a490e765f9abac4107330d9cfc4c533193e121523` |

The distribution is available from [NAIF's macOS arm64 toolkit
directory](https://naif.jpl.nasa.gov/pub/naif/toolkit/C/MacM1_OSX_clang_64bit/packages/).
The repository manifest identifies the archive version and hash to use rather
than relying on a future download retaining the same contents.

## Cause established with the pinned source

The [NAIF `ucrss_c`
reference](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ucrss_c.html)
specifies a normalized cross product, with a zero result when the computed
cross product is zero. It also notes that numerical results can depend on the
compiler and machine arithmetic. In the pinned source, each vector is divided
by its largest absolute component, then crossed and normalized.

The first input pair therefore produces equal scaled vectors
`[1/3, 2/3, 1]`. The third cross-product component subtracts two products of
rounded thirds. Separately rounded products cancel to zero. A fused
multiply-add can retain a residual of `-1.2335811384723961e-17`. Normalizing this
residual gives `[0, 0, -1]`; opposed inputs reverse its sign. This explains the
observed discrepancy without any input mapping or output transformation.

An isolated probe compiled the exact pinned `ucrss_c.c` body, changing only its
function name to permit linking it alongside the original native archive.
Apple clang `21.0.0 (clang-2100.1.1.101)`, `-std=c11 -O2`, produced:

| Probe flag           | `[1,2,3]` with `[2,4,6]` | `[1,2,3]` with `[-2,-4,-6]` |
| -------------------- | ------------------------ | --------------------------- |
| `-ffp-contract=off`  | `[0, 0, 0]`              | `[0, 0, 0]`                 |
| `-ffp-contract=on`   | `[0, 0, -1]`             | `[0, 0, 1]`                 |
| `-ffp-contract=fast` | `[0, 0, -1]`             | `[0, 0, 1]`                 |

The dyadic pairs in the first table returned zero under all three probe flags.
The original archive returned zero regardless of the flag used to compile the
separate caller. This isolates the change to the rebuilt routine's arithmetic.
The probe flags demonstrate the effect; the historical compiler flags used to
produce the oracle wheel have not been established.

Disassembly of the fingerprinted oracle library confirms fused instructions in
`_ucrss_c`'s cross-product calculation. This excerpt records observed binary
instructions, not vendored toolkit source:

```text
0000000000122800  fmul   d4, d7, d4
0000000000122804  fmadd  d4, d1, d2, d4
000000000012280c  fmul   d2, d2, d5
0000000000122810  fmadd  d2, d3, d17, d2
000000000012281c  fmul   d1, d17, d1
0000000000122820  fmadd  d0, d0, d7, d1
```

The behavior extends to poorly conditioned nonparallel inputs. For example,
`[1,2,3]` with `[1,2,3.000000000001]` gave
`[0.89442719099991574, -0.44721359549995787, 0]` with contraction off and
`[0.89442718989678827, -0.44721359494839413, -4.9665566655366211e-5]` with
contraction on. Normalizing a very small cross product amplifies differences in
its computation. This is an observation of these compiled probes, not a bound
on all near-parallel inputs.

## Parity strategy and scope

The registered exact-parallel and opposed cases use `[1,2,4]` with
`[2,4,8]` and `[-2,-4,-8]`. Their scaled components are dyadic fractions
`[1/4,1/2,1]`, so this test exercises the computed-zero branch without the
thirds-product cancellation exposed above. Every output component is still
compared against the independent live oracle with the existing comparator.

Mixed vectors, reversed handedness, zero inputs, high and low magnitudes, and
the axis-based near-parallel pair `[1,0,0]` / `[1,1e-12,-2e-12]` remain covered.
The latter exercises normalization of a small nonzero cross product without
subtracting two nearly equal nonzero products. The original failing pairs and
their results are retained in this document as a known build-dependent
limitation; they are not evidence of universal cross-build equality.

No production scientific operation, compiler setting, global tolerance, or
oracle output is changed to make these fixtures agree. The public API forwards
to CSPICE and documents this numerical caveat. A claim that all nominally
parallel finite inputs return zero in every CSPICE build would exceed the
evidence.

## Repeating the isolated check

Use the fingerprinted toolkit source and native archive. Copy
`src/cspice/ucrss_c.c` into a temporary directory and rename `ucrss_c` to
`probe_ucrss_c` in that temporary copy, leaving its body unchanged. A small C
caller should invoke both `ucrss_c` and `probe_ucrss_c` with the input pairs
above and print all three components using `%.17g`. Compile that caller and the
renamed source together with the original `lib/cspice.a`:

```sh
clang -std=c11 -O2 -ffp-contract=off \
  -I "$cspice_dir/include" \
  "$probe_dir/main.c" "$probe_dir/ucrss_probe.c" \
  "$cspice_dir/lib/cspice.a" -lm -o "$probe_dir/probe-off"
```

Repeat with `-ffp-contract=on` and `-ffp-contract=fast`, using separate output
executables. Compare the direct live `spiceypy.ucrss(a, b)` result without
rounding or replacing components. On macOS, `otool -tvV` can inspect the oracle
library's `_ucrss_c` instructions. Other toolchains and architectures require
their own observations; neither matching version strings nor these probe
results guarantee identical arithmetic elsewhere.
