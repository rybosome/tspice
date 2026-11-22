# Array clear, fill and move

The six methods accept readonly numeric arrays and return an independently
owned copy of the complete destination. The caller supplies initial storage
so both the changed prefix and the untouched suffix are visible. The methods
capture dimensions before copying and validate each entry as it is read. The
Node and WASM adapters send those exact values to their shared shim. The shim
calls the pinned CSPICE routine and captures and resets genuine SPICE errors.

`clearc(ndim,arrlen,bytes)` works on a flat byte array, including arbitrary
values from 0 to 255. Each of the first `ndim` rows has stride `arrlen`.
CSPICE writes ASCII spaces into the first `arrlen-1` bytes of each cleared
row and NUL into its final byte. For example two rows of width four produce
`[32,32,32,0,32,32,32,0]`, followed by the original suffix. Each row is
checked independently, including input bytes after an earlier NUL.

The pinned source returns immediately for nonpositive `ndim`, before
checking row width. Positive counts with widths below two produce
`SPICE(STRINGTOOSHORT)`. Valid positive dimensions must fit the supplied byte
storage. The adapters and shared shim bound the count using division before
the C multiplication that computes row offsets. The result is raw bytes
throughout. [NAIF clearc](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/clearc_c.html)

`cleard` and `cleari` set the requested prefix to positive double zero
or signed integer zero. `filld` and `filli` copy the supplied value into
that prefix. All four pinned routines use a signed loop that performs zero
writes for a nonpositive count. Signed 32-bit integer limits apply to count,
integer fill values and integer storage entries. Double storage and fills
accept JavaScript numbers including infinities, NaN, subnormal values and
signed zeros. Scoped exact comparisons distinguish negative from positive
zero and preserve IEEE categories. NaN payloads are outside the public
JavaScript scalar contract.

`moved(source,ndim,destination)` uses a nonnegative count that fits both
arrays and returns the complete destination, including the case where both
arguments reference the same JavaScript array. The upstream reference says
that counts below one leave the output untouched. N0067's actual implementation
calls its MOVED macro unconditionally. The macro forms a byte count for
`memmove` from the supplied element count. Negative counts therefore cannot
safely use the documented no-write interpretation. Node, WASM, shared C and
the independent oracle reject them before calling CSPICE. Zero remains a
real canonical call with valid storage. Bounded positive/zero direct probes
cover disjoint, overlapping and identical buffer addresses. Public methods
copy the source and destination independently.
[NAIF moved](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/moved_c.html)

Native/shared storage dimensions fit signed 32-bit lengths with checked
element-to-byte conversion. WASM enforces 256 MiB per buffer. At this ceiling
a byte buffer holds 268,435,456 entries, a signed integer buffer holds
67,108,864 entries and a double buffer holds 33,554,432 entries. Tests use
bounded storage and synthetic lengths for rejected bounds. Empty inputs use
valid non-null sentinel storage.

Locked SpiceyPy 6.0.3 lacks top-level wrappers for all six methods. Independent
ctypes declarations bind the actual six symbols from the library that
SpiceyPy loaded. The oracle verifies four-byte integers and eight-byte doubles,
sets each void return type, initializes each buffer from the supplied input,
and keeps aligned guard storage on both sides. After each valid call it checks
that the source and any bytes outside the writable destination prefix remain
intact. On a toolkit error it checks the same guards before returning the
error. The canonical code supplies the numerical/byte output.
[Independent typed storage bindings](../packages/py-parity-checking/sidecars/spiceypy/src/py_parity_sidecar/array_storage_oracle.py)

The 35 registered workflows contain 92 canonical calls, including three true
`STRINGTOOSHORT` errors. A focused tagged comparison retains every element
in 12 IEEE observations per backend. Public checks cover ownership and
error recovery. An independent bounded overlap/guard test exercises actual
C memory with valid counts. WASM tests cover 13 failed acquisitions, six
successful paths and five storage/error/sentinel checks. All inputs are
authored and kernel-free.
[Public and independent storage checks](../packages/py-parity-checking/test/array-storage.test.ts)

Focused compiled validation passed 70 registered Node/WASM comparisons, 11
public/oracle tests, 34 native tests and 24 WASM tests. During the native
ownership assertion, a generic matcher inspected the instrumented input after
dispatch. The corrected test compares the boolean result of `Object.is` so
that its own inspection preserves the read-count measurement.
