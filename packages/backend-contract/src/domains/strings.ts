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

  /**
   * Find a byte from chars at or after start.
   * Return a zero-based UTF-8 byte index, or -1 if either string is empty or
   * no candidate matches. Every UTF-8 byte in chars belongs to the set, including trailing blanks.
   * A match can start inside a multibyte character.
   * Negative starts search from zero. Starts beyond the last possible match return -1.
   *
   * Supply well-formed text without NUL and a signed32 start. For INT32_MAX
   * the backend passes INT32_MAX-1, also beyond every possible candidate,
   * to keep the toolkit's one-based index conversion representable. Each
   * terminated input must fit signed32, or 256 MiB on WASM.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cpos_c.html
   */
  cpos(text: string, chars: string, start: number): number;

  /**
   * Find a byte from chars at or before start.
   * Return a zero-based UTF-8 byte index, or -1 if either string is empty or
   * no candidate matches. Every UTF-8 byte in chars belongs to the set, including trailing blanks.
   * A match can start inside a multibyte character.
   * Negative starts return -1. Starts beyond the last possible match search backward from it.
   *
   * Supply well-formed text without NUL and a signed32 start. For INT32_MAX
   * the backend passes INT32_MAX-1, also beyond every possible candidate,
   * to keep the toolkit's one-based index conversion representable. Each
   * terminated input must fit signed32, or 256 MiB on WASM.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cposr_c.html
   */
  cposr(text: string, chars: string, start: number): number;

  /**
   * Find a byte absent from chars at or after start.
   * Return a zero-based UTF-8 byte index, or -1 if either string is empty or
   * no candidate matches. Every UTF-8 byte in chars belongs to the set, including trailing blanks.
   * A match can start inside a multibyte character.
   * Negative starts search from zero. Starts beyond the last possible match return -1.
   *
   * Supply well-formed text without NUL and a signed32 start. For INT32_MAX
   * the backend passes INT32_MAX-1, also beyond every possible candidate,
   * to keep the toolkit's one-based index conversion representable. Each
   * terminated input must fit signed32, or 256 MiB on WASM.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ncpos_c.html
   */
  ncpos(text: string, chars: string, start: number): number;

  /**
   * Find a byte absent from chars at or before start.
   * Return a zero-based UTF-8 byte index, or -1 if either string is empty or
   * no candidate matches. Every UTF-8 byte in chars belongs to the set, including trailing blanks.
   * A match can start inside a multibyte character.
   * Negative starts return -1. Starts beyond the last possible match search backward from it.
   *
   * Supply well-formed text without NUL and a signed32 start. For INT32_MAX
   * the backend passes INT32_MAX-1, also beyond every possible candidate,
   * to keep the toolkit's one-based index conversion representable. Each
   * terminated input must fit signed32, or 256 MiB on WASM.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ncposr_c.html
   */
  ncposr(text: string, chars: string, start: number): number;

  /**
   * Find the first exact occurrence of substr starting at or after start.
   * Return a zero-based UTF-8 byte index, or -1 if either string is empty or
   * no candidate matches. The search compares complete substring bytes, including trailing blanks.
   * Negative starts search from zero. Starts beyond the last possible match return -1.
   *
   * Supply well-formed text without NUL and a signed32 start. For INT32_MAX
   * the backend passes INT32_MAX-1, also beyond every possible candidate,
   * to keep the toolkit's one-based index conversion representable. Each
   * terminated input must fit signed32, or 256 MiB on WASM.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pos_c.html
   */
  pos(text: string, substr: string, start: number): number;

  /**
   * Find the last exact occurrence of substr starting at or before start.
   * Return a zero-based UTF-8 byte index, or -1 if either string is empty or
   * no candidate matches. The search compares complete substring bytes, including trailing blanks.
   * Negative starts return -1. Starts beyond the last possible match search backward from it.
   *
   * Supply well-formed text without NUL and a signed32 start. For INT32_MAX
   * the backend passes INT32_MAX-1, also beyond every possible candidate,
   * to keep the toolkit's one-based index conversion representable. Each
   * terminated input must fit signed32, or 256 MiB on WASM.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/posr_c.html
   */
  posr(text: string, substr: string, start: number): number;

  /**
   * Find the first entry equivalent to value under CSPICE eqstr. Return a
   * zero-based row index, or -1 for an empty array or an absent value. ASCII
   * case and C whitespace throughout nonempty strings are ignored. Empty
   * strings match other empty strings and differ from whitespace-only rows.
   * Classification of bytes outside portable ASCII depends on the C locale.
   *
   * Supply well-formed, NUL-free strings. The backend snapshots the array
   * in caller order and NUL-terminates each entry in a fixed-width UTF-8
   * row. The width is at least two bytes and fits the widest row plus NUL.
   * The entire row table and the terminated key must each fit signed32,
   * or 256 MiB on WASM.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/esrchc_c.html
   */
  esrchc(value: string, values: readonly string[]): number;
}
