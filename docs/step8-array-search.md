# A22 array searches

The eight raw methods take a scalar key and a readonly array. Indirect binary searches also take a readonly permutation of physical zero-based indices. Counts and character widths are inferred. Every success or miss returns a single integer. Empty arrays return −1 on all eight routines.

| Method   | Element and traversal                | Workflows | Canonical calls |
| -------- | ------------------------------------ | --------: | --------------: |
| `bschoc` | UTF-8 rows in permutation order      |         9 |              56 |
| `bschoi` | Signed integers in permutation order |         8 |              43 |
| `bsrchc` | Sorted UTF-8 rows                    |         7 |              50 |
| `bsrchd` | Sorted doubles                       |         6 |              39 |
| `bsrchi` | Sorted signed integers               |         6 |              37 |
| `isrchc` | Linear UTF-8 rows                    |         7 |              50 |
| `isrchd` | Linear doubles                       |         6 |              39 |
| `isrchi` | Linear signed integers               |         6 |              37 |

## Duplicate selection and order

Each binary search assumes nondecreasing values in search order. Both indirect routines require each physical index exactly once. CSPICE returns the **physical** index selected by its midpoint comparisons, including when a different permutation of equal entries gives a different answer. The direct binary routines also return their first matching midpoint. For example, searching `2` in `[-3, 2, 2, 2, 9]` gives index 2 with `bsrchi` and index 1 with `isrchi`. Each linear search scans the supplied physical sequence and returns its first match. The normal return for a miss is −1. [BSCHOC](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bschoc_c.html) [BSCHOI](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bschoi_c.html) [BSRCHI](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bsrchi_c.html) [ISRCHI](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrchi_c.html)

The character routines compare unsigned UTF-8 bytes via the pinned Fortran-style `s_cmp`, extending a shorter string with ASCII spaces. Trailing spaces can compare equal. Tabs remain significant, as do case and multibyte sequences. The two production adapters use A24's rectangular row representation with space padding and a final NUL. In these three array searches the pinned code takes each row's `strlen`. The independent SpiceyPy caller passes original strings with the exact byte stride, allowing its ordinary NUL-terminated shorter rows to exercise that same logical equality. The oracle validates the caller's ordering independently and passes the original physical sequence through. [BSRCHC](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bsrchc_c.html) [ISRCHC](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrchc_c.html) [A24 row encoding](step8-sorted-bounds.md)

Integers and order indices use signed 32-bit representation. Direct binary double search uses ordered non-NaN keys and values. Both double operations match signed zeros and equal infinities. Linear double search accepts arbitrary IEEE inputs, skips NaN elements during a numeric search, and returns −1 for a NaN key. [BSRCHD](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bsrchd_c.html) [ISRCHD](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/isrchd_c.html)

## Native and WASM ownership

Both adapters snapshot each input length and slot, validate a full permutation when required, and check the returned index against the owned count. The native addon also checks both lengths before copying a specified number of entries, including when an accessor changes the second array during the first copy. The shared shim checks order indices and uniqueness again before calling the canonical routine. Search order is a caller precondition. All buffers are call-local. The registered numeric and character inputs require no kernels or filesystem fixtures.

The numerical limits follow the signed arithmetic in N0067. The one-based binary numeric midpoint uses `(left + right) / 2`, so the count limit is 1,073,741,823. The translated linear numeric loop uses an inclusive counter and accepts at most 2,147,483,646 entries. Indirect searches limit the four-byte order vector to a signed 32-bit byte count, or 536,870,911 entries. In particular, `bschoi_c` allocates a private copy and converts its entries to one-based indices. Character keys include the final NUL in their byte count. Rectangular tables use a minimum width of two and a total byte count at most 2,147,483,647. WASM also limits each input allocation to 256 MiB. Oversized shape tests use bounded proxies and terminate before reading a slot or allocating the advertised data.

## Observed checks

All 55 registered workflows make 351 canonical calls through the eight ordinary SpiceyPy 6.0.3 wrappers. Their 110 compiled Node/WASM comparisons passed. Two additional public tests compared live oracle and backend indices for infinities, NaN, signed zero, physical duplicate choices, invalid permutation rejection and recovery. All 36 native and 40 WASM focused tests passed. The WASM suite covers 29 allocation-failure points, one successful cleanup per routine and three byte-width, boundary and snapshot checks. The inherited 26 native and 28 WASM sorted-bound tests passed. A real headless Chrome inline worker exercised all eight operations, physical indices, Unicode and blank ordering, IEEE equality, rejection and recovery. Source-bound full local and canonical CI evidence is tracked separately in the maintained audit. [Registered audit](../data/parity-audits/a22-array-search.json) [Independent public comparisons](../packages/py-parity-checking/test/array-search-live.test.ts)
