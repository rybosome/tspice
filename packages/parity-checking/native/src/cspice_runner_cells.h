#ifndef CSPICE_RUNNER_CELLS_H
#define CSPICE_RUNNER_CELLS_H

#include "cspice_runner_common.h"
#include "cspice_runner_json_core.h"

typedef enum {
  RUNNER_CELL_RECIPE_INT = 0,
  RUNNER_CELL_RECIPE_DOUBLE,
  RUNNER_CELL_RECIPE_CHAR,
  RUNNER_CELL_RECIPE_WINDOW,
} RunnerCellRecipeKind;

typedef struct {
  RunnerCellRecipeKind kind;
  // For int/double/char: cell size. For window: maxIntervals.
  SpiceInt size;
  // Only used by char recipes.
  SpiceInt length;
} RunnerCellRecipe;

bool parse_spiceint_arg(const char *input, const jsmntok_t *tokens,
                        int tokenCount, int tokIndex, const char *label,
                        SpiceInt *out, char *detail,
                        size_t detailBytes);

bool parse_cells_windows_recipe(const char *input, const jsmntok_t *tokens,
                                int tokenCount, int recipeTok,
                                RunnerCellRecipe *outRecipe,
                                char *detail, size_t detailBytes);

bool runner_alloc_int_cell(SpiceInt size, SpiceCell **outCell,
                           char *detail, size_t detailBytes);
bool runner_alloc_double_cell(SpiceInt size, SpiceCell **outCell,
                              char *detail, size_t detailBytes);
bool runner_alloc_char_cell(SpiceInt size, SpiceInt length,
                            SpiceCell **outCell,
                            char *detail, size_t detailBytes);
bool runner_alloc_window_cell(SpiceInt maxIntervals,
                              SpiceCell **outCell,
                              char *detail,
                              size_t detailBytes);
bool runner_alloc_cell_from_recipe(const RunnerCellRecipe *recipe,
                                   SpiceCell **outCell,
                                   bool *outIsWindow,
                                   char *detail,
                                   size_t detailBytes);
void runner_free_allocated_cell(SpiceCell *cell);

#endif
