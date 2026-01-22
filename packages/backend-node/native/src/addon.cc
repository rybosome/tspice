#include <napi.h>

#include <mutex>
#include <string>

extern "C" {
#include "SpiceUsr.h"
}

// Forces a rebuild/relink when the resolved CSPICE install changes (cache/toolkit bump
// or TSPICE_CSPICE_DIR override).
#include "cspice_stamp.h"

// The value of TSPICE_CSPICE_STAMP is not used at runtime; this exists solely to create a
// compile-time dependency on the generated header so changes to the CSPICE toolkit/config
// trigger a rebuild.
static_assert(sizeof(TSPICE_CSPICE_STAMP) > 0, "TSPICE_CSPICE_STAMP must be non-empty");

static std::mutex g_cspice_mutex;

static std::string RTrim(std::string s) {
  while (!s.empty()) {
    const char c = s.back();
    if (c == '\0' || c == '\n' || c == '\r' || c == ' ' || c == '\t') {
      s.pop_back();
    } else {
      break;
    }
  }
  return s;
}

static std::string GetSpiceErrorMessageAndReset() {
  // Caller must hold g_cspice_mutex.
  if (!failed_c()) {
    return "Unknown CSPICE error (failed_c() is false)";
  }

  constexpr SpiceInt kMsgLen = 1840;
  SpiceChar shortMsg[kMsgLen + 1] = {0};
  SpiceChar longMsg[kMsgLen + 1] = {0};

  getmsg_c("SHORT", kMsgLen, shortMsg);
  getmsg_c("LONG", kMsgLen, longMsg);

  // Clear the CSPICE error state only after capturing messages.
  reset_c();

  const std::string shortStr = RTrim(shortMsg);
  const std::string longStr = RTrim(longMsg);

  if (shortStr.empty() && longStr.empty()) {
    return "Unknown CSPICE error (no message provided)";
  }

  if (!shortStr.empty() && !longStr.empty()) {
    return shortStr + "\n" + longStr;
  }

  return !shortStr.empty() ? shortStr : longStr;
}

static void InitCspiceErrorHandlingOnce() {
  static std::once_flag flag;
  std::call_once(flag, [] {
    // CSPICE error handling is process-global. For this smoke-test addon, we configure a
    // minimal error mode and surface failures as JS exceptions (without attempting per-call
    // isolation or thread-safety guarantees).
    erract_c("SET", 0, const_cast<SpiceChar*>("RETURN"));
    errprt_c("SET", 0, const_cast<SpiceChar*>("NONE"));
  });
}

static Napi::String SpiceVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    Napi::TypeError::New(env, "spiceVersion() does not take any arguments").ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  const SpiceChar* version = tkvrsn_c("TOOLKIT");
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling tkvrsn_c(\"TOOLKIT\"):\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, version);
}

static void Furnsh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "furnsh(path: string) expects exactly one string argument")
      .ThrowAsJavaScriptException();
    return;
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  furnsh_c(path.c_str());
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling furnsh_c(\"") + path + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return;
  }
}

static void Unload(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "unload(path: string) expects exactly one string argument")
      .ThrowAsJavaScriptException();
    return;
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  unload_c(path.c_str());
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling unload_c(\"") + path + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return;
  }
}

static void Kclear(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    Napi::TypeError::New(env, "kclear() does not take any arguments").ThrowAsJavaScriptException();
    return;
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  kclear_c();
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling kclear_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return;
  }
}

static Napi::Number Ktotal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  std::string kind = "ALL";
  if (info.Length() > 1) {
    Napi::TypeError::New(env, "ktotal(kind?: string) expects 0 or 1 arguments")
      .ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  if (info.Length() == 1) {
    if (!info[0].IsString()) {
      Napi::TypeError::New(env, "ktotal(kind?: string) expects a string kind")
        .ThrowAsJavaScriptException();
      return Napi::Number::New(env, 0);
    }
    kind = info[0].As<Napi::String>().Utf8Value();
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceInt count = 0;
  ktotal_c(kind.c_str(), &count);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling ktotal_c(\"") + kind + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(count));
}

static Napi::Object Kdata(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || info.Length() > 2) {
    Napi::TypeError::New(env, "kdata(which: number, kind?: string) expects 1 or 2 arguments")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  if (!info[0].IsNumber()) {
    Napi::TypeError::New(env, "kdata(which: number, kind?: string) expects which to be a number")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const SpiceInt which = static_cast<SpiceInt>(info[0].As<Napi::Number>().Int32Value());
  std::string kind = "ALL";
  if (info.Length() == 2) {
    if (!info[1].IsString()) {
      Napi::TypeError::New(env, "kdata(which: number, kind?: string) expects kind to be a string")
        .ThrowAsJavaScriptException();
      return Napi::Object::New(env);
    }
    kind = info[1].As<Napi::String>().Utf8Value();
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  // Generous buffer sizes for path/source strings.
  constexpr SpiceInt kFileMax = 2048;
  constexpr SpiceInt kTypeMax = 256;
  constexpr SpiceInt kSourceMax = 2048;

  SpiceChar file[kFileMax + 1] = {0};
  SpiceChar filtyp[kTypeMax + 1] = {0};
  SpiceChar source[kSourceMax + 1] = {0};
  SpiceInt handle = 0;
  SpiceBoolean found = SPICEFALSE;

  kdata_c(which, kind.c_str(), kFileMax, kTypeMax, kSourceMax, file, filtyp, source, &handle, &found);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling kdata_c(which=") + std::to_string(which) +
      ", kind=\"" + kind + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  if (found == SPICEFALSE) {
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("file", Napi::String::New(env, file));
  result.Set("filtyp", Napi::String::New(env, filtyp));
  result.Set("source", Napi::String::New(env, source));
  result.Set("handle", Napi::Number::New(env, static_cast<double>(handle)));
  return result;
}

static Napi::Number Str2et(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "str2et(utc: string) expects exactly one string argument")
      .ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  const std::string utc = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble et = 0.0;
  str2et_c(utc.c_str(), &et);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling str2et_c(\"") + utc + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(et));
}

static Napi::String Et2utc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "et2utc(et: number, format: string, prec: number) expects (number, string, number)")
      .ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  const SpiceDouble et = static_cast<SpiceDouble>(info[0].As<Napi::Number>().DoubleValue());
  const std::string format = info[1].As<Napi::String>().Utf8Value();
  const SpiceInt prec = static_cast<SpiceInt>(info[2].As<Napi::Number>().Int32Value());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  // Output length must include the terminating NUL.
  constexpr SpiceInt kOutMax = 2048;
  SpiceChar out[kOutMax] = {0};

  et2utc_c(et, format.c_str(), prec, kOutMax, out);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling et2utc_c(et=") + std::to_string(et) +
      ", format=\"" + format + "\", prec=" + std::to_string(prec) + "):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, RTrim(out));
}

static Napi::String Timout(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    Napi::TypeError::New(env, "timout(et: number, picture: string) expects (number, string)")
      .ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  const SpiceDouble et = static_cast<SpiceDouble>(info[0].As<Napi::Number>().DoubleValue());
  const std::string picture = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  // Output length must include the terminating NUL.
  constexpr SpiceInt kOutMax = 2048;
  SpiceChar out[kOutMax] = {0};

  timout_c(et, picture.c_str(), kOutMax, out);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling timout_c(et=") + std::to_string(et) +
      ", picture=\"" + picture + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, RTrim(out));
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("spiceVersion", Napi::Function::New(env, SpiceVersion));
  exports.Set("furnsh", Napi::Function::New(env, Furnsh));
  exports.Set("unload", Napi::Function::New(env, Unload));
  exports.Set("kclear", Napi::Function::New(env, Kclear));
  exports.Set("ktotal", Napi::Function::New(env, Ktotal));
  exports.Set("kdata", Napi::Function::New(env, Kdata));
  exports.Set("str2et", Napi::Function::New(env, Str2et));
  exports.Set("et2utc", Napi::Function::New(env, Et2utc));
  exports.Set("timout", Napi::Function::New(env, Timout));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
