#include "cspice_runner_json_core.h"
#include "cspice_runner_cells.h"

static bool safe_add_size_t(size_t a, size_t b, size_t *out) {
  if (a > SIZE_MAX - b) {
    return false;
  }
  *out = a + b;
  return true;
}

static bool safe_mul_size_t(size_t a, size_t b, size_t *out) {
  if (a != 0 && b > SIZE_MAX / a) {
    return false;
  }
  *out = a * b;
  return true;
}

static bool spiceint_to_size_t_checked(SpiceInt value, size_t *out) {
  if (value < 0) {
    return false;
  }

  if ((uintmax_t)value > (uintmax_t)SIZE_MAX) {
    return false;
  }

  *out = (size_t)value;
  return true;
}

bool parse_spiceint_arg(const char *input, const jsmntok_t *tokens,
                        int tokenCount, int tokIndex, const char *label,
                        SpiceInt *out, char *detail,
                        size_t detailBytes) {
  parse_result parsed = PARSE_INVALID;
  if (tokIndex >= 0 && tokIndex < tokenCount) {
    parsed = jsmn_parse_int(input, &tokens[tokIndex], out);
  }

  if (tokIndex >= 0 && tokIndex < tokenCount && parsed == PARSE_OK) {
    return true;
  }

  if (detail != NULL && detailBytes > 0) {
    if (parsed == PARSE_TOO_LONG) {
      snprintf(detail, detailBytes, "%s numeric literal too long", label);
    } else if (parsed == PARSE_UNSUPPORTED) {
      snprintf(detail, detailBytes,
               "%s requires supported SpiceInt width on this platform", label);
    } else {
      snprintf(detail, detailBytes, "%s must be an integer (SpiceInt range)",
               label);
    }
  }

  return false;
}

bool parse_cells_windows_recipe(const char *input,
                                       const jsmntok_t *tokens,
                                       int tokenCount,
                                       int recipeTok,
                                       RunnerCellRecipe *outRecipe,
                                       char *detail,
                                       size_t detailBytes) {
  if (recipeTok < 0 || recipeTok >= tokenCount ||
      tokens[recipeTok].type != JSMN_ARRAY) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "cell recipe must be a tuple array");
    }
    return false;
  }

  const int recipeLen = tokens[recipeTok].size;
  if (recipeLen < 2) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "cell recipe must have at least 2 elements");
    }
    return false;
  }

  const int kindTok = jsmn_get_array_elem(tokens, recipeTok, 0, tokenCount);
  if (kindTok < 0 || kindTok >= tokenCount ||
      tokens[kindTok].type != JSMN_STRING) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "cell recipe kind must be a string");
    }
    return false;
  }

  const bool isInt = jsmn_token_streq(input, &tokens[kindTok], "int");
  const bool isDouble = jsmn_token_streq(input, &tokens[kindTok], "double");
  const bool isChar = jsmn_token_streq(input, &tokens[kindTok], "char");
  const bool isWindow = jsmn_token_streq(input, &tokens[kindTok], "window");

  if (!isInt && !isDouble && !isChar && !isWindow) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(
          detail,
          detailBytes,
          "cell recipe kind must be one of \"int\", \"double\", \"char\", \"window\"");
    }
    return false;
  }

  if ((isInt || isDouble || isWindow) && recipeLen != 2) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "%s recipe expects exactly 2 elements",
               isInt ? "int" : (isDouble ? "double" : "window"));
    }
    return false;
  }

  if (isChar && recipeLen != 3) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char recipe expects exactly 3 elements [\"char\", size, length]");
    }
    return false;
  }

  const int sizeTok = jsmn_get_array_elem(tokens, recipeTok, 1, tokenCount);
  SpiceInt size = 0;
  if (!parse_spiceint_arg(input, tokens, tokenCount, sizeTok,
                          "cell recipe size", &size, detail,
                          detailBytes)) {
    return false;
  }

  if (size < 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes, "cell recipe size must be >= 0");
    }
    return false;
  }

  if (isInt) {
    outRecipe->kind = RUNNER_CELL_RECIPE_INT;
    outRecipe->size = size;
    outRecipe->length = 0;
    return true;
  }

  if (isDouble) {
    outRecipe->kind = RUNNER_CELL_RECIPE_DOUBLE;
    outRecipe->size = size;
    outRecipe->length = 0;
    return true;
  }

  if (isWindow) {
    outRecipe->kind = RUNNER_CELL_RECIPE_WINDOW;
    outRecipe->size = size;
    outRecipe->length = 0;
    return true;
  }

  const int lengthTok = jsmn_get_array_elem(tokens, recipeTok, 2, tokenCount);
  SpiceInt length = 0;
  if (!parse_spiceint_arg(input, tokens, tokenCount, lengthTok,
                          "cell recipe length", &length, detail,
                          detailBytes)) {
    return false;
  }

  if (length <= 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell recipe length must be > 0");
    }
    return false;
  }

  outRecipe->kind = RUNNER_CELL_RECIPE_CHAR;
  outRecipe->size = size;
  outRecipe->length = length;
  return true;
}

void runner_free_allocated_cell(SpiceCell *cell) {
  if (cell == NULL) {
    return;
  }

  free(cell->base);
  free(cell);
}

bool runner_alloc_int_cell(SpiceInt size, SpiceCell **outCell,
                                  char *detail, size_t detailBytes) {
  *outCell = NULL;

  size_t sizeElems = 0;
  if (!spiceint_to_size_t_checked(size, &sizeElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "int cell size is out of range for allocation");
    }
    return false;
  }

  size_t totalElems = 0;
  if (!safe_add_size_t((size_t)SPICE_CELL_CTRLSZ, sizeElems, &totalElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "int cell size causes allocation overflow");
    }
    return false;
  }

  SpiceCell *cell = (SpiceCell *)calloc(1, sizeof(SpiceCell));
  if (cell == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating int cell descriptor");
    }
    return false;
  }

  SpiceInt *base = (SpiceInt *)calloc(totalElems, sizeof(SpiceInt));
  if (base == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating int cell storage");
    }
    free(cell);
    return false;
  }

  cell->dtype = SPICE_INT;
  cell->length = 0;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + SPICE_CELL_CTRLSZ);

  ssize_c(size, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  scard_c(0, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  *outCell = cell;
  return true;
}

bool runner_alloc_double_cell(SpiceInt size, SpiceCell **outCell,
                                     char *detail, size_t detailBytes) {
  *outCell = NULL;

  size_t sizeElems = 0;
  if (!spiceint_to_size_t_checked(size, &sizeElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "double cell size is out of range for allocation");
    }
    return false;
  }

  size_t totalElems = 0;
  if (!safe_add_size_t((size_t)SPICE_CELL_CTRLSZ, sizeElems, &totalElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "double cell size causes allocation overflow");
    }
    return false;
  }

  SpiceCell *cell = (SpiceCell *)calloc(1, sizeof(SpiceCell));
  if (cell == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating double cell descriptor");
    }
    return false;
  }

  SpiceDouble *base = (SpiceDouble *)calloc(totalElems, sizeof(SpiceDouble));
  if (base == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating double cell storage");
    }
    free(cell);
    return false;
  }

  cell->dtype = SPICE_DP;
  cell->length = 0;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + SPICE_CELL_CTRLSZ);

  ssize_c(size, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  scard_c(0, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  *outCell = cell;
  return true;
}

bool runner_alloc_char_cell(SpiceInt size, SpiceInt length,
                                   SpiceCell **outCell,
                                   char *detail, size_t detailBytes) {
  *outCell = NULL;

  size_t sizeElems = 0;
  size_t lengthElems = 0;
  if (!spiceint_to_size_t_checked(size, &sizeElems)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell size is out of range for allocation");
    }
    return false;
  }
  if (!spiceint_to_size_t_checked(length, &lengthElems) || lengthElems == 0) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell length must be > 0 and in range");
    }
    return false;
  }

  size_t totalStrings = 0;
  if (!safe_add_size_t((size_t)SPICE_CELL_CTRLSZ, sizeElems, &totalStrings)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell size causes allocation overflow");
    }
    return false;
  }

  size_t totalChars = 0;
  if (!safe_mul_size_t(totalStrings, lengthElems, &totalChars)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell allocation overflows platform limits");
    }
    return false;
  }

  size_t controlChars = 0;
  if (!safe_mul_size_t((size_t)SPICE_CELL_CTRLSZ, lengthElems, &controlChars)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "char cell control allocation overflows platform limits");
    }
    return false;
  }

  SpiceCell *cell = (SpiceCell *)calloc(1, sizeof(SpiceCell));
  if (cell == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating char cell descriptor");
    }
    return false;
  }

  SpiceChar *base = (SpiceChar *)calloc(totalChars, sizeof(SpiceChar));
  if (base == NULL) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "out of memory while allocating char cell storage");
    }
    free(cell);
    return false;
  }

  cell->dtype = SPICE_CHR;
  cell->length = length;
  cell->size = 0;
  cell->card = 0;
  cell->isSet = SPICETRUE;
  cell->adjust = SPICEFALSE;
  cell->init = SPICEFALSE;
  cell->base = (void *)base;
  cell->data = (void *)(base + controlChars);

  ssize_c(size, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  scard_c(0, cell);
  if (failed_c() == SPICETRUE) {
    runner_free_allocated_cell(cell);
    return false;
  }

  *outCell = cell;
  return true;
}

bool runner_alloc_window_cell(SpiceInt maxIntervals,
                                     SpiceCell **outCell,
                                     char *detail,
                                     size_t detailBytes) {
  *outCell = NULL;

  size_t maxIntervalsSz = 0;
  if (!spiceint_to_size_t_checked(maxIntervals, &maxIntervalsSz)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "window maxIntervals is out of range for allocation");
    }
    return false;
  }

  size_t endpointsSz = 0;
  if (!safe_mul_size_t(maxIntervalsSz, 2u, &endpointsSz)) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "window maxIntervals causes allocation overflow");
    }
    return false;
  }

  SpiceInt endpoints = (SpiceInt)endpointsSz;
  if ((size_t)endpoints != endpointsSz) {
    if (detail != NULL && detailBytes > 0) {
      snprintf(detail, detailBytes,
               "window maxIntervals exceeds SpiceInt range");
    }
    return false;
  }

  return runner_alloc_double_cell(endpoints, outCell, detail, detailBytes);
}

bool runner_alloc_cell_from_recipe(const RunnerCellRecipe *recipe,
                                          SpiceCell **outCell,
                                          bool *outIsWindow,
                                          char *detail,
                                          size_t detailBytes) {
  *outCell = NULL;
  *outIsWindow = false;

  switch (recipe->kind) {
  case RUNNER_CELL_RECIPE_INT:
    return runner_alloc_int_cell(recipe->size, outCell, detail, detailBytes);
  case RUNNER_CELL_RECIPE_DOUBLE:
    return runner_alloc_double_cell(recipe->size, outCell, detail, detailBytes);
  case RUNNER_CELL_RECIPE_CHAR:
    return runner_alloc_char_cell(recipe->size, recipe->length,
                                  outCell, detail, detailBytes);
  case RUNNER_CELL_RECIPE_WINDOW:
    *outIsWindow = true;
    return runner_alloc_window_cell(recipe->size, outCell, detail, detailBytes);
  }

  if (detail != NULL && detailBytes > 0) {
    snprintf(detail, detailBytes, "unsupported cell recipe kind");
  }
  return false;
}
