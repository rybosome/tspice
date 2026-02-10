#include "kernels.h"

#include "cell_handles.h"

#include <algorithm>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::ReadStringArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;
using tspice_napi::FixedWidthToJsString;

static std::string TrimAsciiWhitespace(const std::string& s) {
  size_t start = 0;
  while (start < s.size() && tspice_napi::IsAsciiWhitespace(static_cast<unsigned char>(s[start]))) {
    start++;
  }

  size_t end = s.size();
  while (end > start && tspice_napi::IsAsciiWhitespace(static_cast<unsigned char>(s[end - 1]))) {
    end--;
  }

  return s.substr(start, end - start);
}

static Napi::String SpiceVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "spiceVersion() does not take any arguments"));
    return Napi::String::New(env, "");
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char out[tspice_backend_node::kOutMaxBytes];
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_tkvrsn_toolkit(out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling tkvrsn_c(\"TOOLKIT\")", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static void Furnsh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "furnsh(path: string) expects exactly one string argument"));
    return;
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_furnsh(path.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling furnsh(\"") + path + "\")",
        err);
  }
}

static void Unload(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "unload(path: string) expects exactly one string argument"));
    return;
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_unload(path.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling unload(\"") + path + "\")",
        err);
  }
}

static void Kclear(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "kclear() does not take any arguments"));
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_kclear(err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling kclear()", err);
  }
}

static Napi::Number Ktotal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  std::string kind = "ALL";
  if (info.Length() > 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "ktotal(kind?: string) expects 0 or 1 arguments"));
    return Napi::Number::New(env, 0);
  }

  if (info.Length() == 1) {
    if (!info[0].IsString()) {
      ThrowSpiceError(Napi::TypeError::New(env, "ktotal(kind?: string) expects a string kind"));
      return Napi::Number::New(env, 0);
    }
    kind = info[0].As<Napi::String>().Utf8Value();
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int count = 0;
  const int code = tspice_ktotal(kind.c_str(), &count, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling ktotal(\"") + kind + "\")",
        err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(count));
}

static Napi::Object Kdata(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || info.Length() > 2) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "kdata(which: number, kind?: string) expects 1 or 2 arguments"));
    return Napi::Object::New(env);
  }

  if (!info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "kdata(which: number, kind?: string) expects which to be a number"));
    return Napi::Object::New(env);
  }

  const int which = info[0].As<Napi::Number>().Int32Value();
  std::string kind = "ALL";
  if (info.Length() == 2) {
    if (!info[1].IsString()) {
      ThrowSpiceError(Napi::TypeError::New(
          env,
          "kdata(which: number, kind?: string) expects kind to be a string"));
      return Napi::Object::New(env);
    }
    kind = info[1].As<Napi::String>().Utf8Value();
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  char file[tspice_backend_node::kOutMaxBytes];
  char filtyp[tspice_backend_node::kOutMaxBytes];
  char source[tspice_backend_node::kOutMaxBytes];
  int handle = 0;
  int found = 0;

  const int code = tspice_kdata(
      which,
      kind.c_str(),
      file,
      (int)sizeof(file),
      filtyp,
      (int)sizeof(filtyp),
      source,
      (int)sizeof(source),
      &handle,
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling kdata(which=") + std::to_string(which) + ")",
        err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("file", FixedWidthToJsString(env, file, sizeof(file)));
  result.Set("filtyp", FixedWidthToJsString(env, filtyp, sizeof(filtyp)));
  result.Set("source", FixedWidthToJsString(env, source, sizeof(source)));
  result.Set("handle", Napi::Number::New(env, static_cast<double>(handle)));
  return result;
}

static Napi::Object Kinfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "kinfo(path: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  char filtyp[tspice_backend_node::kOutMaxBytes];
  char source[tspice_backend_node::kOutMaxBytes];
  int handle = 0;
  int found = 0;

  const int code = tspice_kinfo(
      path.c_str(),
      filtyp,
      (int)sizeof(filtyp),
      source,
      (int)sizeof(source),
      &handle,
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling kinfo(\"") + path + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("filtyp", FixedWidthToJsString(env, filtyp, sizeof(filtyp)));
  result.Set("source", FixedWidthToJsString(env, source, sizeof(source)));
  result.Set("handle", Napi::Number::New(env, static_cast<double>(handle)));
  return result;
}

static Napi::Object Kxtrct(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[2].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "kxtrct(keywd: string, terms: string[], wordsq: string) expects (string, string[], string)"));
    return Napi::Object::New(env);
  }

  const std::string keywdRaw = info[0].As<Napi::String>().Utf8Value();
  const std::string keywd = TrimAsciiWhitespace(keywdRaw);
  if (keywd.empty()) {
    ThrowSpiceError(Napi::RangeError::New(env, "kxtrct keywd must be a non-empty string"));
    return Napi::Object::New(env);
  }

  const std::string wordsq = info[2].As<Napi::String>().Utf8Value();

  // Conservative guard against huge native allocations (wordsqOut + substr are
  // each allocated at ~wordsq.size() bytes).
  constexpr size_t kMaxKxtrctWordsqBytes = size_t{1} << 20;  // 1 MiB
  if (wordsq.size() >= kMaxKxtrctWordsqBytes) {
    ThrowSpiceError(Napi::RangeError::New(env, "kxtrct(): wordsq is too large"));
    return Napi::Object::New(env);
  }

  tspice_napi::JsStringArrayArg termsArg;
  if (!ReadStringArray(env, info[1], &termsArg, "terms")) {
    return Napi::Object::New(env);
  }

  std::vector<std::string> terms;
  terms.reserve(termsArg.values.size());
  for (const std::string& raw : termsArg.values) {
    std::string t = TrimAsciiWhitespace(raw);
    if (!t.empty()) {
      terms.push_back(std::move(t));
    }
  }

  const size_t nterms = terms.size();

  size_t termlen = 2;
  for (const std::string& s : terms) {
    termlen = std::max(termlen, s.size() + 1);
  }

  const size_t wordsqOutMaxBytes = std::max<size_t>(2, wordsq.size() + 1);
  const size_t substrMaxBytes = std::max<size_t>(2, wordsq.size() + 1);

  if (termlen > (size_t)INT32_MAX || nterms > (size_t)INT32_MAX ||
      wordsqOutMaxBytes > (size_t)INT32_MAX || substrMaxBytes > (size_t)INT32_MAX) {
    ThrowSpiceError(Napi::RangeError::New(env, "kxtrct(): input is too large"));
    return Napi::Object::New(env);
  }

  std::vector<char> termsBuf;
  if (nterms > 0) {
    termsBuf.resize(nterms * termlen);
    std::fill(termsBuf.begin(), termsBuf.end(), '\0');
    for (size_t i = 0; i < nterms; i++) {
      const std::string& s = terms[i];
      char* dst = termsBuf.data() + i * termlen;
      strncpy(dst, s.c_str(), termlen - 1);
      dst[termlen - 1] = '\0';
    }
  }

  std::vector<char> wordsqOut(wordsqOutMaxBytes);
  std::vector<char> substr(substrMaxBytes);

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  int found = 0;
  const int code = tspice_kxtrct(
      keywd.c_str(),
      (int)termlen,
      termsBuf.empty() ? nullptr : termsBuf.data(),
      (int)nterms,
      wordsq.c_str(),
      wordsqOut.data(),
      (int)wordsqOut.size(),
      substr.data(),
      (int)substr.size(),
      &found,
      err,
      (int)sizeof(err));

  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling kxtrct(...)", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("wordsq", Napi::String::New(env, wordsqOut.data()));
  result.Set("substr", Napi::String::New(env, substr.data()));
  return result;
}

static Napi::Value Kplfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "kplfrm(frmcls: number, idset: number) expects (number, cellHandle)"));
    return env.Undefined();
  }

  const int frmcls = info[0].As<Napi::Number>().Int32Value();
  const uint32_t idsetHandle = info[1].As<Napi::Number>().Uint32Value();
  if (idsetHandle == 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "kplfrm(idset): handle must be a non-zero integer"));
    return env.Undefined();
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  const uintptr_t idsetPtr = tspice_backend_node::GetCellHandlePtrOrThrow(env, idsetHandle, "kplfrm", "cell");
  if (env.IsExceptionPending()) {
    return env.Undefined();
  }

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_kplfrm(frmcls, idsetPtr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling kplfrm(...)", err);
  }
  return env.Undefined();
}

static Napi::Number KtotalAll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "__ktotalAll() does not take any arguments"));
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int total = tspice_ktotal_all(err, (int)sizeof(err));
  if (total < 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ktotal(\"ALL\")", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, static_cast<double>(total));
}

namespace tspice_backend_node {

void RegisterKernels(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "spiceVersion", Napi::Function::New(env, SpiceVersion), __func__)) return;
  if (!SetExportChecked(env, exports, "furnsh", Napi::Function::New(env, Furnsh), __func__)) return;
  if (!SetExportChecked(env, exports, "unload", Napi::Function::New(env, Unload), __func__)) return;
  if (!SetExportChecked(env, exports, "kclear", Napi::Function::New(env, Kclear), __func__)) return;
  if (!SetExportChecked(env, exports, "ktotal", Napi::Function::New(env, Ktotal), __func__)) return;
  if (!SetExportChecked(env, exports, "kdata", Napi::Function::New(env, Kdata), __func__)) return;
  if (!SetExportChecked(env, exports, "kinfo", Napi::Function::New(env, Kinfo), __func__)) return;
  if (!SetExportChecked(env, exports, "kxtrct", Napi::Function::New(env, Kxtrct), __func__)) return;
  if (!SetExportChecked(env, exports, "kplfrm", Napi::Function::New(env, Kplfrm), __func__)) return;
  if (!SetExportChecked(env, exports, "__ktotalAll", Napi::Function::New(env, KtotalAll), __func__)) return;
}

}  // namespace tspice_backend_node
