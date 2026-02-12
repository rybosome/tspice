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

static int SumEntszs(const std::vector<int>& entszs) {
  long long sum = 0;
  for (int v : entszs) {
    sum += (long long)v;
  }
  if (sum < 0 || sum > (long long)std::numeric_limits<int>::max()) {
    return -1;
  }
  return (int)sum;
}

}  // namespace

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

  if (handle <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected handle to be > 0"));
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

  if (handle <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Expected handle to be > 0"));
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

  if (handle <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekifld() expects handle > 0"));
    return Napi::Object::New(env);
  }
  if (nrows <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekifld() expects nrows > 0"));
    return Napi::Object::New(env);
  }

  const std::string tabnam = info[1].As<Napi::String>().Utf8Value();
  if (!ValidateNonEmptyString(env, "ekifld", "tabnam", tabnam)) {
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
  if (handle <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekacli() expects handle > 0"));
    return;
  }
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

  const int required = SumEntszs(entszs);
  if (required < 0 || (int)ivals.size() != required) {
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
  if (handle <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekacld() expects handle > 0"));
    return;
  }
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

  const int required = SumEntszs(entszs);
  if (required < 0 || (int)dvals.size() != required) {
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
  if (handle <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekaclc() expects handle > 0"));
    return;
  }
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

  const int required = SumEntszs(entszs);
  if (required < 0 || (int)cvals.values.size() != required) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekaclc() expects cvals.length === sum(entszs)"));
    return;
  }

  size_t vallen = 1;
  for (const std::string& s : cvals.values) {
    vallen = std::max(vallen, s.size() + 1);
  }

  const size_t nvals = cvals.values.size();
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
  if (handle <= 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "ekffld() expects handle > 0"));
    return;
  }
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
  const int code = tspice_ekffld(handle, segno, rcptrs.data(), err, (int)sizeof(err));
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

  if (!SetExportChecked(env, exports, "ekifld", Napi::Function::New(env, Ekifld), __func__)) return;
  if (!SetExportChecked(env, exports, "ekacli", Napi::Function::New(env, Ekacli), __func__)) return;
  if (!SetExportChecked(env, exports, "ekacld", Napi::Function::New(env, Ekacld), __func__)) return;
  if (!SetExportChecked(env, exports, "ekaclc", Napi::Function::New(env, Ekaclc), __func__)) return;
  if (!SetExportChecked(env, exports, "ekffld", Napi::Function::New(env, Ekffld), __func__)) return;
}

}  // namespace tspice_backend_node
