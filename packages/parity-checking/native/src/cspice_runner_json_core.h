#ifndef CSPICE_RUNNER_JSON_CORE_H
#define CSPICE_RUNNER_JSON_CORE_H

#include "cspice_runner_common.h"

typedef enum {
  JSMN_UNDEFINED = 0,
  JSMN_OBJECT = 1,
  JSMN_ARRAY = 2,
  JSMN_STRING = 3,
  JSMN_PRIMITIVE = 4
} jsmntype_t;

typedef struct {
  jsmntype_t type;
  int start;
  int end;
  int size;
#ifdef JSMN_PARENT_LINKS
  int parent;
#endif
} jsmntok_t;

typedef struct {
  unsigned int pos;
  unsigned int toknext;
  int toksuper;
} jsmn_parser;

void jsmn_init(jsmn_parser *parser);
int jsmn_parse(jsmn_parser *parser, const char *js, const size_t len,
               jsmntok_t *tokens, const unsigned int num_tokens);

bool jsmn_token_streq(const char *json, const jsmntok_t *tok, const char *s);
int jsmn_object_pair_count(const jsmntok_t *t);
int jsmn_skip_subtree(const jsmntok_t *tokens, int index, int tokenCount);
int jsmn_find_object_key(const char *json, const jsmntok_t *tokens,
                         int objIndex, const char *key, int tokenCount);
int jsmn_get_array_elem(const jsmntok_t *tokens, int arrayIndex,
                        int elemIndex, int tokenCount);

typedef enum {
  JSMN_STRDUP_OK = 0,
  JSMN_STRDUP_OOM,
  JSMN_STRDUP_INVALID,
} jsmn_strdup_err_t;

jsmn_strdup_err_t jsmn_strdup(const char *json, const jsmntok_t *tok,
                              char **out, char *errDetail,
                              size_t errDetailBytes);

typedef enum {
  PARSE_OK = 0,
  PARSE_INVALID,
  PARSE_TOO_LONG,
  PARSE_OUT_OF_RANGE,
  PARSE_UNSUPPORTED,
} parse_result;

parse_result jsmn_parse_double(const char *json, const jsmntok_t *tok,
                               SpiceDouble *out);
parse_result jsmn_parse_int(const char *json, const jsmntok_t *tok,
                            SpiceInt *out);
bool jsmn_parse_double_array_fixed(const char *json, jsmntok_t *tokens,
                                   int arrayTok, int tokenCount,
                                   int expectedLen, SpiceDouble *out);
bool jsmn_parse_vec3(const char *json, jsmntok_t *tokens,
                     int vecTok, int tokenCount, SpiceDouble out[3]);
bool jsmn_parse_mat3_rowmajor(const char *json, jsmntok_t *tokens,
                              int matTok, int tokenCount,
                              SpiceDouble out[3][3]);

#endif
