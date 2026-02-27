#include "cspice_runner_temp_files.h"

void sanitize_file_io_temp_tag(const char *tag,
                                      char *out,
                                      size_t outBytes) {
  if (outBytes == 0) {
    return;
  }

  if (tag == NULL) {
    tag = "";
  }

  size_t w = 0;
  bool prevDash = false;
  for (size_t i = 0; tag[i] != '\0' && w + 1 < outBytes && w < 64; i++) {
    const unsigned char c = (unsigned char)tag[i];
    if (isalnum(c) || c == '.' || c == '_' || c == '-') {
      out[w++] = (char)c;
      prevDash = (c == '-');
      continue;
    }

    if (!prevDash && w + 1 < outBytes && w < 64) {
      out[w++] = '-';
      prevDash = true;
    }
  }

  while (w > 0 && out[w - 1] == '-') {
    w--;
  }

  if (w == 0) {
    const char fallback[] = "file-io";
    size_t j = 0;
    while (fallback[j] != '\0' && j + 1 < outBytes) {
      out[j] = fallback[j];
      j++;
    }
    out[j] = '\0';
    return;
  }

  out[w] = '\0';
}

bool build_file_io_temp_path(const char *tag,
                                    const char *extension,
                                    char *outPath,
                                    size_t outPathBytes,
                                    int *outFd,
                                    char *detail,
                                    size_t detailBytes) {
  if (outPath == NULL || outPathBytes == 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "temp path output buffer is missing");
    }
    return false;
  }

  if (outFd == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "temp file descriptor output is missing");
    }
    return false;
  }

  *outFd = -1;

  char safeTag[80];
  sanitize_file_io_temp_tag(tag, safeTag, sizeof(safeTag));

  const char *tmpDir = getenv("TMPDIR");
  if (tmpDir == NULL || tmpDir[0] == '\0') {
    tmpDir = "/tmp";
  }

  if (extension == NULL || extension[0] == '\0') {
    extension = ".tmp";
  }

  const char *extLead = "";
  if (extension[0] != '.') {
    extLead = ".";
  }

  const size_t suffixBytes = strlen(extLead) + strlen(extension);
  if (suffixBytes == 0 || suffixBytes > INT_MAX) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail,
               detailBytes,
               "invalid temporary file extension length");
    }
    return false;
  }

  const int n = snprintf(
      outPath,
      outPathBytes,
      "%s/tspice-parity-%s-XXXXXX%s%s",
      tmpDir,
      safeTag,
      extLead,
      extension);

  if (n < 0 || (size_t)n >= outPathBytes) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "failed to build temporary file path");
    }
    return false;
  }

  errno = 0;
  const int fd = mkstemps(outPath, (int)suffixBytes);
  if (fd < 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail,
               detailBytes,
               "failed to create secure temporary file path: %s",
               strerror(errno));
    }
    return false;
  }

  // Caller owns the descriptor and must close it after use.
  *outFd = fd;

  return true;
}