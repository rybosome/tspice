/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */
import type {
  Mat3RowMajor,
  SpiceVector3,
  SpiceStateVector,
} from "../shared/types.js";

/** Backend contract for basic coordinate transforms and vector/matrix math. */
export interface CoordsVectorsApi {
  /**
   * Clear the first ndim fixed-width character rows in a copy of bytes.
   * Each row occupies arrlen bytes including its terminator. CSPICE fills
   * the first arrlen - 1 bytes with ASCII spaces and the last byte with NUL.
   * The returned byte values include the entire untouched suffix. Input
   * entries must be integers from 0 to 255. No text decoding is performed.
   *
   * ndim and arrlen are signed 32-bit integers. A nonpositive ndim leaves
   * all bytes intact, including for widths below two. For positive ndim,
   * arrlen below two signals SPICE(STRINGTOOSHORT). Otherwise the complete
   * rows must fit in the supplied byte array.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/clearc_c.html
   */
  clearc(ndim: number, arrlen: number, bytes: readonly number[]): number[];

  /**
   * Set the first ndim doubles to positive zero in a copy of values.
   * Return the entire array, preserving the untouched suffix. A nonpositive
   * ndim leaves all entries intact. ndim must be a signed 32-bit integer
   * and a positive count must fit in the supplied storage. Double entries
   * can include signed zero, infinities and NaN.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cleard_c.html
   */
  cleard(ndim: number, values: readonly number[]): number[];

  /**
   * Set the first ndim signed 32-bit integers to zero in a copy of values.
   * Return the complete array, including its untouched suffix. A nonpositive
   * ndim leaves all entries intact. ndim must be a signed 32-bit integer
   * and a positive count must fit in the supplied storage.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cleari_c.html
   */
  cleari(ndim: number, values: readonly number[]): number[];

  /**
   * Fill the first ndim entries in a copy of values with the supplied double.
   * Return the complete array, including its untouched suffix. A nonpositive
   * ndim leaves all entries intact. ndim must be a signed 32-bit integer
   * and a positive count must fit in the supplied storage. The fill value
   * and array entries can include signed zero, infinities and NaN.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/filld_c.html
   */
  filld(value: number, ndim: number, values: readonly number[]): number[];

  /**
   * Fill the first ndim entries in a copy of values with the signed 32-bit
   * integer value. Return the complete integer array, including its untouched
   * suffix. A nonpositive ndim leaves all entries intact. ndim must be a
   * signed 32-bit integer and a positive count must fit in the supplied storage.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/filli_c.html
   */
  filli(value: number, ndim: number, values: readonly number[]): number[];

  /**
   * Copy ndim doubles from the start of source into a copy of destination.
   * Return the complete destination with its untouched suffix. Inputs are
   * snapshotted independently, including when the same array is supplied
   * twice. Zero count returns a copy of the original destination.
   *
   * ndim must be a nonnegative signed 32-bit integer that fits in both arrays.
   * Negative counts are rejected before calling the pinned CSPICE routine,
   * which passes its count to memmove as an unsigned number of bytes.
   * Double entries can include signed zero, infinities and NaN.
   *
   * Each array is limited to 2147483647 elements. WASM additionally limits
   * each buffer to 256 MiB. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/moved_c.html
   */
  moved(
    source: readonly number[],
    ndim: number,
    destination: readonly number[],
  ): number[];

  /**
   * Evaluate an equally spaced Hermite interpolating polynomial at x.
   *
   * For point first + i * step, yvals[2*i] is the function value and
   * yvals[2*i+1] its first derivative with respect to the abscissa.
   * yvals must have even length; n = yvals.length / 2. Return { f, df },
   * the polynomial value and derivative at x. Negative step is allowed;
   * zero step signals CSPICE(INVALIDSTEPSIZE). No points signals
   * CSPICE(INVALIDSIZE). The maximum n is 67108863, keeping the pinned
   * CSPICE wrapper's internal 32*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hrmesp_c.html
   */
  hrmesp(
    first: number,
    step: number,
    yvals: readonly number[],
    x: number,
  ): { f: number; df: number };

  /**
   * Evaluate a Hermite interpolating polynomial at x.
   *
   * xvals contains the abscissae; yvals must have exactly twice as many
   * entries, interleaving function value and first derivative for each
   * point. Return { f, df }, the value and derivative with respect to the
   * abscissa. Input order is preserved. Duplicate abscissae signal
   * CSPICE(DIVIDEBYZERO); no points signals CSPICE(INVALIDSIZE).
   * The maximum point count is 357913941, keeping the pinned translated
   * routine's intermediate 6*n-1 workspace index within signed32.
   * The internal workspace contains 4*n doubles.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hrmint_c.html
   */
  hrmint(
    xvals: readonly number[],
    yvals: readonly number[],
    x: number,
  ): { f: number; df: number };

  /**
   * Evaluate a Lagrange polynomial on equally spaced points at x.
   *
   * yvals[i] is the function value at first + i * step. The inferred point
   * count is yvals.length. Negative step is allowed; zero step signals
   * CSPICE(INVALIDSTEPSIZE). No points signals CSPICE(INVALIDSIZE).
   * The maximum point count is 268435455, keeping the pinned wrapper's
   * internal 8*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgresp_c.html
   */
  lgresp(
    first: number,
    step: number,
    yvals: readonly number[],
    x: number,
  ): number;

  /**
   * Evaluate a Lagrange polynomial and its derivative at x.
   *
   * xvals and yvals must have equal lengths and give corresponding
   * abscissae and values. Return { p, dp }, the value and derivative with
   * respect to the abscissa. NAIF specifies distinct, increasing xvals;
   * this raw wrapper preserves input order without sorting or deduplication.
   * Duplicates signal CSPICE(DIVIDEBYZERO); no points signals
   * CSPICE(INVALIDSIZE). The maximum point count is 715827882, keeping the
   * pinned translated routine's intermediate 3*n index within signed32.
   * The internal workspace contains 2*n doubles.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgrind_c.html
   */
  lgrind(
    xvals: readonly number[],
    yvals: readonly number[],
    x: number,
  ): { p: number; dp: number };

  /**
   * Evaluate a Lagrange interpolating polynomial at x.
   *
   * xvals and yvals must have equal lengths and give corresponding
   * abscissae and values. NAIF specifies distinct, increasing xvals;
   * this raw wrapper preserves input order without sorting or deduplication.
   * Duplicates signal CSPICE(DIVIDEBYZERO); no points signals
   * CSPICE(INVALIDSIZE). The maximum point count is 268435455, keeping the
   * pinned wrapper's internal 8*n workspace byte count within signed32.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * Interpolation is not clamped to the sample interval; extrapolation,
   * high degree and poorly spaced points can amplify numerical error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lgrint_c.html
   */
  lgrint(xvals: readonly number[], yvals: readonly number[], x: number): number;

  /**
   * Estimate a vector function's derivative at the midpoint of two samples.
   *
   * f0 and f2 contain function values at abscissae separated by 2*delta.
   * They must have equal, nonzero lengths. delta may be negative; zero
   * signals CSPICE(DIVIDEBYZERO). Return an independent array containing
   * the actual CSPICE derivative estimates. The pinned routine forms
   * (0.5/delta)*f2 + (-0.5/delta)*f0; its overflow, underflow and cancellation
   * behavior can differ from subtracting first and dividing afterwards.
   * Empty vectors are rejected because NAIF does not define a portable
   * zero-dimensional call. The maximum dimension is 2147483646 to avoid
   * overflow of the pinned translated routine's inclusive loop counter.
   *
   * Inputs are finite numbers and readonly arrays of finite numbers; no input
   * is modified. WASM limits each input, output and workspace buffer to
   * 256 MiB, including workspace allocated inside CSPICE. No kernels are
   * needed. Numerical outputs, including nonfinite results, are retained.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/qderiv_c.html
   */
  qderiv(f0: readonly number[], f2: readonly number[], delta: number): number[];

  /**
   * Evaluate a Chebyshev expansion and its first nderiv derivatives at x.
   *
   * cp[i] multiplies the first-kind Chebyshev polynomial T_i(s), with
   * s = (x - x2s[0]) / x2s[1]; degree is cp.length - 1. cp must be nonempty.
   * The independent result array has nderiv + 1 entries, starting with the
   * value, followed by derivatives with respect to x (not s). nderiv must
   * be an integer in [0, 715827881], keeping the pinned toolkit's workspace
   * indices within signed32. Workspace is allocated internally.
   *
   * For reliable evaluation, use a nonzero transformation scale x2s[1]
   * and normalized s in [-1, 1]. Inputs are not clamped: negative scales,
   * zero scales and extrapolation reach CSPICE unchanged. Zero scales do
   * not define a valid normalization; extrapolation and high derivative
   * orders can cause severe numerical error or overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbder_c.html
   */
  chbder(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
    nderiv: number,
  ): number[];

  /**
   * Evaluate a Chebyshev expansion and its integral at x.
   *
   * cp[i] multiplies T_i(s), where s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. Return { p, itgrlp }, where p is the expansion value and
   * itgrlp is its integral with respect to x, chosen to be zero at x2s[0].
   * An empty cp reaches CSPICE as degree -1 and signals INVALIDDEGREE.
   * A nonpositive x2s[1] signals INVALIDRADIUS; these are CSPICE errors.
   * For reliable evaluation use normalized s in [-1, 1]. No clamping or
   * overflow checks are performed; large degree can accumulate roundoff.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbigr_c.html
   */
  chbigr(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): { p: number; itgrlp: number };

  /**
   * Evaluate a Chebyshev expansion and its first derivative at x.
   *
   * cp[i] multiplies T_i(s), with s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. cp must be nonempty. Return { p, dpdx }, preserving the
   * value and derivative with respect to x (not s).
   * Use a nonzero scale x2s[1] and normalized s in [-1, 1] for reliable
   * evaluation. Finite scales and abscissae reach CSPICE unchanged; a zero
   * scale is not a valid normalization and extrapolation can overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbint_c.html
   */
  chbint(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): { p: number; dpdx: number };

  /**
   * Evaluate a Chebyshev expansion at x.
   *
   * cp[i] multiplies T_i(s), with s = (x - x2s[0]) / x2s[1]; degree is
   * cp.length - 1. cp must be nonempty. Use a nonzero scale x2s[1] and
   * normalized s in [-1, 1] for reliable evaluation. Finite scales and
   * abscissae reach CSPICE unchanged; a zero scale is not a valid
   * normalization and extrapolation can overflow.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chbval_c.html
   */
  chbval(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): number;

  /**
   * Evaluate an ordinary polynomial and its first nderiv derivatives at t.
   *
   * coeffs[i] is the coefficient of t^i; degree is coeffs.length - 1.
   * Return an independent array starting with the polynomial value,
   * followed by successive derivatives. Empty coefficients imply degree
   * -1 and yield nderiv + 1 zeros when nderiv is nonnegative. A negative
   * signed32 nderiv invokes CSPICE's no-write path and returns [].
   * Nonnegative nderiv must be at most 2147483646 to keep the pinned
   * translated loop counter within signed32. High derivative orders can
   * grow rapidly and overflow; results are not replaced or normalized.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * Coefficient counts must fit signed32; the degree is inferred without
   * truncating trailing zero coefficients. WASM limits each allocation
   * (including derivative workspace) to 256 MiB.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/polyds_c.html
   */
  polyds(coeffs: readonly number[], nderiv: number, t: number): number[];

  /**
   * Return both roots of a*x^2 + b*x + c = 0 as complex pairs.
   *
   * Return { root1, root2 }, each an independent [real, imaginary] array.
   * For a nonzero quadratic coefficient, root1 corresponds to the positive
   * square-root term in the quadratic formula and root2 to the negative
   * term; this does not sort roots or guarantee positive root1 imaginary
   * part when a is negative. A linear equation (a = 0, b != 0) returns the
   * same root in both arrays. If a and b are both zero, CSPICE signals
   * DEGENERATECASE. The pinned toolkit's degenerate-case path may also write
   * a NAMESDONOTMATCH trace diagnostic; the raised CSPICE error remains
   * DEGENERATECASE. CSPICE scales coefficients when possible but does not
   * check root overflow; all numerical outputs are retained.
   *
   * All numeric inputs must be finite. Readonly input arrays are not modified.
   * No kernels are needed. Nonfinite numerical outputs are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rquad_c.html
   */
  rquad(
    a: number,
    b: number,
    c: number,
  ): { root1: [number, number]; root2: [number, number] };

  /**
   * Return the unit cross-product direction of the positions in a and b,
   * together with its derivative, as a new six-component state.
   *
   * Pinned N0067 scales each complete input state by the reciprocal of its
   * largest absolute position component, leaving a zero position unscaled.
   * If the cross product of these scaled positions computes exactly zero,
   * the output position is zero and its derivative is the cross-product
   * derivative of the internally scaled states. This can differ from the
   * unscaled derivative described by the NAIF prose. Near collinearity,
   * normalization can amplify rounding and compiler-dependent residuals.
   * NAIF requires magnitudes that avoid intermediate overflow; scaling does
   * not remove that caller requirement.
   * The first three outputs are dimensionless; the last three normally have
   * inverse time units, with the zero-cross convention described above.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ducrss_c.html
   */
  ducrss(
    a: Readonly<SpiceStateVector>,
    b: Readonly<SpiceStateVector>,
  ): SpiceStateVector;

  /**
   * Return [cross(p1, p2), cross(v1, p2) + cross(p1, v2)] as a new state,
   * where a=[p1,v1] and b=[p2,v2].
   *
   * The output position has the product of the input position units; the
   * last three components are its derivative. Cross products and addition
   * retain CSPICE overflow, underflow and cancellation behavior.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvcrss_c.html
   */
  dvcrss(
    a: Readonly<SpiceStateVector>,
    b: Readonly<SpiceStateVector>,
  ): SpiceStateVector;

  /**
   * Return the derivative dot(p1, v2) + dot(v1, p2),
   * where a=[p1,v1] and b=[p2,v2].
   *
   * This is the derivative of the position dot product, not a six-dimensional
   * dot product. Output units are the product of the position units divided
   * by the common derivative parameter's unit. CSPICE summation and numerical
   * limits are preserved. NAIF requires input magnitudes that avoid overflow
   * during the products and summation.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvdot_c.html
   */
  dvdot(a: Readonly<SpiceStateVector>, b: Readonly<SpiceStateVector>): number;

  /**
   * Return the unit position direction and its derivative as a new state.
   *
   * For nonzero position p with derivative v, the result is [u, du/dt],
   * where u=p/norm(p). If the computed position norm is zero, CSPICE returns
   * a zero position and copies the original last three components unchanged.
   * The usual output units are dimensionless direction and inverse time;
   * the zero-position convention retains the input derivative units.
   * Scaling, projection and reciprocal-norm numerical limits are preserved.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvhat_c.html
   */
  dvhat(state: Readonly<SpiceStateVector>): SpiceStateVector;

  /**
   * Return the derivative of the norm of state's first three components.
   *
   * The result is the input derivative projected onto the unit position
   * direction, with the same units as the last three input components.
   * If the position norm computes as zero, CSPICE returns zero. The actual
   * normalization and dot-product numerical limits are preserved.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvnorm_c.html
   */
  dvnorm(state: Readonly<SpiceStateVector>): number;

  /**
   * Return the derivative of the angular separation of the two positions,
   * in radians per unit of the common derivative parameter (normally time).
   *
   * The states must refer to the same observer, frame and epoch. When the
   * cross product of their normalized positions computes exactly zero,
   * CSPICE returns zero, including zero-position, parallel and opposed cases;
   * the classical derivative need not exist at these singularities. Normalizing
   * mathematically collinear positions can leave a nonzero cross-product
   * residual; the resulting derivative is sensitive to rounding and compiler
   * arithmetic. Nearly collinear states can be poorly conditioned. Pinned
   * N0067's guarded division returns zero for sufficiently small quotients
   * and raises genuine CSPICE errors for detected numeric overflow or division
   * by zero. These errors propagate; they are not converted to scalar zero results.
   *
   * Inputs contain exactly six finite numbers in [x, y, z, dx/dt, dy/dt, dz/dt]
   * order, use compatible frames and derivative units, and are not modified.
   * The parameter may be any common scalar, not only time. No kernels are
   * needed. Finite inputs can yield nonfinite outputs, which are preserved.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvsep_c.html
   */
  dvsep(a: Readonly<SpiceStateVector>, b: Readonly<SpiceStateVector>): number;

  /**
   * Return the CSPICE value of pi (a half turn in radians).
   *
   * Dimensionless circle circumference-to-diameter ratio.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pi_c.html
   */
  pi(): number;

  /**
   * Return twice the CSPICE value of pi (a full turn in radians).
   *
   * The result is 2 * pi.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/twopi_c.html
   */
  twopi(): number;

  /**
   * Return half the CSPICE value of pi (a quarter turn in radians).
   *
   * The result is pi / 2.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/halfpi_c.html
   */
  halfpi(): number;

  /**
   * Return the number of degrees per radian.
   *
   * Multiply an angle in radians by this value to obtain degrees.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dpr_c.html
   */
  dpr(): number;

  /**
   * Return the number of radians per degree.
   *
   * Multiply an angle in degrees by this value to obtain radians.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rpd_c.html
   */
  rpd(): number;

  /**
   * Return the speed of light in vacuum: 299792.458 kilometers per second.
   *
   * This is the IAU value used by CSPICE.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/clight_c.html
   */
  clight(): number;

  /**
   * Return the largest finite double-precision value supported by CSPICE.
   *
   * The value is toolkit/platform dependent (DBL_MAX); on supported
   * IEEE-754 binary64 backends it equals Number.MAX_VALUE.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dpmax_c.html
   */
  dpmax(): number;

  /**
   * Return the most negative finite double-precision value supported by CSPICE.
   *
   * On supported backends this is -DBL_MAX (-Number.MAX_VALUE),
   * not the smallest positive representable number.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The double-precision CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dpmin_c.html
   */
  dpmin(): number;

  /**
   * Return the largest integer representable by the toolkit SpiceInt type.
   *
   * The supported Node/WASM backends use signed 32-bit SpiceInt,
   * so the result is 2147483647, represented exactly as a JavaScript number.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The integer CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/intmax_c.html
   */
  intmax(): number;

  /**
   * Return the smallest integer representable by the toolkit SpiceInt type.
   *
   * The supported Node/WASM backends use signed 32-bit SpiceInt,
   * so the result is -2147483648, represented exactly as a JavaScript number.
   * Requires no kernels; error-free and has no caller-visible state effects.
   * @returns The integer CSPICE constant.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/intmin_c.html
   */
  intmin(): number;

  /**
   * Convert cylindrical coordinates to latitudinal coordinates.
   *
   * Input radius is distance from the Z axis; z is height above the XY plane.
   * Longitude passes through unchanged. Latitude is atan2(z, radius),
   * in [-pi, pi]; radius and latitude are zero at the origin.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cyllat_c.html
   */
  cyllat(
    radius: number,
    lon: number,
    z: number,
  ): { radius: number; lon: number; lat: number };

  /**
   * Convert cylindrical coordinates to a rectangular [x, y, z] vector.
   *
   * Input radius is distance from the Z axis; z is height above the XY plane.
   * Returns a new independent vector. Negative radius retains CSPICE behavior.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cylrec_c.html
   */
  cylrec(radius: number, lon: number, z: number): SpiceVector3;

  /**
   * Convert cylindrical coordinates to spherical coordinates.
   *
   * Input radius is distance from the Z axis; z is height above the XY plane.
   * Longitude passes through unchanged. Colatitude is atan2(radius, z),
   * in [-pi, pi]; radius and colatitude are zero at the origin.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cylsph_c.html
   */
  cylsph(
    radius: number,
    lon: number,
    z: number,
  ): { radius: number; colat: number; lon: number };

  /**
   * Convert latitudinal coordinates to cylindrical coordinates.
   *
   * Input radius is distance from the origin. Output radius is distance
   * from the Z axis and z is height above the XY plane. Longitude passes
   * through unchanged; negative radii and unrestricted angles are accepted.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/latcyl_c.html
   */
  latcyl(
    radius: number,
    lon: number,
    lat: number,
  ): { radius: number; lon: number; z: number };

  /**
   * Convert latitudinal coordinates to spherical coordinates.
   *
   * Radius and longitude pass through unchanged. Colatitude is pi/2 - lat.
   * Negative radii and unrestricted angles are accepted without normalization.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/latsph_c.html
   */
  latsph(
    radius: number,
    lon: number,
    lat: number,
  ): { radius: number; colat: number; lon: number };

  /**
   * Convert a rectangular [x, y, z] vector to cylindrical coordinates.
   *
   * Output radius is distance from the Z axis; z preserves the input height.
   * Longitude is in [0, 2*pi] and is zero on the Z axis. Input must contain
   * exactly three finite numbers; it is not modified.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/reccyl_c.html
   */
  reccyl(rect: Readonly<SpiceVector3>): {
    radius: number;
    lon: number;
    z: number;
  };

  /**
   * Convert spherical coordinates to cylindrical coordinates.
   *
   * Input radius is distance from the origin. Output radius is distance
   * from the Z axis and z is height above the XY plane. Longitude passes
   * through unchanged; negative radii and unrestricted angles are accepted.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sphcyl_c.html
   */
  sphcyl(
    radius: number,
    colat: number,
    lon: number,
  ): { radius: number; lon: number; z: number };

  /**
   * Convert spherical coordinates to latitudinal coordinates.
   *
   * Radius and longitude pass through unchanged. Latitude is pi/2 - colat.
   * Negative radii and unrestricted angles are accepted without normalization.
   * Angles are radians; distances use the same units throughout. Finite
   * inputs are required. CSPICE is error-free; unrepresentable results may
   * overflow. No kernels are needed, and no angles are normalized unless stated.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sphlat_c.html
   */
  sphlat(
    radius: number,
    colat: number,
    lon: number,
  ): { radius: number; lon: number; lat: number };

  /**
   * Return the Euclidean distance between two three-dimensional vectors.
   *
   * Distance uses the input units. CSPICE subtracts a - b before computing
   * the norm; unrepresentable differences or norms can overflow or yield NaN.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vdist_c.html
   */
  vdist(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): number;

  /**
   * Return an independent copy of a three-dimensional vector.
   *
   * Every component, including signed zero, is retained; the input is not modified.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vequ_c.html
   */
  vequ(v: Readonly<SpiceVector3>): SpiceVector3;

  /**
   * Pack scalar components into a new [x, y, z] vector.
   *
   * All components must be finite. Component order and signed zero are retained.
   * No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vpack_c.html
   */
  vpack(x: number, y: number, z: number): SpiceVector3;

  /**
   * Unpack a three-dimensional vector into its x, y, and z components.
   *
   * Component order and signed zero are retained; the input is not modified.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vupack_c.html
   */
  vupack(v: Readonly<SpiceVector3>): { x: number; y: number; z: number };

  /**
   * Return whether all three vector components equal zero.
   *
   * Positive and negative zero both count as zero. No tolerance is applied;
   * a nonzero subnormal component makes the result false.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vzero_c.html
   */
  vzero(v: Readonly<SpiceVector3>): boolean;

  /**
   * Return a vector normalized to unit length and its Euclidean norm.
   *
   * The zero vector produces unit [0, 0, 0] and norm 0. The returned unit
   * vector is independent of the input. Norm uses the input units; a norm
   * exceeding the representable range can be infinite, as in CSPICE.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/unorm_c.html
   */
  unorm(v: Readonly<SpiceVector3>): { unit: SpiceVector3; norm: number };

  /**
   * Return the normalized cross product a x b as an independent vector.
   *
   * Order is significant. A zero input or an exactly zero computed cross
   * product returns [0, 0, 0]. Near parallelism, normalization can amplify
   * roundoff; nominally parallel inputs can produce build-dependent directions.
   * CSPICE scales each input before crossing to reduce overflow/underflow.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ucrss_c.html
   */
  ucrss(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): SpiceVector3;

  /**
   * Return the angular separation of two vectors in radians, in [0, pi].
   *
   * Inputs must use the same reference frame. A zero input yields 0;
   * opposed vectors yield pi. Results retain CSPICE floating-point behavior
   * when intermediate norms exceed the representable range.
   * Vector inputs must contain exactly three finite numbers. No kernels
   * are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vsep_c.html
   */
  vsep(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): number;

  /**
   * Return the linear combination a * v1 + b * v2 as a new vector.
   *
   * Coefficients and three-component vectors must be finite. Inputs are not
   * modified. Arithmetic retains CSPICE overflow, underflow and cancellation
   * behavior; finite inputs can produce nonfinite results. No kernels are
   * needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vlcom_c.html
   */
  vlcom(
    a: number,
    v1: Readonly<SpiceVector3>,
    b: number,
    v2: Readonly<SpiceVector3>,
  ): SpiceVector3;

  /**
   * Return a * v1 + b * v2 + c * v3 as a new vector.
   *
   * Arguments alternate coefficients and their three-component vectors.
   * All inputs must be finite and are not modified. CSPICE does not guard
   * against overflow or underflow; nonfinite results and cancellation retain
   * its floating-point behavior. No kernels are needed. CSPICE is error-free;
   * invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vlcom3_c.html
   */
  vlcom3(
    a: number,
    v1: Readonly<SpiceVector3>,
    b: number,
    v2: Readonly<SpiceVector3>,
    c: number,
    v3: Readonly<SpiceVector3>,
  ): SpiceVector3;

  /**
   * Return the component of a perpendicular to b as a new vector.
   *
   * Both vectors must contain exactly three finite numbers in the same frame.
   * The pinned CSPICE N0067 implementation returns [0, 0, 0] if either input
   * is zero, including a nonzero a with zero b. This follows its executable
   * behavior despite the different zero-b statement in the NAIF prose.
   * Reciprocal scaling and cancellation retain CSPICE numerical limits;
   * finite extreme inputs can produce nonfinite results. No kernels are
   * needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vperp_c.html
   */
  vperp(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): SpiceVector3;

  /**
   * Return the projection of a onto b as a new vector.
   *
   * Both vectors must contain exactly three finite numbers in the same frame.
   * A zero input produces [0, 0, 0]. Reciprocal scaling retains CSPICE
   * numerical limits, including nonfinite results from extreme finite inputs.
   * No kernels are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vproj_c.html
   */
  vproj(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): SpiceVector3;

  /**
   * Return the relative difference norm(a - b) / max(norm(a), norm(b)).
   *
   * Both vectors must contain exactly three finite numbers in the same frame.
   * Equal vectors, including two zero vectors, return zero. The result is
   * dimensionless. CSPICE overflow and underflow can affect the nominal [0, 2]
   * range and can produce nonfinite results. No kernels are needed. CSPICE is
   * error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vrel_c.html
   */
  vrel(a: Readonly<SpiceVector3>, b: Readonly<SpiceVector3>): number;

  /**
   * Rotate v about an arbitrary axis by theta radians, returning a new vector.
   *
   * This is an active, right-handed vector rotation; positive pi/2 about +Z
   * maps +X to +Y. CSPICE normalizes the axis; a zero axis returns a copy of v.
   * Vectors must contain exactly three finite numbers and theta must be finite.
   * Numerical results retain CSPICE scaling, cancellation and overflow behavior.
   * No kernels are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vrotv_c.html
   */
  vrotv(
    v: Readonly<SpiceVector3>,
    axis: Readonly<SpiceVector3>,
    theta: number,
  ): SpiceVector3;

  /**
   * Express v in a coordinate system rotated by angle radians about axis.
   *
   * This is a coordinate rotation: positive pi/2 about axis 3 maps +X to -Y.
   * Axis 1=X, 2=Y, 3=Z; other signed 32-bit integer axes are reduced modulo 3
   * by CSPICE. Nonintegral or overflowing axis values throw before CSPICE.
   * The vector must contain exactly three finite numbers and angle must be
   * finite. The output is independent of v and retains CSPICE floating-point
   * limits. No kernels are needed. CSPICE is error-free.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rotvec_c.html
   */
  rotvec(v: Readonly<SpiceVector3>, angle: number, axis: number): SpiceVector3;

  /**
   * Return the scalar product transpose(v1) * matrix * v2.
   *
   * The matrix contains nine finite numbers in row-major order; it is not
   * transposed. Both vectors must contain exactly three finite numbers. Inputs
   * are not modified. Summation retains CSPICE overflow, underflow and
   * cancellation behavior, including nonfinite results from finite inputs.
   * No kernels are needed. CSPICE is error-free; invalid JavaScript inputs throw.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/vtmv_c.html
   */
  vtmv(
    v1: Readonly<SpiceVector3>,
    matrix: Mat3RowMajor,
    v2: Readonly<SpiceVector3>,
  ): number;

  /**
   * Convert range, azimuth and elevation to a new rectangular vector.
   *
   * Angles are radians. azccw=true measures azimuth from +X toward +Y;
   * false measures clockwise. elplsz=true measures elevation toward +Z;
   * false toward -Z. Negative range and angles outside their usual ranges
   * are passed through without normalization. Distance units are preserved.
   * All numeric inputs must be finite and both flags must be booleans.
   * No kernels are needed; results retain CSPICE floating-point limits.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/azlrec_c.html
   */
  azlrec(
    range: number,
    az: number,
    el: number,
    azccw: boolean,
    elplsz: boolean,
  ): SpiceVector3;

  /**
   * Convert a rectangular vector to { range, az, el }.
   *
   * azccw=true measures azimuth from +X toward +Y; false measures clockwise.
   * elplsz=true measures elevation toward +Z; false toward -Z. Azimuth is
   * in [0, 2*pi] and elevation in [-pi/2, pi/2], in radians. On the Z axis
   * azimuth is zero; at the origin both angles are zero. Range uses the
   * input distance units. rect must contain exactly three finite numbers;
   * flags must be booleans. The input is not modified. No kernels are
   * needed; finite inputs can produce nonfinite range through overflow.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recazl_c.html
   */
  recazl(
    rect: Readonly<SpiceVector3>,
    azccw: boolean,
    elplsz: boolean,
  ): { range: number; az: number; el: number };

  /**
   * Convert body-specific planetographic longitude, latitude and altitude
   * to a new rectangular vector using equatorial radius re and flattening f.
   *
   * Angles are radians; alt, re and the output use the same distance units.
   * Flattening is (re - polarRadius) / re. CSPICE requires re > 0 and f < 1;
   * negative flattening and altitude are allowed. Angles are not normalized.
   * Longitude is normally west-positive for prograde rotation and east-positive
   * for retrograde rotation; Earth, Moon and Sun default to east-positive.
   * `BODY<ID>_PGR_POSITIVE_LON` can override this with EAST or WEST. Without an
   * override, `BODY<ID>_PM` supplies the rotation rate; pinned N0067 requires
   * this data even for Moon and Sun, but not Earth. Current kernel-pool state
   * is used on each call. Unknown bodies, missing data, invalid overrides
   * and invalid spheroid parameters raise CSPICE errors.
   * body is a name or numeric ID string, passed unchanged; embedded NUL is
   * rejected. Numeric arguments must be finite. Numerical limits, including
   * nonfinite results from finite inputs, remain those of CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pgrrec_c.html
   */
  pgrrec(
    body: string,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): SpiceVector3;

  /**
   * Convert a rectangular vector to body-specific { lon, lat, alt }
   * using equatorial radius re and flattening f = (re - polarRadius) / re.
   *
   * Longitude is in [0, 2*pi] and latitude in [-pi/2, pi/2], in radians;
   * altitude and re use the vector's distance units. Longitude follows the
   * same body rotation and kernel-pool override conventions as pgrrec.
   * CSPICE requires re > 0 and f < 1; negative flattening is allowed. For
   * interior points where the nearest surface point is not unique, CSPICE's
   * choice is retained. Unknown bodies, missing rotation data, invalid
   * overrides and invalid spheroid parameters raise CSPICE errors.
   * body is an unchanged name or numeric ID string without embedded NUL.
   * rect must contain exactly three finite numbers, and re and f must be
   * finite. The input is not modified; a new object preserves all numerical
   * results, including nonfinite values at CSPICE's numerical limits.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recpgr_c.html
   */
  recpgr(
    body: string,
    rect: Readonly<SpiceVector3>,
    re: number,
    f: number,
  ): { lon: number; lat: number; alt: number };

  /**
   * Convert range, right ascension and declination to a new rectangular vector.
   *
   * Angles are radians: right ascension increases from +X toward +Y, and
   * declination from the XY plane toward +Z. Negative range and angles outside
   * their usual ranges are passed through without normalization. Distance
   * units are preserved. All inputs must be finite. No kernels are needed;
   * results retain CSPICE floating-point limits.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/radrec_c.html
   */
  radrec(range: number, ra: number, dec: number): SpiceVector3;

  /**
   * Convert a rectangular vector to { range, ra, dec }.
   *
   * Right ascension ra increases from +X toward +Y in [0, 2*pi]; declination
   * dec is in [-pi/2, pi/2], in radians. On the Z axis ra is zero; at the
   * origin both angles are zero. Range uses the input distance units. rect
   * must contain exactly three finite numbers and is not modified. No
   * kernels are needed; finite inputs can produce nonfinite range through
   * overflow. The returned object is independent of the input.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/recrad_c.html
   */
  recrad(rect: Readonly<SpiceVector3>): {
    range: number;
    ra: number;
    dec: number;
  };

  /**
   * Return a new rectangular point on a body's triaxial reference ellipsoid
   * at planetocentric longitude lon and latitude lat, in radians.
   *
   * Longitude increases from +X toward +Y independently of the body's spin;
   * latitude is measured from the XY plane toward +Z. Angles are passed
   * through without normalization. body must be a signed 32-bit integer ID.
   * Current kernel-pool `BODY<ID>_RADII` must supply three positive semiaxes;
   * missing or invalid radii raise CSPICE errors. Output units match those
   * radii (normally km). lon and lat must be finite; numerical limits remain
   * those of CSPICE, including possible nonfinite results. This is a
   * planetocentric surface conversion, not planetographic coordinates.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/srfrec_c.html
   */
  srfrec(body: number, lon: number, lat: number): SpiceVector3;

  /**
   * Bracket value within the closed interval bounded by end1 and end2.
   *
   * The endpoint order is immaterial. Values inside the interval are returned
   * unchanged; otherwise CSPICE returns the nearer endpoint. All arguments
   * must be finite numbers. No kernels are needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/brcktd_c.html
   */
  brcktd(value: number, end1: number, end2: number): number;

  /**
   * Bracket an integer value within the closed interval bounded by end1 and end2.
   *
   * The endpoint order is immaterial. Values inside the interval are returned
   * unchanged; otherwise CSPICE returns the nearer endpoint. All three inputs
   * must be signed 32-bit integers; fractional or out-of-range values throw
   * before CSPICE. No kernels are needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/brckti_c.html
   */
  brckti(value: number, end1: number, end2: number): number;

  /**
   * Convert a finite measurement value from inUnit to outUnit.
   *
   * Unit names are case-insensitive and use CSPICE's supported angle, distance
   * or time names and aliases. Strings are passed unchanged; embedded NUL is
   * rejected. Empty, unrecognized or incompatible units raise CSPICE errors.
   * No kernels are needed. The conversion uses the pinned toolkit's constants,
   * including its historical estimates for AU, parsecs and tropical years.
   * Overflow is not checked by CSPICE; nonfinite output from finite input is
   * preserved, so choose units and magnitudes within the desired numeric range.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/convrt_c.html
   */
  convrt(value: number, inUnit: string, outUnit: string): number;

  /**
   * Return CSPICE's ordered sum of all values, starting from zero.
   *
   * values must be a dense readonly array of finite numbers; the element count
   * must fit a signed 32-bit integer. An empty array returns zero. The input
   * is not modified. CSPICE's ordinary double-precision accumulation retains
   * rounding, cancellation and overflow, including nonfinite results. No
   * kernels are needed. WASM additionally limits the input buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sumad_c.html
   */
  sumad(values: readonly number[]): number;

  /**
   * Return CSPICE's ordered sum of all signed 32-bit integer values.
   *
   * values must be a dense readonly array whose length fits a signed 32-bit
   * integer. An empty array returns zero; the input is not modified. Every
   * prefix sum, starting from zero, must remain within [-2147483648, 2147483647].
   * Otherwise a RangeError is raised before calling CSPICE, even when the final
   * mathematical sum would fit. This guard excludes undefined C signed-overflow
   * behavior; it does not supply wraparound or replace the CSPICE result.
   * No kernels are needed. WASM additionally limits the input buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sumai_c.html
   */
  sumai(values: readonly number[]): number;

  /**
   * Return the maximum of values using the actual variadic CSPICE routine.
   *
   * values must be a dense readonly array of finite numbers containing
   * 0 to 30 elements, CSPICE's documented portable argument limit. An empty
   * array returns zero. The array length supplies the C argument count and
   * the input is not modified. Invalid values or longer arrays throw before
   * CSPICE. No kernels are needed.
   * Equal extrema retain the first occurrence, including its signed zero.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/maxd_c.html
   */
  maxd(values: readonly number[]): number;

  /**
   * Return the maximum of values using the actual variadic CSPICE routine.
   *
   * values must be a dense readonly array of signed 32-bit integers containing
   * 0 to 30 elements, CSPICE's documented portable argument limit. An empty
   * array returns zero. The array length supplies the C argument count and
   * the input is not modified. Invalid values or longer arrays throw before
   * CSPICE. No kernels are needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/maxi_c.html
   */
  maxi(values: readonly number[]): number;

  /**
   * Return the minimum of values using the actual variadic CSPICE routine.
   *
   * values must be a dense readonly array of finite numbers containing
   * 0 to 30 elements, CSPICE's documented portable argument limit. An empty
   * array returns zero. The array length supplies the C argument count and
   * the input is not modified. Invalid values or longer arrays throw before
   * CSPICE. No kernels are needed.
   * Equal extrema retain the last occurrence, including its signed zero.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mind_c.html
   */
  mind(values: readonly number[]): number;

  /**
   * Return the minimum of values using the actual variadic CSPICE routine.
   *
   * values must be a dense readonly array of signed 32-bit integers containing
   * 0 to 30 elements, CSPICE's documented portable argument limit. An empty
   * array returns zero. The array length supplies the C argument count and
   * the input is not modified. Invalid values or longer arrays throw before
   * CSPICE. No kernels are needed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/mini_c.html
   */
  mini(values: readonly number[]): number;

  /** SPICE `reclat_c`: rectangular -> latitudinal coordinates. */
  reclat(rect: SpiceVector3): { radius: number; lon: number; lat: number };
  /** SPICE `latrec_c`: latitudinal -> rectangular coordinates. */
  latrec(radius: number, lon: number, lat: number): SpiceVector3;

  /** SPICE `recsph_c`: rectangular -> spherical coordinates. */
  recsph(rect: SpiceVector3): { radius: number; colat: number; lon: number };
  /** SPICE `sphrec_c`: spherical -> rectangular coordinates. */
  sphrec(radius: number, colat: number, lon: number): SpiceVector3;

  /** SPICE `vnorm_c`: vector magnitude (Euclidean norm). */
  vnorm(v: SpiceVector3): number;

  /**
   * Compute the unit vector of `v`.
   *
   * **Zero-vector behavior:** if `v` is `[0, 0, 0]`, this returns `[0, 0, 0]` and
   * does **not** throw.
   *
   * This matches the NAIF CSPICE `vhat_c` definition.
   */
  vhat(v: SpiceVector3): SpiceVector3;
  /** SPICE `vdot_c`: dot product of two vectors. */
  vdot(a: SpiceVector3, b: SpiceVector3): number;
  /** SPICE `vcrss_c`: cross product of two vectors. */
  vcrss(a: SpiceVector3, b: SpiceVector3): SpiceVector3;

  /** SPICE `vadd_c`: vector addition. */
  vadd(a: SpiceVector3, b: SpiceVector3): SpiceVector3;
  /** SPICE `vsub_c`: vector subtraction. */
  vsub(a: SpiceVector3, b: SpiceVector3): SpiceVector3;
  /** SPICE `vminus_c`: negate a vector. */
  vminus(v: SpiceVector3): SpiceVector3;
  /** SPICE `vscl_c`: multiply vector by scalar. */
  vscl(s: number, v: SpiceVector3): SpiceVector3;

  /** SPICE `mxm_c`: matrix-matrix multiplication. */
  mxm(a: Mat3RowMajor, b: Mat3RowMajor): Mat3RowMajor;

  /**
   * Generate a rotation matrix representing a rotation about a coordinate axis.
   *
   * Angle is in radians; this rotates the coordinate system.
   * Axis is 1=x, 2=y, 3=z; other signed 32-bit integer axes are reduced modulo 3.
   * Non-integral or overflowing axes throw before CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rotate_c.html
   */
  rotate(angle: number, axis: number): Mat3RowMajor;

  /**
   * Rotate a matrix about a coordinate axis.
   *
   * Returns the left product rotate(angle, axis) * m in row-major order.
   * Angle is in radians; signed 32-bit integer axis indices are reduced modulo 3.
   * Non-integral or overflowing axes throw before CSPICE.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/rotmat_c.html
   */
  rotmat(m: Mat3RowMajor, angle: number, axis: number): Mat3RowMajor;

  /**
   * Rotate vectors about an arbitrary axis by an angle in radians.
   * The axis is normalized; a zero axis produces the identity matrix.
   * Returns a length-nine matrix in row-major order.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/axisar_c.html
   */
  axisar(axis: SpiceVector3, angle: number): Mat3RowMajor;

  /** SPICE `georec_c`: geodetic lon/lat/alt -> rectangular coordinates. */
  georec(
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): SpiceVector3;
  /** SPICE `recgeo_c`: rectangular -> geodetic lon/lat/alt coordinates. */
  recgeo(
    rect: SpiceVector3,
    re: number,
    f: number,
  ): { lon: number; lat: number; alt: number };

  /** SPICE `mxv_c`: multiply matrix by vector. */
  mxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3;
  /** SPICE `mtxv_c`: multiply transpose(matrix) by vector. */
  mtxv(m: Mat3RowMajor, v: SpiceVector3): SpiceVector3;
}
