#include "ids_names.h"

#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeFound;
using tspice_napi::MakeNotFound;
using tspice_napi::PreviewForError;
using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool IsAsciiWhitespace(unsigned char c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v';
}

static std::string TrimAsciiWhitespace(const std::string& s) {
  size_t start = 0;
  while (start < s.size() && IsAsciiWhitespace(static_cast<unsigned char>(s[start]))) {
    start++;
  }

  size_t end = s.size();
  while (end > start && IsAsciiWhitespace(static_cast<unsigned char>(s[end - 1]))) {
    end--;
  }

  return s.substr(start, end - start);
}

static std::string ToUpperAscii(std::string s) {
  for (char& ch : s) {
    unsigned char c = static_cast<unsigned char>(ch);
    if (c >= 'a' && c <= 'z') {
      ch = static_cast<char>(c - 32);
    }
  }
  return s;
}

static std::string NormalizeBodItem(const std::string& itemRaw) {
  return ToUpperAscii(TrimAsciiWhitespace(itemRaw));
}

constexpr size_t kMaxBodItemChars = 1024;

static bool SurfaceInteger(Napi::Env env, Napi::Value v, int *out) {
  if (v.IsNumber()) {
    const double x = v.As<Napi::Number>().DoubleValue();
    if (x >= INT32_MIN && x <= INT32_MAX && std::trunc(x) == x) { *out = static_cast<int>(x); return true; }
  }
  ThrowSpiceError(Napi::TypeError::New(env,"Surface integer must be signed 32-bit")); return false;
}

static bool SurfaceText(Napi::Env env, Napi::Value v, std::string *out) {
  if (v.IsString()) {
    const auto input = v.As<Napi::String>();
    *out = input.Utf8Value();
    if (out->size() < INT32_MAX && out->find(char(0)) == std::string::npos &&
        Napi::String::New(env,*out).Utf16Value() == input.Utf16Value()) return true;
  }
  ThrowSpiceError(Napi::TypeError::New(env,"Expected well-formed surface text without embedded NUL")); return false;
}

static Napi::Value Srfc2s(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "srfc2s: unexpected argument count"));
    return env.Undefined();
  }
  int code;
  if (!SurfaceInteger(env, info[0], &code)) return env.Undefined();
  int bodyId;
  if (!SurfaceInteger(env, info[1], &bodyId)) return env.Undefined();
  int srflen;
  if (!SurfaceInteger(env, info[2], &srflen)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int flag = 0;
  char text[37] = {};  // SPICE_SRF_SFNMLN, including NUL.
  if (srflen > 37) srflen = 37;
  if (tspice_srfc2s(code, bodyId, srflen, text, &flag, err, sizeof(err))) {
    ThrowSpiceError(env, "srfc2s", err);
    return env.Undefined();
  }
  auto result = Napi::Object::New(env);
  const auto decoded = Napi::String::New(env, text);
  if (decoded.Utf8Value() != text) {
    ThrowSpiceError(Napi::TypeError::New(env,"Surface result is not valid UTF-8"));
    return env.Undefined();
  }
  result.Set("surface", decoded);
  result.Set("isName", Napi::Boolean::New(env, flag != 0));
  return result;
}

static Napi::Value Srfcss(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "srfcss: unexpected argument count"));
    return env.Undefined();
  }
  int code;
  if (!SurfaceInteger(env, info[0], &code)) return env.Undefined();
  std::string body;
  if (!SurfaceText(env, info[1], &body)) return env.Undefined();
  int srflen;
  if (!SurfaceInteger(env, info[2], &srflen)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int flag = 0;
  char text[37] = {};  // SPICE_SRF_SFNMLN, including NUL.
  if (srflen > 37) srflen = 37;
  if (tspice_srfcss(code, body.c_str(), srflen, text, &flag, err, sizeof(err))) {
    ThrowSpiceError(env, "srfcss", err);
    return env.Undefined();
  }
  auto result = Napi::Object::New(env);
  const auto decoded = Napi::String::New(env, text);
  if (decoded.Utf8Value() != text) {
    ThrowSpiceError(Napi::TypeError::New(env,"Surface result is not valid UTF-8"));
    return env.Undefined();
  }
  result.Set("surface", decoded);
  result.Set("isName", Napi::Boolean::New(env, flag != 0));
  return result;
}

static Napi::Value Srfs2c(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "srfs2c: unexpected argument count"));
    return env.Undefined();
  }
  std::string surface;
  if (!SurfaceText(env, info[0], &surface)) return env.Undefined();
  std::string body;
  if (!SurfaceText(env, info[1], &body)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int flag = 0;
  int code = 0;
  if (tspice_srfs2c(surface.c_str(), body.c_str(), &code, &flag, err, sizeof(err))) {
    ThrowSpiceError(env, "srfs2c", err);
    return env.Undefined();
  }
  if (!flag) return MakeNotFound(env);
  return MakeFound<double>(env,"code",static_cast<double>(code));
}

static Napi::Value Srfscc(const Napi::CallbackInfo& info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "srfscc: unexpected argument count"));
    return env.Undefined();
  }
  std::string surface;
  if (!SurfaceText(env, info[0], &surface)) return env.Undefined();
  int bodyId;
  if (!SurfaceInteger(env, info[1], &bodyId)) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  int flag = 0;
  int code = 0;
  if (tspice_srfscc(surface.c_str(), bodyId, &code, &flag, err, sizeof(err))) {
    ThrowSpiceError(env, "srfscc", err);
    return env.Undefined();
  }
  if (!flag) return MakeNotFound(env);
  return MakeFound<double>(env,"code",static_cast<double>(code));
}

static Napi::Object Bodn2c(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodn2c(name: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  int codeOut = 0;
  int found = 0;
  const int code = tspice_bodn2c(name.c_str(), &codeOut, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling bodn2c(\"") + PreviewForError(name) + "\")",
        err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<double>(env, "code", static_cast<double>(codeOut));
}

static Napi::Object Bodc2n(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodc2n(code: number) expects exactly one number argument"));
    return Napi::Object::New(env);
  }

  const int codeIn = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  char nameOut[tspice_backend_node::kOutMaxBytes];
  int found = 0;
  const int code = tspice_bodc2n(codeIn, nameOut, (int)sizeof(nameOut), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling bodc2n(") + std::to_string(codeIn) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<const char*>(env, "name", nameOut);
}

static Napi::String Bodc2s(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodc2s(code: number) expects exactly one number argument"));
    return Napi::String::New(env, "");
  }

  const int codeIn = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  char nameOut[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_bodc2s(codeIn, nameOut, (int)sizeof(nameOut), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling bodc2s(") + std::to_string(codeIn) + ")", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, nameOut);
}

static Napi::Object Bods2c(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bods2c(name: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  int codeOut = 0;
  int found = 0;
  const int code = tspice_bods2c(name.c_str(), &codeOut, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling bods2c(\"") + PreviewForError(name) + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<double>(env, "code", static_cast<double>(codeOut));
}

static void Boddef(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "boddef(name: string, code: number) expects (string, number)"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  const int codeIn = info[1].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_boddef(name.c_str(), codeIn, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling boddef(\"") + PreviewForError(name) + "\", " + std::to_string(codeIn) + ")", err);
  }
}

static Napi::Boolean Bodfnd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodfnd(body: number, item: string) expects (number, string)"));
    return Napi::Boolean::New(env, false);
  }

  const int body = info[0].As<Napi::Number>().Int32Value();
  const std::string itemRaw = info[1].As<Napi::String>().Utf8Value();
  const std::string item = NormalizeBodItem(itemRaw);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int found = 0;
  const int code = tspice_bodfnd(body, item.c_str(), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling bodfnd", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, found != 0);
}

static Napi::Array Bodvar(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodvar(body: number, item: string) expects (number, string)"));
    return Napi::Array::New(env);
  }

  const int body = info[0].As<Napi::Number>().Int32Value();
  const Napi::String itemArg = info[1].As<Napi::String>();
  const size_t itemLengthChars = itemArg.Utf16Value().size();
  if (itemLengthChars > kMaxBodItemChars) {
    ThrowSpiceError(Napi::RangeError::New(
        env,
        std::string("Kernel pool item name is too long: ") + std::to_string(itemLengthChars) +
            " characters (max " + std::to_string(kMaxBodItemChars) + ")"));
    return Napi::Array::New(env);
  }
  const std::string itemRaw = itemArg.Utf8Value();
  const std::string item = NormalizeBodItem(itemRaw);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];

  // Match the 32-byte key constructed by NAIF BODVAR.
  const std::string poolVar = (std::string("BODY") + std::to_string(body) + "_" + item).substr(0, 32);
  int found = 0;
  int n = 0;
  char typeOut[2] = {0};
  int dtCode = tspice_dtpool(poolVar.c_str(), &found, &n, typeOut, (int)sizeof(typeOut), err, (int)sizeof(err));
  if (dtCode != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dtpool(\"") + PreviewForError(poolVar) + "\")", err);
    return Napi::Array::New(env);
  }
  if (!found) {
    // Missing body constants are a normal miss; callers that need strict checks can use bodfnd().
    return Napi::Array::New(env, 0);
  }
  if (typeOut[0] != 'N') {
    // Missing / non-numeric pool vars are treated as a normal miss; use bodfnd() for strict presence.
    return Napi::Array::New(env, 0);
  }
  if (n <= 0) {
    return Napi::Array::New(env, 0);
  }

  std::vector<double> values((size_t)n, 0.0);
  int dim = 0;
  const int code = tspice_bodvar(body, item.c_str(), n, &dim, values.data(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling bodvar", err);
    return Napi::Array::New(env);
  }

  if (dim < 0) dim = 0;
  if (dim > n) dim = n;
  return MakeNumberArray(env, values.data(), (size_t)dim);
}

namespace tspice_backend_node {

void RegisterIdsNames(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "bodn2c", Napi::Function::New(env, Bodn2c), __func__)) return;
  if (!SetExportChecked(env, exports, "bodc2n", Napi::Function::New(env, Bodc2n), __func__)) return;
  if (!SetExportChecked(env, exports, "srfc2s", Napi::Function::New(env, Srfc2s), __func__)) return;
  if (!SetExportChecked(env, exports, "srfcss", Napi::Function::New(env, Srfcss), __func__)) return;
  if (!SetExportChecked(env, exports, "srfs2c", Napi::Function::New(env, Srfs2c), __func__)) return;
  if (!SetExportChecked(env, exports, "srfscc", Napi::Function::New(env, Srfscc), __func__)) return;
  if (!SetExportChecked(env, exports, "bodc2s", Napi::Function::New(env, Bodc2s), __func__)) return;
  if (!SetExportChecked(env, exports, "bods2c", Napi::Function::New(env, Bods2c), __func__)) return;
  if (!SetExportChecked(env, exports, "boddef", Napi::Function::New(env, Boddef), __func__)) return;
  if (!SetExportChecked(env, exports, "bodfnd", Napi::Function::New(env, Bodfnd), __func__)) return;
  if (!SetExportChecked(env, exports, "bodvar", Napi::Function::New(env, Bodvar), __func__)) return;
}

}  // namespace tspice_backend_node
