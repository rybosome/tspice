# Binary CK writers

`ckopn` creates a new DAF/CK and returns an owner-local writer token. Use `ckcls` to finalize it. Closing an empty writer signals `SPICE(NOSEGMENTSFOUND)` and leaves it open for a corrected write. A `VirtualOutput` provides portable readback after close; a string uses the Node filesystem or the WASM kernel namespace. Disposal releases an unused native writer by closing its underlying DAF. The existing low-level `cklpf` and `ckupf` expose physical read handles with their original loading, promotion and deduplication semantics. [CKOPN](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckopn_c.html) [CKCLS](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckcls_c.html)

## Records and clocks

All segment times and interval starts are encoded spacecraft clock ticks. The quaternion is scalar first in SPICE convention. Its rotation maps reference-frame coordinates into instrument coordinates. Explicit angular velocity is the motion of the instrument with respect to the reference frame, expressed in the reference frame in radians per second. Reversing a quaternion sign or differentiating quaternion components is distinct from reversing reference and instrument axes. Each raw writer accepts flat readonly numeric arrays and infers record counts from time arrays. Data is copied and checked before the native call. [CK required reading](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/ck.html)

| Writer  | Per-record data                                                                        | Coverage and AV                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ckw01` | One time, four quaternion components, optionally three AV components                   | Discrete samples; tolerance may return a nearby actual tick.                                                                                                       |
| `ckw02` | Start, stop, initial quaternion, AV and seconds per tick                               | Each interval propagates its own constant AV. Overlapping interiors are rejected. A shared endpoint is permitted.                                                  |
| `ckw03` | One time, quaternion and optional AV, with an additional array of interpolation starts | Pointing interpolates within each interval. The first start must equal the first sample.                                                                           |
| `ckw05` | One time and subtype-specific packet, plus the rate and ordered interpolation starts   | Interpolation uses Lagrange or Hermite windows; records near boundaries can use fewer samples. The descriptor AV flag independently controls AV-query eligibility. |

For types 1 and 3, `av=false` accepts an empty AV array or the ignored numeric triples. Type 2 transfers the supplied per-record rates directly. In N0067 a zero rate holds the orientation fixed within the record, while the stored angular velocity is still available, and a negative rate reverses elapsed-seconds propagation. Type 5 rejects zero with `INVALIDVALUE` but transfers a negative nominal rate. The scientific cases compare those outputs with the locked reader. [CKW01](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckw01_c.html) [CKW02](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckw02_c.html) [CKW03](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckw03_c.html)

## Type 5 packet subtypes

| Subtype | Width | Interpolation | Stored fields                                           |
| ------- | ----: | ------------- | ------------------------------------------------------- |
| 0       |     8 | Hermite       | Quaternion and its four component derivatives           |
| 1       |     4 | Lagrange      | Quaternion                                              |
| 2       |    14 | Hermite       | Quaternion, quaternion derivative, AV and AV derivative |
| 3       |     7 | Lagrange      | Quaternion and AV                                       |

Derivatives use seconds. The clock rate converts between seconds and encoded ticks, including derivative scaling inside the interpolator. The NAIF degree guidance is 3 modulo 4 for Hermite and odd for Lagrange, up to 23. The actual N0067 Hermite writer computes `(degree + 1) / 2` using integer division, then checks that the result is even. Degree 4 therefore stores the same two-packet window as degree 3. A registered case compares independently written and evaluated degree-4 data. The binding guards signed maximum degree before N0067's increment. It also requires the first interpolation start to match the first packet for type 5 because CKR05 assumes an interval start at or before the selected packet. CKW05 checks whether each supplied start belongs to the time array but does not enforce that specific precondition. [CKW05](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ckw05_c.html) [Shared C checks](../packages/backend-shim-c/src/domains/frames.c)

## Evidence

The independent generator creates a seven-segment fixture covering all four CK types and all four type 5 subtypes. A separate SpiceyPy process inspects every segment descriptor, name and DAF data word after each backend writes an equivalent new physical file. It compares all selected C-matrix components, angular velocities, found flags and returned ticks. The reverse tests load the independent binary into both backends. The registered workflows also exercise coverage, gap tolerance, 102-record time directories, AV-disabled data, signed rates, clock conversion, error diagnostics and overlapping segment priority. The existing authored SCLK maps one tick to one second and supports independent TDB coverage observations. [Fixture provenance](../packages/py-parity-checking/fixtures/README.md) [Cross-file tests](../packages/py-parity-checking/test/ck-writer-content.test.ts) [Per-routine audit](../data/parity-audits/c12-ck-writers.json)

The final compiled Chrome inline worker recovered an empty-writer close, added the four typed segments to the same owned file, loaded every segment, checked rotation orthogonality, AV, sorted instrument IDs and segment coverage, and freed the windows and cells.
