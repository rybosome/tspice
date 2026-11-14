/** Raw CSPICE operations over NUL-terminated UTF-8 byte strings. */
export interface StringsApi {
  /**
   * Encode a finite double in CSPICE normalized hexadecimal notation. Returns the C text prefix
   * and full hexadecimal byte length, even if a short capacity truncates the string. The
   * default capacity covers N0067’s 255-byte source workspace. The optional signed output
   * capacity counts UTF-8 bytes including the NUL terminator. Its default holds the full
   * result. A partial UTF-8 scalar cannot be returned as a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dp2hx_c.html
   */
  dp2hx(value: number, lenout?: number): { hxstr: string; hxssiz: number };

  /**
   * Parse a normalized hexadecimal number. A successful result contains the double and empty
   * diagnostic. A conversion failure returns error true and the diagnostic text. Empty input or
   * output room below two signals a CSPICE error. Extremely large valid signed exponents use an
   * equivalent, bounded scaling count covering binary64 overflow and underflow. The optional
   * signed output capacity counts UTF-8 bytes including the NUL terminator. Its default holds
   * the full result. A partial UTF-8 scalar cannot be returned as a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/hx2dp_c.html
   */
  hx2dp(
    input: string,
    lenout?: number,
  ):
    | { error: false; number: number; errmsg: string }
    | { error: true; errmsg: string };

  /**
   * Parse a CSPICE decimal expression as a double. The grammar accepts spaces, commas, implicit
   * mantissas, D or E exponents and the PI mnemonic. Invalid and out-of-range expressions
   * signal a CSPICE error.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/prsdp_c.html
   */
  prsdp(input: string): number;

  /**
   * Parse a CSPICE decimal expression into a signed 32-bit integer. The toolkit truncates its
   * parsed value toward zero and signals a CSPICE error for a failed parse or unrepresentable
   * integer.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/prsint_c.html
   */
  prsint(input: string): number;

  /**
   * Replace the first occurrence of the trimmed marker with the trimmed character value. An
   * empty/blank replacement inserts one blank; an empty/blank marker leaves the input unchanged
   * apart from output truncation/trailing Fortran blanks. The optional signed output capacity
   * counts UTF-8 bytes including the NUL terminator. Its default holds the full result. A
   * partial UTF-8 scalar cannot be returned as a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/repmc_c.html
   */
  repmc(input: string, marker: string, value: string, lenout?: number): string;

  /**
   * Replace the first marker with a cardinal English integer in upper (U), lower (L), or
   * initial capital (C) case. INT32_MIN cannot be converted by pinned INTTXT. Missing markers
   * and early empty outputs retain canonical behavior. The optional signed output capacity
   * counts UTF-8 bytes including the NUL terminator. Its default holds the full result. A
   * partial UTF-8 scalar cannot be returned as a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/repmct_c.html
   */
  repmct(
    input: string,
    marker: string,
    value: number,
    rtcase: string,
    lenout?: number,
  ): string;

  /**
   * Replace the first marker with a finite double in scientific notation, using 1–14
   * significant digits. N0067 clamps the supplied signed significant-digit count. The optional
   * signed output capacity counts UTF-8 bytes including the NUL terminator. Its default holds
   * the full result. A partial UTF-8 scalar cannot be returned as a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/repmd_c.html
   */
  repmd(
    input: string,
    marker: string,
    value: number,
    sigdig: number,
    lenout?: number,
  ): string;

  /**
   * Replace the first marker with a finite double in scientific (E) or fixed (F) format. N0067
   * also uses its fixed formatter for other format bytes. The toolkit controls rounding,
   * significant digits and width within its 56-byte formatting workspace. The optional signed
   * output capacity counts UTF-8 bytes including the NUL terminator. Its default holds the full
   * result. A partial UTF-8 scalar cannot be returned as a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/repmf_c.html
   */
  repmf(
    input: string,
    marker: string,
    value: number,
    sigdig: number,
    format: string,
    lenout?: number,
  ): string;

  /**
   * Replace the first marker with the decimal representation of a signed 32-bit integer,
   * including both endpoints. The optional signed output capacity counts UTF-8 bytes including
   * the NUL terminator. Its default holds the full result. A partial UTF-8 scalar cannot be
   * returned as a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/repmi_c.html
   */
  repmi(input: string, marker: string, value: number, lenout?: number): string;

  /**
   * Replace the first marker with TRUE or FALSE in upper (U), lower (L), or initial capital (C)
   * case. The value must be a boolean. This CSPICE wrapper requires at least two output bytes.
   * The optional signed output capacity counts UTF-8 bytes including the NUL terminator. Its
   * default holds the full result. A partial UTF-8 scalar cannot be returned as a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/repml_c.html
   */
  repml(
    input: string,
    marker: string,
    value: boolean,
    rtcase: string,
    lenout?: number,
  ): string;

  /**
   * Replace the first marker with an ordinal English integer in upper (U), lower (L), or
   * initial capital (C) case. INT32_MIN cannot be converted by the underlying cardinal
   * formatter. The optional signed output capacity counts UTF-8 bytes including the NUL
   * terminator. Its default holds the full result. A partial UTF-8 scalar cannot be returned as
   * a JS string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/repmot_c.html
   */
  repmot(
    input: string,
    marker: string,
    value: number,
    rtcase: string,
    lenout?: number,
  ): string;

  /**
   * Compress consecutive occurrences of delim in input to at most n bytes.
   * A nonpositive signed32 n removes every delimiter. Other bytes and trailing
   * whitespace are preserved. delim is one ASCII byte, including NUL, which
   * cannot occur within the input C string. Empty input returns an empty string.
   *
   * Input text must be a well-formed JS string without embedded NUL. CSPICE
   * operates on bytes and supplies ASCII text semantics. No kernels are needed.
   *
   * Optional signed32 lenout is the capacity in bytes including the terminator.
   * The default holds the entire result. A smaller capacity truncates on the
   * right. A capacity below 1 signals SPICE(STRINGTOOSHORT). A prefix ending
   * inside a UTF-8 scalar cannot be represented as a string and throws TypeError.
   * The encoded input plus its terminator must fit signed32. WASM limits
   * each allocated buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cmprss_c.html
   */
  cmprss(delim: string, n: number, input: string, lenout?: number): string;

  /**
   * Compare a and b ignoring ASCII letter case and C whitespace throughout.
   * Two empty strings compare equal. Exactly one empty string compares unequal,
   * including when the other string contains only whitespace. CSPICE uses C
   * isspace on bytes, so classification outside portable ASCII is locale dependent.
   *
   * Input text must be a well-formed JS string without embedded NUL. CSPICE
   * operates on bytes and supplies ASCII text semantics. No kernels are needed.
   * The encoded input plus its terminator must fit signed32. WASM limits
   * each allocated buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/eqstr_c.html
   */
  eqstr(a: string, b: string): boolean;

  /**
   * Return whether input is empty or contains only C whitespace bytes.
   * In the C locale this includes space, tab, newline, vertical tab, form feed
   * and carriage return. The toolkit uses the host C locale for classification.
   *
   * Input text must be a well-formed JS string without embedded NUL. CSPICE
   * operates on bytes and supplies ASCII text semantics. No kernels are needed.
   * The encoded input plus its terminator must fit signed32. WASM limits
   * each allocated buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/iswhsp_c.html
   */
  iswhsp(input: string): boolean;

  /**
   * Return the zero-based UTF-8 byte index of the last byte other than ASCII
   * space in input. Empty or all-space input returns -1. Tabs remain significant.
   * A multibyte character can end at a byte index different from its JS index.
   *
   * Input text must be a well-formed JS string without embedded NUL. CSPICE
   * operates on bytes and supplies ASCII text semantics. No kernels are needed.
   * The encoded input plus its terminator must fit signed32. WASM limits
   * each allocated buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lastnb_c.html
   */
  lastnb(input: string): number;

  /**
   * Convert ASCII uppercase letters in input to lowercase. Other bytes, leading
   * and trailing whitespace are preserved. Empty input returns an empty string.
   *
   * Input text must be a well-formed JS string without embedded NUL. CSPICE
   * operates on bytes and supplies ASCII text semantics. No kernels are needed.
   *
   * Optional signed32 lenout is the capacity in bytes including the terminator.
   * The default holds the entire result. A smaller capacity truncates on the
   * right. A capacity below 2 signals SPICE(STRINGTOOSHORT). A prefix ending
   * inside a UTF-8 scalar cannot be represented as a string and throws TypeError.
   * The encoded input plus its terminator must fit signed32. WASM limits
   * each allocated buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lcase_c.html
   */
  lcase(input: string, lenout?: number): string;

  /**
   * Convert ASCII lowercase letters in input to uppercase. Other bytes, leading
   * and trailing whitespace are preserved. Empty input returns an empty string.
   *
   * Input text must be a well-formed JS string without embedded NUL. CSPICE
   * operates on bytes and supplies ASCII text semantics. No kernels are needed.
   *
   * Optional signed32 lenout is the capacity in bytes including the terminator.
   * The default holds the entire result. A smaller capacity truncates on the
   * right. A capacity below 2 signals SPICE(STRINGTOOSHORT). A prefix ending
   * inside a UTF-8 scalar cannot be represented as a string and throws TypeError.
   * The encoded input plus its terminator must fit signed32. WASM limits
   * each allocated buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ucase_c.html
   */
  ucase(input: string, lenout?: number): string;

  /**
   * Match input against templ using CSPICE's ASCII case-insensitive literal
   * comparison. wstr matches zero or more bytes and wchr matches one byte.
   * Supply each wildcard as one ASCII byte, including NUL to disable that token.
   * Wildcard token recognition is case sensitive. Leading and trailing ASCII
   * spaces in input and templ are ignored. Empty input or template signals
   * SPICE(EMPTYSTRING). A nonempty all-space string is a valid input.
   *
   * Input text must be a well-formed JS string without embedded NUL. CSPICE
   * operates on bytes and supplies ASCII text semantics. No kernels are needed.
   * The encoded input plus its terminator must fit signed32. WASM limits
   * each allocated buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/matchi_c.html
   */
  matchi(input: string, templ: string, wstr: string, wchr: string): boolean;

  /**
   * Match input against templ using CSPICE's case-sensitive literal comparison.
   * wstr matches zero or more bytes and wchr matches one byte. Supply each
   * wildcard as one ASCII byte, including NUL to disable that token. Leading
   * and trailing ASCII spaces in input and templ are ignored. Empty input or
   * template signals SPICE(EMPTYSTRING). A nonempty all-space string is valid.
   *
   * Input text must be a well-formed JS string without embedded NUL. CSPICE
   * operates on bytes and supplies ASCII text semantics. No kernels are needed.
   * The encoded input plus its terminator must fit signed32. WASM limits
   * each allocated buffer to 256 MiB.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/matchw_c.html
   */
  matchw(input: string, templ: string, wstr: string, wchr: string): boolean;
}
