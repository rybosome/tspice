/** Raw CSPICE operations over NUL-terminated UTF-8 byte strings. */
export interface StringsApi {
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
