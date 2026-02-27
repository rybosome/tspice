#include "cspice_runner_io.h"

ReadStdinErr read_all_stdin(char **outBuf, size_t *outLen) {
  *outBuf = NULL;
  *outLen = 0;
  // Ensure error detail never uses stale errno.
  errno = 0;

  const size_t maxBytes = (size_t)CSPICE_RUNNER_MAX_STDIN_BYTES;
  // Read 1 extra byte beyond the budget as a deterministic overflow sentinel.
  const size_t maxRead = maxBytes + 1;
  // +1 for the trailing NUL terminator.
  const size_t maxCap = maxRead + 1;

  if (maxRead <= maxBytes || maxCap <= maxRead) {
    return READ_STDIN_OVERFLOW;
  }

  size_t cap = 4096;
  if (cap > maxCap) {
    cap = maxCap;
  }

  char *buf = (char *)malloc(cap);
  if (!buf) {
    return READ_STDIN_OOM;
  }

  size_t len = 0;
  while (len < maxRead) {

    // Ensure there is always room for at least 1 more byte and the trailing NUL.
    if (len + 1 >= cap) {
      // Grow with overflow guard, but never beyond the max.
      size_t nextCap = cap * 2;
      if (nextCap < cap) {
        free(buf);
        return READ_STDIN_OVERFLOW;
      }
      if (nextCap > maxCap) {
        nextCap = maxCap;
      }
      if (nextCap <= cap) {
        free(buf);
        return READ_STDIN_OVERFLOW;
      }

      char *next = (char *)realloc(buf, nextCap);
      if (!next) {
        free(buf);
        return READ_STDIN_OOM;
      }
      buf = next;
      cap = nextCap;
    }

    const size_t remainingBudget = maxRead - len;
    const size_t remainingBuf = cap - len - 1;
    const size_t toRead =
        remainingBuf < remainingBudget ? remainingBuf : remainingBudget;

    size_t n = fread(buf + len, 1, toRead, stdin);
    len += n;

    if (len > maxBytes) {
      free(buf);
      return READ_STDIN_TOO_LARGE;
    }

    if (n < toRead) {
      if (ferror(stdin)) {
        if (errno == 0) {
          errno = EIO;
        }
        free(buf);
        return READ_STDIN_IO;
      }
      break;
    }
  }

  buf[len] = '\0';
  *outBuf = buf;
  *outLen = len;
  return READ_STDIN_OK;
}

bool is_ascii_whitespace(unsigned char c) {
  return c == 32 /* space */ || c == 9 /* \t */ || c == 10 /* \n */ ||
         c == 13 /* \r */ || c == 12 /* \f */ || c == 11 /* \v */;
}

normalize_bod_item_err_t normalize_bod_item(const char *item, char **out) {
  *out = NULL;
  if (item == NULL) {
    return NORMALIZE_BOD_ITEM_INVALID;
  }

  const size_t len = strlen(item);
  // Contract guardrail: item names are expected to be short.
  if (len > (size_t)MAX_BOD_ITEM_BYTES) {
    return NORMALIZE_BOD_ITEM_TOO_LONG;
  }

  size_t start = 0;
  while (start < len && is_ascii_whitespace((unsigned char)item[start])) {
    start++;
  }

  size_t end = len;
  while (end > start && is_ascii_whitespace((unsigned char)item[end - 1])) {
    end--;
  }

  const size_t outLen = end - start;
  char *normalized = (char *)malloc(outLen + 1);
  if (normalized == NULL) {
    return NORMALIZE_BOD_ITEM_OOM;
  }

  for (size_t i = 0; i < outLen; i++) {
    const unsigned char c = (unsigned char)item[start + i];
    if (c >= 97 /* a */ && c <= 122 /* z */) {
      normalized[i] = (char)(c - 32);
    } else {
      normalized[i] = (char)c;
    }
  }
  normalized[outLen] = '\0';
  *out = normalized;
  return NORMALIZE_BOD_ITEM_OK;
}

void write_found_dla_descriptor_json(const SpiceDLADescr *descr,
                                            SpiceBoolean found) {
  if (found != SPICETRUE) {
    fputs("{\"ok\":true,\"result\":{\"found\":false}}\n", stdout);
    return;
  }

  fputs("{\"ok\":true,\"result\":{\"found\":true,\"descr\":{", stdout);
  fputs("\"bwdptr\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->bwdptr);
  fputs(",\"fwdptr\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->fwdptr);
  fputs(",\"ibase\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->ibase);
  fputs(",\"isize\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->isize);
  fputs(",\"dbase\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->dbase);
  fputs(",\"dsize\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->dsize);
  fputs(",\"cbase\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->cbase);
  fputs(",\"csize\":", stdout);
  fprintf(stdout, "%" PRIdMAX, (intmax_t)descr->csize);
  fputs("}}}\n", stdout);
}
