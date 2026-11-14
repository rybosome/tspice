#include "ek.h"

#include <algorithm>
#include <cstring>
#include <string>
#include <string_view>
#include <vector>
#include <cmath>
#include <cstdint>
#include <limits>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::FixedWidthToJsString;
using tspice_napi::ReadStringArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;
using tspice_napi::TrimAsciiWhitespace;

namespace {

constexpr uint32_t kMaxEkArrayLen = 1'000'000;
// CSPICE N0067: SPICE_EK_MXCLSG in SpiceEK.h.
constexpr uint32_t kMaxEkColumns = 100;
// Keep parity with backend-wasm `kMaxEkVallenBytes` / `WASM_MAX_ALLOC_BYTES`.
constexpr size_t kMaxEkVallenBytes = 1'000'000;
constexpr size_t kMaxEkBufferBytes = 256ull * 1024ull * 1024ull; // 256 MiB

static bool ReadInt32Checked(Napi::Env env, const Napi::Value& value, const char* what, int32_t* out) {
  const std::string label = (what != nullptr && what[0] != '\0') ? std::string(what) : std::string("value");

  if (!value.IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be a number"));
    return false;
  }

  const double d = value.As<Napi::Number>().DoubleValue();
  const double lo = (double)std::numeric_limits<int32_t>::min();
  const double hi = (double)std::numeric_limits<int32_t>::max();
  if (!std::isfinite(d) || std::floor(d) != d || d < lo || d > hi) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be a 32-bit signed integer"));
    return false;
  }

  if (out) {
    *out = (int32_t)d;
  }
  return true;
}

Napi::Array MakeIntArray(Napi::Env env, const int* values, size_t count) {
  Napi::Array arr = Napi::Array::New(env, count);
  for (size_t i = 0; i < count; i++) {
    arr.Set(i, Napi::Number::New(env, static_cast<double>(values[i])));
  }
  return arr;
}

inline bool ValidateNonEmptyString(
    Napi::Env env,
    const char* fn,
    const char* field,
    std::string_view value) {
  const std::string trimmed = TrimAsciiWhitespace(value);
  if (!trimmed.empty()) {
    return true;
  }

  const char* safeFn = (fn != nullptr) ? fn : "<unknown>";
  const char* safeField = (field != nullptr) ? field : "<unknown>";

  ThrowSpiceError(Napi::RangeError::New(
      env,
      std::string(safeFn) + "(): " + safeField + " must be a non-empty string"));
  return false;
}

static bool ReadInt32ArrayChecked(
    Napi::Env env,
    const Napi::Value& value,
    const char* what,
    std::vector<int>& out) {
  const std::string label = (what != nullptr && what[0] != '\0') ? std::string(what) : std::string("array");

  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be an array"));
    return false;
  }

  Napi::Array arr = value.As<Napi::Array>();
  const uint32_t len = arr.Length();
  if (len > kMaxEkArrayLen) {
    ThrowSpiceError(Napi::RangeError::New(
        env,
        std::string("Expected ") + label + " length <= " + std::to_string(kMaxEkArrayLen)));
    return false;
  }

  std::vector<int> tmp;
  tmp.reserve(len);
  for (uint32_t i = 0; i < len; i++) {
    int32_t v = 0;
    if (!ReadInt32Checked(env, arr.Get(i), label.c_str(), &v)) {
      return false;
    }
    tmp.push_back((int)v);
  }

  out.swap(tmp);
  return true;
}

static bool ReadDoubleArrayChecked(
    Napi::Env env,
    const Napi::Value& value,
    const char* what,
    std::vector<double>& out) {
  const std::string label = (what != nullptr && what[0] != '\0') ? std::string(what) : std::string("array");

  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be an array"));
    return false;
  }

  Napi::Array arr = value.As<Napi::Array>();
  const uint32_t len = arr.Length();
  if (len > kMaxEkArrayLen) {
    ThrowSpiceError(Napi::RangeError::New(
        env,
        std::string("Expected ") + label + " length <= " + std::to_string(kMaxEkArrayLen)));
    return false;
  }

  std::vector<double> tmp;
  tmp.reserve(len);
  for (uint32_t i = 0; i < len; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to contain only numbers"));
      return false;
    }
    const double d = v.As<Napi::Number>().DoubleValue();
    if (!std::isfinite(d)) {
      ThrowSpiceError(Napi::RangeError::New(env, std::string("Expected ") + label + " values to be finite"));
      return false;
    }
    tmp.push_back(d);
  }

  out.swap(tmp);
  return true;
}

static bool ReadBoolArrayChecked(
    Napi::Env env,
    const Napi::Value& value,
    const char* what,
    std::vector<int>& out01) {
  const std::string label = (what != nullptr && what[0] != '\0') ? std::string(what) : std::string("array");

  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to be an array"));
    return false;
  }

  Napi::Array arr = value.As<Napi::Array>();
  const uint32_t len = arr.Length();
  if (len > kMaxEkArrayLen) {
    ThrowSpiceError(Napi::RangeError::New(
        env,
        std::string("Expected ") + label + " length <= " + std::to_string(kMaxEkArrayLen)));
    return false;
  }

  std::vector<int> tmp;
  tmp.reserve(len);
  for (uint32_t i = 0; i < len; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsBoolean()) {
      ThrowSpiceError(Napi::TypeError::New(env, std::string("Expected ") + label + " to contain only booleans"));
      return false;
    }
    tmp.push_back(v.As<Napi::Boolean>().Value() ? 1 : 0);
  }

  out01.swap(tmp);
  return true;
}

static bool SumEntszsChecked(
    const std::vector<int>& entszs,
    const std::vector<int>& nlflgs,
    int* outSum,
    std::string* outErr) {
  if (!outSum) return false;
  *outSum = 0;

  if (entszs.size() != nlflgs.size()) {
    if (outErr) *outErr = "expected entszs.length === nlflgs.length";
    return false;
  }

  long long sum = 0;
  for (size_t i = 0; i < entszs.size(); i++) {
    const int sz = entszs[i];
    const int isNull = nlflgs[i];
    if (isNull != 0 && isNull != 1) {
      if (outErr) *outErr = "expected nlflgs to contain only booleans";
      return false;
    }

    // Keep parity with the backend shim (CSPICE semantics):
    // - NULL entries may have entszs[i] == 0 (and are allowed to be any value >= 0)
    // - non-NULL entries must have entszs[i] >= 1
    if (isNull == 1) {
      if (sz < 0) {
        if (outErr) *outErr = std::string("expected entszs[") + std::to_string(i) + "] >= 0 when nlflgs[i] is true";
        return false;
      }
    } else {
      if (sz < 1) {
        if (outErr) *outErr = std::string("expected entszs[") + std::to_string(i) + "] >= 1 when nlflgs[i] is false";
        return false;
      }
    }

    sum += (long long)sz;
    if (sum > (long long)std::numeric_limits<int>::max()) {
      if (outErr) *outErr = "sum(entszs) overflow";
      return false;
    }
    if (sum > (long long)kMaxEkArrayLen) {
      if (outErr) *outErr = std::string("sum(entszs) must be <= ") + std::to_string(kMaxEkArrayLen);
      return false;
    }
  }

  *outSum = (int)sum;
  return true;
}

}  // namespace

namespace tspice_backend_node {

static Napi::Number Ekopr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekopr(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_ekopr(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling ekopr(\"") + path + "\")",
        err,
        "ekopr",
        [&](Napi::Object& obj) { obj.Set("path", Napi::String::New(env, path)); });
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static Napi::Number Ekopw(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekopw(path: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_ekopw(path.c_str(), &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling ekopw(\"") + path + "\")",
        err,
        "ekopw",
        [&](Napi::Object& obj) { obj.Set("path", Napi::String::New(env, path)); });
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static Napi::Number Ekopn(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekopn(path: string, ifname: string, ncomch: number) expects (string, string, number)"));
    return Napi::Number::New(env, 0);
  }

  int32_t ncomch = 0;
  if (!ReadInt32Checked(env, info[2], "ncomch", &ncomch)) {
    return Napi::Number::New(env, 0);
  }

  if (ncomch < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected ncomch to be >= 0"));
    return Napi::Number::New(env, 0);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();
  const std::string ifname = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int handle = 0;
  const int code = tspice_ekopn(path.c_str(), ifname.c_str(), ncomch, &handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling ekopn(\"") + path + "\")",
        err,
        "ekopn",
        [&](Napi::Object& obj) {
          obj.Set("path", Napi::String::New(env, path));
          obj.Set("ifname", Napi::String::New(env, ifname));
          obj.Set("ncomch", Napi::Number::New(env, (double)ncomch));
        });
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)handle);
}

static void Ekcls(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekcls(handle: number) expects exactly one numeric handle"));
    return;
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ekcls(handle, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling ekcls(handle=") + std::to_string(handle) + ")",
        err,
        "ekcls",
        [&](Napi::Object& obj) { obj.Set("handle", Napi::Number::New(env, (double)handle)); });
  }
}

static Napi::Number Ekntab(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekntab() does not take any arguments"));
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int n = 0;
  const int code = tspice_ekntab(&n, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ekntab()", err, "ekntab");
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)n);
}

static Napi::String Ektnam(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "ektnam(n: number) expects exactly one numeric index"));
    return Napi::String::New(env, "");
  }

  int32_t n = 0;
  if (!ReadInt32Checked(env, info[0], "n", &n)) {
    return Napi::String::New(env, "");
  }

  if (n < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected n to be >= 0"));
    return Napi::String::New(env, "");
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];

  const int code = tspice_ektnam(n, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling ektnam(n=") + std::to_string(n) + ")",
        err,
        "ektnam",
        [&](Napi::Object& obj) { obj.Set("n", Napi::Number::New(env, (double)n)); });
    return Napi::String::New(env, "");
  }

  return FixedWidthToJsString(env, out, sizeof(out));
}

static Napi::Number Eknseg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "eknseg(handle: number) expects exactly one numeric handle"));
    return Napi::Number::New(env, 0);
  }

  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int nseg = 0;
  const int code = tspice_eknseg(handle, &nseg, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling eknseg(handle=") + std::to_string(handle) + ")",
        err,
        "eknseg",
        [&](Napi::Object& obj) { obj.Set("handle", Napi::Number::New(env, (double)handle)); });
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)nseg);
}

static Napi::Object Ekfind(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekfind(query: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string query = info[0].As<Napi::String>().Utf8Value();
  if (!ValidateNonEmptyString(env, "ekfind", "query", query)) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char errmsg[tspice_backend_node::kOutMaxBytes];
  int nmrows = 0;
  int qerr = 0;

  const int code = tspice_ekfind(
      query.c_str(),
      (int)sizeof(errmsg),
      &nmrows,
      &qerr,
      errmsg,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(
        env,
        "CSPICE failed while calling ekfind(query)",
        err,
        "ekfind",
        [&](Napi::Object& obj) { obj.Set("query", Napi::String::New(env, query)); });
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  if (qerr != 0) {
    result.Set("ok", Napi::Boolean::New(env, false));
    result.Set("errmsg", Napi::String::New(env, TrimAsciiWhitespace(errmsg)));
  } else {
    result.Set("ok", Napi::Boolean::New(env, true));
    result.Set("nmrows", Napi::Number::New(env, (double)nmrows));
  }

  return result;
}

static Napi::Object Ekgc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekgc(selidx: number, row: number, elment: number) expects exactly three numeric arguments"));
    return Napi::Object::New(env);
  }

  int32_t selidx = 0;
  int32_t row = 0;
  int32_t elment = 0;
  if (!ReadInt32Checked(env, info[0], "selidx", &selidx)) return Napi::Object::New(env);
  if (!ReadInt32Checked(env, info[1], "row", &row)) return Napi::Object::New(env);
  if (!ReadInt32Checked(env, info[2], "elment", &elment)) return Napi::Object::New(env);

  if (selidx < 0 || row < 0 || elment < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekgc() expects selidx/row/elment to be >= 0"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  int isNull = 0;
  int found = 0;

  const int code = tspice_ekgc(
      selidx,
      row,
      elment,
      out,
      (int)sizeof(out),
      &isNull,
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(
        env,
        "CSPICE failed while calling ekgc(selidx,row,elment)",
        err,
        "ekgc",
        [&](Napi::Object& obj) {
          obj.Set("selidx", Napi::Number::New(env, (double)selidx));
          obj.Set("row", Napi::Number::New(env, (double)row));
          obj.Set("elment", Napi::Number::New(env, (double)elment));
        });
    return Napi::Object::New(env);
  }

  if (!found) {
    return tspice_napi::MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  if (isNull) {
    result.Set("isNull", Napi::Boolean::New(env, true));
    return result;
  }

  result.Set("isNull", Napi::Boolean::New(env, false));
  result.Set("value", FixedWidthToJsString(env, out, sizeof(out)));
  return result;
}

static Napi::Object Ekgd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekgd(selidx: number, row: number, elment: number) expects exactly three numeric arguments"));
    return Napi::Object::New(env);
  }

  int32_t selidx = 0;
  int32_t row = 0;
  int32_t elment = 0;
  if (!ReadInt32Checked(env, info[0], "selidx", &selidx)) return Napi::Object::New(env);
  if (!ReadInt32Checked(env, info[1], "row", &row)) return Napi::Object::New(env);
  if (!ReadInt32Checked(env, info[2], "elment", &elment)) return Napi::Object::New(env);

  if (selidx < 0 || row < 0 || elment < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekgd() expects selidx/row/elment to be >= 0"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0;
  int isNull = 0;
  int found = 0;

  const int code = tspice_ekgd(selidx, row, elment, &out, &isNull, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        "CSPICE failed while calling ekgd(selidx,row,elment)",
        err,
        "ekgd",
        [&](Napi::Object& obj) {
          obj.Set("selidx", Napi::Number::New(env, (double)selidx));
          obj.Set("row", Napi::Number::New(env, (double)row));
          obj.Set("elment", Napi::Number::New(env, (double)elment));
        });
    return Napi::Object::New(env);
  }

  if (!found) {
    return tspice_napi::MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  if (isNull) {
    result.Set("isNull", Napi::Boolean::New(env, true));
    return result;
  }

  result.Set("isNull", Napi::Boolean::New(env, false));
  result.Set("value", Napi::Number::New(env, out));
  return result;
}

static Napi::Object Ekgi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekgi(selidx: number, row: number, elment: number) expects exactly three numeric arguments"));
    return Napi::Object::New(env);
  }

  int32_t selidx = 0;
  int32_t row = 0;
  int32_t elment = 0;
  if (!ReadInt32Checked(env, info[0], "selidx", &selidx)) return Napi::Object::New(env);
  if (!ReadInt32Checked(env, info[1], "row", &row)) return Napi::Object::New(env);
  if (!ReadInt32Checked(env, info[2], "elment", &elment)) return Napi::Object::New(env);

  if (selidx < 0 || row < 0 || elment < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekgi() expects selidx/row/elment to be >= 0"));
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  int isNull = 0;
  int found = 0;

  const int code = tspice_ekgi(selidx, row, elment, &out, &isNull, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        "CSPICE failed while calling ekgi(selidx,row,elment)",
        err,
        "ekgi",
        [&](Napi::Object& obj) {
          obj.Set("selidx", Napi::Number::New(env, (double)selidx));
          obj.Set("row", Napi::Number::New(env, (double)row));
          obj.Set("elment", Napi::Number::New(env, (double)elment));
        });
    return Napi::Object::New(env);
  }

  if (!found) {
    return tspice_napi::MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  if (isNull) {
    result.Set("isNull", Napi::Boolean::New(env, true));
    return result;
  }

  result.Set("isNull", Napi::Boolean::New(env, false));
  result.Set("value", Napi::Number::New(env, (double)out));
  return result;
}


using EntryWriter = int (*)(int, int, int, const char *, int, int, const void *, int, char *, int);
using EntryReader = int (*)(int, int, int, const char *, int, void *, int, int *, int *, char *,
                            int);

static bool EntryArgs(const Napi::CallbackInfo &info, size_t argc, int *h, int *s, int *r,
                      std::string &column) {
  auto env = info.Env();
  if (info.Length() != argc || !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid EK entry arguments or column"));
    return false;
  }
  if (!ReadInt32Checked(env, info[0], "handle", h) ||
      !ReadInt32Checked(env, info[1], "segment", s) || !ReadInt32Checked(env, info[2], "record", r))
    return false;
  column = info[3].As<Napi::String>().Utf8Value();
  if (column.size() >= kMaxEkBufferBytes || column.find('\0') != std::string::npos) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid EK column bytes"));
    return false;
  }
  return true;
}

static Napi::Value WriteEntry(const Napi::CallbackInfo &info, const char *name, int kind,
                              EntryWriter write) {
  auto env = info.Env();
  int h, s, r, count, width;
  std::string col;
  if (!EntryArgs(info, 8, &h, &s, &r, col) || !ReadInt32Checked(env, info[4], "count", &count) ||
      !ReadInt32Checked(env, info[5], "width", &width))
    return env.Undefined();
  if (!info[6].IsTypedArray() ||
      info[6].As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array || !info[7].IsBoolean()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "Expected packed EK entry bytes and a boolean null flag"));
    return env.Undefined();
  }
  auto input = info[6].As<Napi::Uint8Array>();
  bool isNull = info[7].As<Napi::Boolean>().Value();
  if (count < 0 || width < 1 || (kind == 1 ? width < 2 : width != (kind == 2 ? 8 : 4)) ||
      static_cast<size_t>(count) > kMaxEkBufferBytes / static_cast<size_t>(width) ||
      input.ByteLength() != static_cast<size_t>(count) * width) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid EK input storage dimensions"));
    return env.Undefined();
  }
  // An addon caller may supply an unaligned byte slice. Take a privately
  // owned naturally aligned copy, including valid storage for a zero count.
  auto owned = Napi::ArrayBuffer::New(env, std::max<size_t>(8, input.ByteLength()));
  if (input.ByteLength())
    std::memcpy(owned.Data(), input.Data(), input.ByteLength());
  char err[tspice_backend_node::kErrMaxBytes] = {};
  tspice_backend_node::CspiceLock lock;
  if (write(h, s, r, col.c_str(), count, width, owned.Data(), isNull, err, sizeof(err)))
    ThrowSpiceError(env, name, err, name);
  return env.Undefined();
}

static Napi::Value ReadEntry(const Napi::CallbackInfo &info, const char *name, int kind,
                             EntryReader read) {
  auto env = info.Env();
  int h, s, r, width;
  std::string col;
  if (!EntryArgs(info, 5, &h, &s, &r, col) || !ReadInt32Checked(env, info[4], "width", &width))
    return env.Undefined();
  if (kind != 1 && width != (kind == 2 ? 8 : 4)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid EK numeric width"));
    return env.Undefined();
  }
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int extent = 0, n = 0, isNull = 0;
  tspice_backend_node::CspiceLock lock;
  if (tspice_ek_entry_extent(h, s, r, col.c_str(), kind, width, &extent, err, sizeof(err))) {
    ThrowSpiceError(env, name, err, name);
    return env.Undefined();
  }
  size_t bytes = static_cast<size_t>(width) * extent;
  auto owned = Napi::Uint8Array::New(env, bytes);
  if (read(h, s, r, col.c_str(), width, owned.Data(), extent, &n, &isNull, err, sizeof(err))) {
    ThrowSpiceError(env, name, err, name);
    return env.Undefined();
  }
  auto result = Napi::Object::New(env);
  result.Set("nvals", n);
  result.Set("isNull", isNull != 0);
  result.Set("bytes", isNull ? Napi::Uint8Array::New(env, 0) : owned);
  return result;
}

static Napi::Value Ekacec(const Napi::CallbackInfo &info) {
  return WriteEntry(info, "ekacec", 1,
                    [](int h, int s, int r, const char *col, int n, int width, const void *v,
                       int null, char *err, int size) {
                      return tspice_ekacec(h, s, r, col, n, width, static_cast<const char *>(v),
                                           null, err, size);
                    });
}
static Napi::Value Ekaced(const Napi::CallbackInfo &info) {
  return WriteEntry(info, "ekaced", 2,
                    [](int h, int s, int r, const char *col, int n, int, const void *v, int null,
                       char *err, int size) {
                      return tspice_ekaced(h, s, r, col, n, static_cast<const double *>(v), null,
                                           err, size);
                    });
}
static Napi::Value Ekacei(const Napi::CallbackInfo &info) {
  return WriteEntry(info, "ekacei", 3,
                    [](int h, int s, int r, const char *col, int n, int, const void *v, int null,
                       char *err, int size) {
                      return tspice_ekacei(h, s, r, col, n, static_cast<const int *>(v), null, err,
                                           size);
                    });
}
static Napi::Value Ekrcec(const Napi::CallbackInfo &info) {
  return ReadEntry(info, "ekrcec", 1,
                   [](int h, int s, int r, const char *col, int width, void *v, int cap, int *n,
                      int *null, char *err, int size) {
                     return tspice_ekrcec(h, s, r, col, width, static_cast<char *>(v), cap, n, null,
                                          err, size);
                   });
}
static Napi::Value Ekrced(const Napi::CallbackInfo &info) {
  return ReadEntry(info, "ekrced", 2,
                   [](int h, int s, int r, const char *col, int, void *v, int cap, int *n,
                      int *null, char *err, int size) {
                     return tspice_ekrced(h, s, r, col, static_cast<double *>(v), cap, n, null, err,
                                          size);
                   });
}
static Napi::Value Ekrcei(const Napi::CallbackInfo &info) {
  return ReadEntry(info, "ekrcei", 3,
                   [](int h, int s, int r, const char *col, int, void *v, int cap, int *n,
                      int *null, char *err, int size) {
                     return tspice_ekrcei(h, s, r, col, static_cast<int *>(v), cap, n, null, err,
                                          size);
                   });
}
static Napi::Value Ekucec(const Napi::CallbackInfo &info) {
  return WriteEntry(info, "ekucec", 1,
                    [](int h, int s, int r, const char *col, int n, int width, const void *v,
                       int null, char *err, int size) {
                      return tspice_ekucec(h, s, r, col, n, width, static_cast<const char *>(v),
                                           null, err, size);
                    });
}
static Napi::Value Ekuced(const Napi::CallbackInfo &info) {
  return WriteEntry(info, "ekuced", 2,
                    [](int h, int s, int r, const char *col, int n, int, const void *v, int null,
                       char *err, int size) {
                      return tspice_ekuced(h, s, r, col, n, static_cast<const double *>(v), null,
                                           err, size);
                    });
}
static Napi::Value Ekucei(const Napi::CallbackInfo &info) {
  return WriteEntry(info, "ekucei", 3,
                    [](int h, int s, int r, const char *col, int n, int, const void *v, int null,
                       char *err, int size) {
                      return tspice_ekucei(h, s, r, col, n, static_cast<const int *>(v), null, err,
                                           size);
                    });
}

static Napi::Value Ekops(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekops: invalid argument count"));
    return env.Undefined();
  }
  int result = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_ekops(&result, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ekops", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, result);
}

static Napi::Value Ekbseg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 7) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekbseg: invalid argument count"));
    return env.Undefined();
  }
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  if (!info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected EK table name"));
    return env.Undefined();
  }
  std::string table = info[1].As<Napi::String>().Utf8Value();
  if (table.size() >= kMaxEkBufferBytes || table.find('\0') != std::string::npos) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid EK table name bytes"));
    return env.Undefined();
  }
  int32_t count = 0;
  if (!ReadInt32Checked(env, info[2], "count", &count)) return env.Undefined();
  int32_t nameWidth = 0;
  if (!ReadInt32Checked(env, info[3], "nameWidth", &nameWidth)) return env.Undefined();
  if (!info[4].IsTypedArray() || info[4].As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected fixed-width EK schema bytes"));
    return env.Undefined();
  }
  auto names = info[4].As<Napi::Uint8Array>();
  if (count < 1 || count > static_cast<int>(kMaxEkColumns) || nameWidth < 2 ||
      static_cast<size_t>(nameWidth) > kMaxEkBufferBytes/static_cast<size_t>(count) ||
      names.ElementLength() != static_cast<size_t>(count)*static_cast<size_t>(nameWidth)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid EK schema buffer dimensions"));
    return env.Undefined();
  }
  int32_t declWidth = 0;
  if (!ReadInt32Checked(env, info[5], "declWidth", &declWidth)) return env.Undefined();
  if (!info[6].IsTypedArray() || info[6].As<Napi::TypedArray>().TypedArrayType() != napi_uint8_array) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected fixed-width EK schema bytes"));
    return env.Undefined();
  }
  auto decls = info[6].As<Napi::Uint8Array>();
  if (count < 1 || count > static_cast<int>(kMaxEkColumns) || declWidth < 2 ||
      static_cast<size_t>(declWidth) > kMaxEkBufferBytes/static_cast<size_t>(count) ||
      decls.ElementLength() != static_cast<size_t>(count)*static_cast<size_t>(declWidth)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid EK schema buffer dimensions"));
    return env.Undefined();
  }
  const std::vector<char> nameRows(names.Data(), names.Data() + names.ElementLength());
  const std::vector<char> declRows(decls.Data(), decls.Data() + decls.ElementLength());
  int result = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_ekbseg(handle, table.c_str(), count, nameWidth, nameRows.data(), declWidth, declRows.data(), &result, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ekbseg", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, result);
}

static Napi::Value Ekappr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekappr: invalid argument count"));
    return env.Undefined();
  }
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t segment = 0;
  if (!ReadInt32Checked(env, info[1], "segment", &segment)) return env.Undefined();
  int result = 0;
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_ekappr(handle, segment, &result, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ekappr", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, result);
}

static Napi::Value Ekinsr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekinsr: invalid argument count"));
    return env.Undefined();
  }
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t segment = 0;
  if (!ReadInt32Checked(env, info[1], "segment", &segment)) return env.Undefined();
  int32_t row = 0;
  if (!ReadInt32Checked(env, info[2], "row", &row)) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_ekinsr(handle, segment, row, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ekinsr", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Ekdelr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekdelr: invalid argument count"));
    return env.Undefined();
  }
  int32_t handle = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return env.Undefined();
  int32_t segment = 0;
  if (!ReadInt32Checked(env, info[1], "segment", &segment)) return env.Undefined();
  int32_t row = 0;
  if (!ReadInt32Checked(env, info[2], "row", &row)) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes] = {0};
  tspice_backend_node::CspiceLock lock;
  if (tspice_ekdelr(handle, segment, row, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling ekdelr", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Object Ekifld(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekifld(handle: number, tabnam: string, nrows: number, cnames: string[], decls: string[]) expects (number, string, number, string[], string[])"));
    return Napi::Object::New(env);
  }

  int32_t handle = 0;
  int32_t nrows = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return Napi::Object::New(env);
  if (!ReadInt32Checked(env, info[2], "nrows", &nrows)) return Napi::Object::New(env);

  if (nrows <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekifld() expects nrows > 0"));
    return Napi::Object::New(env);
  }
  if ((uint32_t)nrows > kMaxEkArrayLen) {
    ThrowSpiceError(Napi::RangeError::New(
        env,
        std::string("ekifld() expects nrows <= ") + std::to_string(kMaxEkArrayLen)));
    return Napi::Object::New(env);
  }

  const std::string tabnam = info[1].As<Napi::String>().Utf8Value();
  if (!ValidateNonEmptyString(env, "ekifld", "tabnam", tabnam)) {
    return Napi::Object::New(env);
  }

  // Validate counts before converting strings or allocating padded arrays.
  if (!info[3].IsArray() || !info[4].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ekifld() expects string arrays for cnames and decls"));
    return Napi::Object::New(env);
  }
  const uint32_t nameCount = info[3].As<Napi::Array>().Length();
  const uint32_t declCount = info[4].As<Napi::Array>().Length();
  if (nameCount == 0 || nameCount > kMaxEkColumns || declCount != nameCount) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekifld() expects 1..100 columns and matching declarations"));
    return Napi::Object::New(env);
  }

  tspice_napi::JsStringArrayArg cnames;
  tspice_napi::JsStringArrayArg decls;
  if (!ReadStringArray(env, info[3], &cnames, "cnames")) return Napi::Object::New(env);
  if (!ReadStringArray(env, info[4], &decls, "decls")) return Napi::Object::New(env);

  if (cnames.values.empty()) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekifld() expects cnames.length > 0"));
    return Napi::Object::New(env);
  }
  if (decls.values.size() != cnames.values.size()) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekifld() expects decls.length === cnames.length"));
    return Napi::Object::New(env);
  }

  const size_t ncols = cnames.values.size();

  size_t cnamln = 2;
  size_t declen = 2;
  for (size_t i = 0; i < ncols; i++) {
    if (!ValidateNonEmptyString(env, "ekifld", "cnames[i]", cnames.values[i])) {
      return Napi::Object::New(env);
    }
    if (!ValidateNonEmptyString(env, "ekifld", "decls[i]", decls.values[i])) {
      return Napi::Object::New(env);
    }
    cnamln = std::max(cnamln, cnames.values[i].size() + 1);
    declen = std::max(declen, decls.values[i].size() + 1);
  }

  // Match the WASM codec allocation cap; division avoids product overflow.
  if (ncols > kMaxEkBufferBytes / cnamln || ncols > kMaxEkBufferBytes / declen) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekifld() padded string buffer exceeds allocation cap"));
    return Napi::Object::New(env);
  }

  std::vector<char> cnamesBuf(ncols * cnamln);
  std::vector<char> declsBuf(ncols * declen);
  std::fill(cnamesBuf.begin(), cnamesBuf.end(), '\0');
  std::fill(declsBuf.begin(), declsBuf.end(), '\0');

  for (size_t i = 0; i < ncols; i++) {
    const std::string& name = cnames.values[i];
    memcpy(&cnamesBuf[i * cnamln], name.data(), name.size());
    cnamesBuf[i * cnamln + std::min(name.size(), cnamln - 1)] = '\0';

    const std::string& decl = decls.values[i];
    memcpy(&declsBuf[i * declen], decl.data(), decl.size());
    declsBuf[i * declen + std::min(decl.size(), declen - 1)] = '\0';
  }

  std::vector<int> rcptrs(static_cast<size_t>(nrows));
  int segno = 0;

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ekifld(
      handle,
      tabnam.c_str(),
      (int)ncols,
      nrows,
      (int)cnamln,
      cnamesBuf.data(),
      (int)declen,
      declsBuf.data(),
      &segno,
      rcptrs.data(),
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ekifld()", err, "ekifld");
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("segno", Napi::Number::New(env, (double)segno));
  result.Set("rcptrs", MakeIntArray(env, rcptrs.data(), rcptrs.size()));
  return result;
}

static void Ekacli(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 7 || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekacli(handle: number, segno: number, column: string, ivals: number[], entszs: number[], nlflgs: boolean[], rcptrs: number[]) expects (number, number, string, number[], number[], boolean[], number[])"));
    return;
  }

  int32_t handle = 0;
  int32_t segno = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return;
  if (!ReadInt32Checked(env, info[1], "segno", &segno)) return;
  if (segno < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekacli() expects segno >= 0"));
    return;
  }

  const std::string column = info[2].As<Napi::String>().Utf8Value();
  if (!ValidateNonEmptyString(env, "ekacli", "column", column)) {
    return;
  }

  std::vector<int> ivals;
  std::vector<int> entszs;
  std::vector<int> nlflgs;
  std::vector<int> rcptrs;

  if (!ReadInt32ArrayChecked(env, info[3], "ivals", ivals)) return;
  if (!ReadInt32ArrayChecked(env, info[4], "entszs", entszs)) return;
  if (!ReadBoolArrayChecked(env, info[5], "nlflgs", nlflgs)) return;
  if (!ReadInt32ArrayChecked(env, info[6], "rcptrs", rcptrs)) return;

  if (entszs.size() != rcptrs.size() || nlflgs.size() != rcptrs.size()) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekacli() expects entszs/nlflgs/rcptrs to have the same length"));
    return;
  }

  int required = 0;
  std::string sumErr;
  if (!SumEntszsChecked(entszs, nlflgs, &required, &sumErr)) {
    ThrowSpiceError(Napi::RangeError::New(env, std::string("ekacli() invalid entszs/nlflgs: ") + sumErr));
    return;
  }
  if ((int)ivals.size() != required) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekacli() expects ivals.length === sum(entszs)"));
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ekacli(
      handle,
      segno,
      column.c_str(),
      (int)rcptrs.size(),
      ivals.data(),
      (int)ivals.size(),
      entszs.data(),
      nlflgs.data(),
      rcptrs.data(),
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ekacli()", err, "ekacli");
  }
}

static void Ekacld(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 7 || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekacld(handle: number, segno: number, column: string, dvals: number[], entszs: number[], nlflgs: boolean[], rcptrs: number[]) expects (number, number, string, number[], number[], boolean[], number[])"));
    return;
  }

  int32_t handle = 0;
  int32_t segno = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return;
  if (!ReadInt32Checked(env, info[1], "segno", &segno)) return;
  if (segno < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekacld() expects segno >= 0"));
    return;
  }

  const std::string column = info[2].As<Napi::String>().Utf8Value();
  if (!ValidateNonEmptyString(env, "ekacld", "column", column)) {
    return;
  }

  std::vector<double> dvals;
  std::vector<int> entszs;
  std::vector<int> nlflgs;
  std::vector<int> rcptrs;

  if (!ReadDoubleArrayChecked(env, info[3], "dvals", dvals)) return;
  if (!ReadInt32ArrayChecked(env, info[4], "entszs", entszs)) return;
  if (!ReadBoolArrayChecked(env, info[5], "nlflgs", nlflgs)) return;
  if (!ReadInt32ArrayChecked(env, info[6], "rcptrs", rcptrs)) return;

  if (entszs.size() != rcptrs.size() || nlflgs.size() != rcptrs.size()) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekacld() expects entszs/nlflgs/rcptrs to have the same length"));
    return;
  }

  int required = 0;
  std::string sumErr;
  if (!SumEntszsChecked(entszs, nlflgs, &required, &sumErr)) {
    ThrowSpiceError(Napi::RangeError::New(env, std::string("ekacld() invalid entszs/nlflgs: ") + sumErr));
    return;
  }
  if ((int)dvals.size() != required) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekacld() expects dvals.length === sum(entszs)"));
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ekacld(
      handle,
      segno,
      column.c_str(),
      (int)rcptrs.size(),
      dvals.data(),
      (int)dvals.size(),
      entszs.data(),
      nlflgs.data(),
      rcptrs.data(),
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ekacld()", err, "ekacld");
  }
}

static void Ekaclc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 7 || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekaclc(handle: number, segno: number, column: string, cvals: string[], entszs: number[], nlflgs: boolean[], rcptrs: number[]) expects (number, number, string, string[], number[], boolean[], number[])"));
    return;
  }

  int32_t handle = 0;
  int32_t segno = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return;
  if (!ReadInt32Checked(env, info[1], "segno", &segno)) return;
  if (segno < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekaclc() expects segno >= 0"));
    return;
  }

  const std::string column = info[2].As<Napi::String>().Utf8Value();
  if (!ValidateNonEmptyString(env, "ekaclc", "column", column)) {
    return;
  }

  tspice_napi::JsStringArrayArg cvals;
  if (!ReadStringArray(env, info[3], &cvals, "cvals")) return;

  std::vector<int> entszs;
  std::vector<int> nlflgs;
  std::vector<int> rcptrs;
  if (!ReadInt32ArrayChecked(env, info[4], "entszs", entszs)) return;
  if (!ReadBoolArrayChecked(env, info[5], "nlflgs", nlflgs)) return;
  if (!ReadInt32ArrayChecked(env, info[6], "rcptrs", rcptrs)) return;

  if (entszs.size() != rcptrs.size() || nlflgs.size() != rcptrs.size()) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekaclc() expects entszs/nlflgs/rcptrs to have the same length"));
    return;
  }

  int required = 0;
  std::string sumErr;
  if (!SumEntszsChecked(entszs, nlflgs, &required, &sumErr)) {
    ThrowSpiceError(Napi::RangeError::New(env, std::string("ekaclc() invalid entszs/nlflgs: ") + sumErr));
    return;
  }
  if ((int)cvals.values.size() != required) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekaclc() expects cvals.length === sum(entszs)"));
    return;
  }

  const size_t nvals = cvals.values.size();

  // N0067 ZZEKAC06 blanks one-character input slots when padding fixed fields.
  // A Fortran width of at least two (C stride three) preserves single letters.
  size_t vallen = 3;
  for (const std::string& s : cvals.values) {
    const size_t bytes = s.size() + 1;
    if (bytes > kMaxEkVallenBytes) {
      ThrowSpiceError(Napi::RangeError::New(
          env,
          std::string("ekaclc() value byte length exceeds cap (") +
              std::to_string(kMaxEkVallenBytes) + ")"));
      return;
    }
    vallen = std::max(vallen, bytes);
  }

  if (nvals > 0 && nvals > (size_t)std::numeric_limits<int>::max()) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekaclc() expects nvals to fit in int32"));
    return;
  }

  // Guardrail against pathological allocations while packing `string[]` into
  // the fixed-width buffer expected by CSPICE.
  if (nvals > 0 && vallen > 0 && nvals > (kMaxEkBufferBytes / vallen)) {
    const uint64_t bytes = (uint64_t)nvals * (uint64_t)vallen;
    ThrowSpiceError(Napi::RangeError::New(
        env,
        std::string("ekaclc() cvals buffer too large (") + std::to_string(bytes) + " bytes)"));
    return;
  }

  if (nvals > 0 && vallen > (size_t)std::numeric_limits<int>::max()) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekaclc() expects vallen to fit in int32"));
    return;
  }
  if (nvals > 0 && vallen > 0 && nvals > ((size_t)std::numeric_limits<int>::max() / vallen)) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekaclc() cvals buffer size overflow"));
    return;
  }

  std::vector<char> cvalsBuf(nvals * vallen);
  std::fill(cvalsBuf.begin(), cvalsBuf.end(), '\0');
  for (size_t i = 0; i < nvals; i++) {
    const std::string& s = cvals.values[i];
    memcpy(&cvalsBuf[i * vallen], s.data(), s.size());
    cvalsBuf[i * vallen + std::min(s.size(), vallen - 1)] = '\0';
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ekaclc(
      handle,
      segno,
      column.c_str(),
      (int)rcptrs.size(),
      (int)nvals,
      (int)vallen,
      (int)cvalsBuf.size(),
      cvalsBuf.data(),
      entszs.data(),
      nlflgs.data(),
      rcptrs.data(),
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ekaclc()", err, "ekaclc");
  }
}

static void Ekffld(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "ekffld(handle: number, segno: number, rcptrs: number[]) expects (number, number, number[])"));
    return;
  }

  int32_t handle = 0;
  int32_t segno = 0;
  if (!ReadInt32Checked(env, info[0], "handle", &handle)) return;
  if (!ReadInt32Checked(env, info[1], "segno", &segno)) return;
  if (segno < 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekffld() expects segno >= 0"));
    return;
  }

  std::vector<int> rcptrs;
  if (!ReadInt32ArrayChecked(env, info[2], "rcptrs", rcptrs)) return;
  if (rcptrs.empty()) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekffld() expects rcptrs.length > 0"));
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ekffld(handle, segno, (int)rcptrs.size(), rcptrs.data(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ekffld()", err, "ekffld");
  }
}

void RegisterEk(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "ekopr", Napi::Function::New(env, Ekopr), __func__)) return;
  if (!SetExportChecked(env, exports, "ekopw", Napi::Function::New(env, Ekopw), __func__)) return;
  if (!SetExportChecked(env, exports, "ekopn", Napi::Function::New(env, Ekopn), __func__)) return;
  if (!SetExportChecked(env, exports, "ekcls", Napi::Function::New(env, Ekcls), __func__)) return;
  if (!SetExportChecked(env, exports, "ekntab", Napi::Function::New(env, Ekntab), __func__)) return;
  if (!SetExportChecked(env, exports, "ektnam", Napi::Function::New(env, Ektnam), __func__)) return;
  if (!SetExportChecked(env, exports, "eknseg", Napi::Function::New(env, Eknseg), __func__)) return;

  if (!SetExportChecked(env, exports, "ekfind", Napi::Function::New(env, Ekfind), __func__)) return;
  if (!SetExportChecked(env, exports, "ekgc", Napi::Function::New(env, Ekgc), __func__)) return;
  if (!SetExportChecked(env, exports, "ekgd", Napi::Function::New(env, Ekgd), __func__)) return;
  if (!SetExportChecked(env, exports, "ekgi", Napi::Function::New(env, Ekgi), __func__)) return;

  if (!SetExportChecked(env,exports,"ekacec",Napi::Function::New(env,Ekacec),__func__)) return;
  if (!SetExportChecked(env,exports,"ekaced",Napi::Function::New(env,Ekaced),__func__)) return;
  if (!SetExportChecked(env,exports,"ekacei",Napi::Function::New(env,Ekacei),__func__)) return;
  if (!SetExportChecked(env,exports,"ekrcec",Napi::Function::New(env,Ekrcec),__func__)) return;
  if (!SetExportChecked(env,exports,"ekrced",Napi::Function::New(env,Ekrced),__func__)) return;
  if (!SetExportChecked(env,exports,"ekrcei",Napi::Function::New(env,Ekrcei),__func__)) return;
  if (!SetExportChecked(env,exports,"ekucec",Napi::Function::New(env,Ekucec),__func__)) return;
  if (!SetExportChecked(env,exports,"ekuced",Napi::Function::New(env,Ekuced),__func__)) return;
  if (!SetExportChecked(env,exports,"ekucei",Napi::Function::New(env,Ekucei),__func__)) return;
  if (!SetExportChecked(env, exports, "ekops", Napi::Function::New(env, Ekops), __func__)) return;
  if (!SetExportChecked(env, exports, "ekbseg", Napi::Function::New(env, Ekbseg), __func__)) return;
  if (!SetExportChecked(env, exports, "ekappr", Napi::Function::New(env, Ekappr), __func__)) return;
  if (!SetExportChecked(env, exports, "ekinsr", Napi::Function::New(env, Ekinsr), __func__)) return;
  if (!SetExportChecked(env, exports, "ekdelr", Napi::Function::New(env, Ekdelr), __func__)) return;
  if (!SetExportChecked(env, exports, "ekifld", Napi::Function::New(env, Ekifld), __func__)) return;
  if (!SetExportChecked(env, exports, "ekacli", Napi::Function::New(env, Ekacli), __func__)) return;
  if (!SetExportChecked(env, exports, "ekacld", Napi::Function::New(env, Ekacld), __func__)) return;
  if (!SetExportChecked(env, exports, "ekaclc", Napi::Function::New(env, Ekaclc), __func__)) return;
  if (!SetExportChecked(env, exports, "ekffld", Napi::Function::New(env, Ekffld), __func__)) return;
}

}  // namespace tspice_backend_node
