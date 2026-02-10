#include "ids_names.h"

#include <cctype>
#include <string>
#include <vector>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeFound;
using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static std::string TrimAsciiWhitespace(const std::string& s) {
  size_t start = 0;
  while (start < s.size() && std::isspace(static_cast<unsigned char>(s[start]))) {
    start++;
  }

  size_t end = s.size();
  while (end > start && std::isspace(static_cast<unsigned char>(s[end - 1]))) {
    end--;
  }

  return s.substr(start, end - start);
}

static std::string ToUpperAscii(std::string s) {
  for (char& ch : s) {
    ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
  }
  return s;
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
    ThrowSpiceError(env, std::string("CSPICE failed while calling bodn2c(\"") + name + "\")", err);
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
    ThrowSpiceError(env, std::string("CSPICE failed while calling bods2c(\"") + name + "\")", err);
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
    ThrowSpiceError(env, std::string("CSPICE failed while calling boddef(\"") + name + "\", " + std::to_string(codeIn) + ")", err);
  }
}

static Napi::Boolean Bodfnd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodfnd(body: number, item: string) expects (number, string)"));
    return Napi::Boolean::New(env, false);
  }

  const int body = info[0].As<Napi::Number>().Int32Value();
  const std::string item = info[1].As<Napi::String>().Utf8Value();

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
  const std::string itemRaw = info[1].As<Napi::String>().Utf8Value();
  const std::string item = ToUpperAscii(TrimAsciiWhitespace(itemRaw));

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];

  const std::string poolVar = std::string("BODY") + std::to_string(body) + "_" + item;
  int found = 0;
  int n = 0;
  char typeOut[2] = {0};
  int dtCode = tspice_dtpool(poolVar.c_str(), &found, &n, typeOut, (int)sizeof(typeOut), err, (int)sizeof(err));
  if (dtCode != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling dtpool(\"") + poolVar + "\")", err);
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
  if (!SetExportChecked(env, exports, "bodc2s", Napi::Function::New(env, Bodc2s), __func__)) return;
  if (!SetExportChecked(env, exports, "bods2c", Napi::Function::New(env, Bods2c), __func__)) return;
  if (!SetExportChecked(env, exports, "boddef", Napi::Function::New(env, Boddef), __func__)) return;
  if (!SetExportChecked(env, exports, "bodfnd", Napi::Function::New(env, Bodfnd), __func__)) return;
  if (!SetExportChecked(env, exports, "bodvar", Napi::Function::New(env, Bodvar), __func__)) return;
}

}  // namespace tspice_backend_node
