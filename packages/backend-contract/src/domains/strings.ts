/** Raw CSPICE operations over NUL-terminated UTF-8 byte strings. */
export interface StringsApi {
  /**
   * Return the first space-delimited word and left-justified remainder. Leading and trailing
   * ASCII spaces are discarded by the toolkit. Each optional capacity counts UTF-8 bytes
   * including the terminator and defaults to room for the entire input. Capacities below two
   * signal STRINGTOOSHORT, even on empty input. Truncation or a delimiter byte that splits a
   * UTF-8 scalar raises a decoding error. Input byte lengths leave room for signed32 toolkit
   * cursor arithmetic. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/nextwd_c.html
   */
  nextwd(
    input: string,
    nexlen?: number,
    reslen?: number,
  ): { next: string; rest: string };

  /**
   * Return the word at zero-based signed32 ordinal nth and its starting UTF-8 byte index.
   * Negative and absent ordinals return an empty word and loc -1. Only ASCII space separates
   * words. Optional worlen includes the terminator and must be at least two. Output truncation
   * preserves the original location. Truncation or a delimiter byte that splits a UTF-8 scalar
   * raises a decoding error. Input byte lengths leave room for signed32 toolkit cursor
   * arithmetic. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/nthwd_c.html
   */
  nthwd(
    input: string,
    nth: number,
    worlen?: number,
  ): { word: string; loc: number };

  /**
   * Split a list using the first byte of delim. Return the first nmax items and their actual
   * count, including empty fields between delimiters. A space delimiter compresses runs of
   * blanks. Optional itemln is the byte capacity of each row including its terminator. Each
   * field is truncated independently. A nonpositive count returns no items. For a positive
   * count itemln must be at least two; an empty list returns one empty item. Effective row
   * count and width are bounded by input byte length plus one (minimum width two). Their
   * allocated product must fit 256 MiB. Truncation or a delimiter byte that splits a UTF-8
   * scalar raises a decoding error. Input byte lengths leave room for signed32 toolkit cursor
   * arithmetic. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lparse_c.html
   */
  lparse(
    list: string,
    delim: string,
    nmax: number,
    itemln?: number,
  ): { n: number; items: string[] };

  /**
   * Split a list using any byte in delims. Return the first nmax items and their actual count.
   * ASCII space receives CSPICE’s special treatment when present in the delimiter set.
   * Optional itemln limits each field in bytes including its terminator. A nonpositive count
   * returns no items. For a positive count itemln must be at least two; an empty list returns
   * one empty item. Effective row count and width are bounded by input byte length plus one
   * (minimum width two). Their allocated product must fit 256 MiB. Truncation or a delimiter
   * byte that splits a UTF-8 scalar raises a decoding error. Input byte lengths leave room for
   * signed32 toolkit cursor arithmetic. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lparsm_c.html
   */
  lparsm(
    list: string,
    delims: string,
    nmax: number,
    itemln?: number,
  ): { n: number; items: string[] };

  /**
   * Scan one signed decimal mantissa beginning exactly at the signed32 UTF-8 byte index first.
   * Return the inclusive last byte and byte count. Nonempty misses return last=first−1 and
   * nchar=0. Empty input returns last=−1 and nchar=0. Where necessary, an equivalent out-of-
   * range scan preserves the mathematical miss index, including −2147483649. Input byte
   * lengths leave room for signed32 toolkit cursor arithmetic. No kernels are required.
   * N0067 reports last and nchar independently. For "-.25" at byte zero, last is 3
   * and nchar is 3.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lx4dec_c.html
   */
  lx4dec(input: string, first: number): { last: number; nchar: number };

  /**
   * Scan one number, including an optional signed E or D exponent beginning exactly at the
   * signed32 UTF-8 byte index first. Return the inclusive last byte and byte count. Nonempty
   * misses return last=first−1 and nchar=0. Empty input returns last=−1 and nchar=0. Where
   * necessary, an equivalent out-of-range scan preserves the mathematical miss index,
   * including −2147483649. Input byte lengths leave room for signed32 toolkit cursor
   * arithmetic. No kernels are required.
   * N0067 reports last and nchar independently. For "-.25" at byte zero, last is 3
   * and nchar is 3. A complete exponent in LX4NUM recomputes the full token length.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lx4num_c.html
   */
  lx4num(input: string, first: number): { last: number; nchar: number };

  /**
   * Scan one signed integer beginning exactly at the signed32 UTF-8 byte index first. Return
   * the inclusive last byte and byte count. Nonempty misses return last=first−1 and nchar=0.
   * Empty input returns last=−1 and nchar=0. Where necessary, an equivalent out-of-range scan
   * preserves the mathematical miss index, including −2147483649. Input byte lengths leave
   * room for signed32 toolkit cursor arithmetic. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lx4sgn_c.html
   */
  lx4sgn(input: string, first: number): { last: number; nchar: number };

  /**
   * Scan one unsigned integer beginning exactly at the signed32 UTF-8 byte index first. Return
   * the inclusive last byte and byte count. All misses return last=first−1 and nchar=0. For
   * empty input the N0067 C routine leaves both outputs untouched; the adapter initializes
   * them to the documented miss before calling. Where necessary, an equivalent out-of-range
   * scan preserves the mathematical miss index, including −2147483649. Input byte lengths
   * leave room for signed32 toolkit cursor arithmetic. No kernels are required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lx4uns_c.html
   */
  lx4uns(input: string, first: number): { last: number; nchar: number };

  /**
   * Scan one quoted string token, including doubled embedded quote bytes beginning exactly at
   * the signed32 UTF-8 byte index first. Return the inclusive last byte and byte count. The
   * quote is one ASCII byte. All misses return last=first−1 and nchar=0. Where necessary, an
   * equivalent out-of-range scan preserves the mathematical miss index, including −2147483649.
   * Input byte lengths leave room for signed32 toolkit cursor arithmetic. No kernels are
   * required.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lxqstr_c.html
   */
  lxqstr(
    input: string,
    qchar: string,
    first: number,
  ): { last: number; nchar: number };

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
