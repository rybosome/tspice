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

static Napi::Array MakeNumberArray(Napi::Env env, const double* values, size_t count) {
  Napi::Array arr = Napi::Array::New(env, count);
  for (size_t i = 0; i < count; i++) {
    arr.Set(i, Napi::Number::New(env, values[i]));
  }
  return arr;
}

static bool ReadNumberArray3(Napi::Env env, const Napi::Value& value, double out[3], const char* name) {
  if (!value.IsArray()) {
    Napi::TypeError::New(env, std::string(name) + " must be an array").ThrowAsJavaScriptException();
    return false;
  }
  Napi::Array arr = value.As<Napi::Array>();
  if (arr.Length() != 3) {
    Napi::TypeError::New(env, std::string(name) + " must have length 3").ThrowAsJavaScriptException();
    return false;
  }
  for (uint32_t i = 0; i < 3; i++) {
    Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      Napi::TypeError::New(env, std::string(name) + " must contain only numbers").ThrowAsJavaScriptException();
      return false;
    }
    out[i] = v.As<Napi::Number>().DoubleValue();
  }
  return true;
}

static bool ReadNumberArray9ToMat33(
  Napi::Env env,
  const Napi::Value& value,
  double out[3][3],
  const char* name
) {
  if (!value.IsArray()) {
    Napi::TypeError::New(env, std::string(name) + " must be an array").ThrowAsJavaScriptException();
    return false;
  }
  Napi::Array arr = value.As<Napi::Array>();
  if (arr.Length() != 9) {
    Napi::TypeError::New(env, std::string(name) + " must have length 9").ThrowAsJavaScriptException();
    return false;
  }
  for (uint32_t i = 0; i < 9; i++) {
    Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      Napi::TypeError::New(env, std::string(name) + " must contain only numbers").ThrowAsJavaScriptException();
      return false;
    }
    out[i / 3][i % 3] = v.As<Napi::Number>().DoubleValue();
  }
  return true;
}

static Napi::Object MakeFoundNumber(Napi::Env env, const char* key, double value) {
  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set(key, Napi::Number::New(env, value));
  return result;
}

static Napi::Object MakeFoundString(Napi::Env env, const char* key, const std::string& value) {
  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set(key, Napi::String::New(env, value));
  return result;
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

static Napi::Object Bodn2c(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "bodn2c(name: string) expects exactly one string argument")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceInt code = 0;
  SpiceBoolean found = SPICEFALSE;
  bodn2c_c(name.c_str(), &code, &found);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling bodn2c_c(\"") + name + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  if (found == SPICEFALSE) {
    Napi::Object result = Napi::Object::New(env);
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  return MakeFoundNumber(env, "code", static_cast<double>(code));
}

static Napi::Object Bodc2n(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "bodc2n(code: number) expects exactly one number argument")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const SpiceInt code = static_cast<SpiceInt>(info[0].As<Napi::Number>().Int32Value());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  constexpr SpiceInt kNameMax = 256;
  SpiceChar name[kNameMax + 1] = {0};
  SpiceBoolean found = SPICEFALSE;

  bodc2n_c(code, kNameMax, name, &found);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling bodc2n_c(code=") + std::to_string(code) + "):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  if (found == SPICEFALSE) {
    Napi::Object result = Napi::Object::New(env);
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  return MakeFoundString(env, "name", RTrim(name));
}

static Napi::Object Namfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "namfrm(name: string) expects exactly one string argument")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceInt frameId = 0;
  // CSPICE N0067 `namfrm_c` signature is:
  //   void namfrm_c ( ConstSpiceChar *frname, SpiceInt *frcode );
  // It does not provide an explicit "found" output.
  namfrm_c(name.c_str(), &frameId);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling namfrm_c(\"") + name + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  if (frameId == 0) {
    Napi::Object result = Napi::Object::New(env);
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  return MakeFoundNumber(env, "code", static_cast<double>(frameId));
}

static Napi::Object Frmnam(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "frmnam(code: number) expects exactly one number argument")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const SpiceInt frameId = static_cast<SpiceInt>(info[0].As<Napi::Number>().Int32Value());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  constexpr SpiceInt kNameMax = 256;
  SpiceChar frameName[kNameMax + 1] = {0};
  frmnam_c(frameId, kNameMax, frameName);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling frmnam_c(frameId=") + std::to_string(frameId) + "):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const std::string out = RTrim(frameName);
  if (out.empty()) {
    Napi::Object result = Napi::Object::New(env);
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  return MakeFoundString(env, "name", out);
}

static Napi::Object Cidfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "cidfrm(center: number) expects exactly one number argument")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const SpiceInt center = static_cast<SpiceInt>(info[0].As<Napi::Number>().Int32Value());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceInt frcode = 0;
  constexpr SpiceInt kNameMax = 256;
  SpiceChar frname[kNameMax + 1] = {0};
  SpiceBoolean found = SPICEFALSE;

  cidfrm_c(center, kNameMax, &frcode, frname, &found);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling cidfrm_c(center=") + std::to_string(center) + "):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  if (found == SPICEFALSE) {
    Napi::Object result = Napi::Object::New(env);
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("frcode", Napi::Number::New(env, static_cast<double>(frcode)));
  result.Set("frname", Napi::String::New(env, RTrim(frname)));
  return result;
}

static Napi::Object Cnmfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "cnmfrm(centerName: string) expects exactly one string argument")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const std::string centerName = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceInt frcode = 0;
  constexpr SpiceInt kNameMax = 256;
  SpiceChar frname[kNameMax + 1] = {0};
  SpiceBoolean found = SPICEFALSE;

  cnmfrm_c(centerName.c_str(), kNameMax, &frcode, frname, &found);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling cnmfrm_c(\"") + centerName + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  if (found == SPICEFALSE) {
    Napi::Object result = Napi::Object::New(env);
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("frcode", Napi::Number::New(env, static_cast<double>(frcode)));
  result.Set("frname", Napi::String::New(env, RTrim(frname)));
  return result;
}

static Napi::Number Scs2e(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    Napi::TypeError::New(env, "scs2e(sc: number, sclkch: string) expects (number, string)")
      .ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  const SpiceInt sc = static_cast<SpiceInt>(info[0].As<Napi::Number>().Int32Value());
  const std::string sclkch = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble et = 0.0;
  scs2e_c(sc, sclkch.c_str(), &et);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling scs2e_c(sc=") + std::to_string(sc) +
      ", sclkch=\"" + sclkch + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(et));
}

static Napi::String Sce2s(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "sce2s(sc: number, et: number) expects (number, number)")
      .ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  const SpiceInt sc = static_cast<SpiceInt>(info[0].As<Napi::Number>().Int32Value());
  const SpiceDouble et = static_cast<SpiceDouble>(info[1].As<Napi::Number>().DoubleValue());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  // Output length must include the terminating NUL.
  constexpr SpiceInt kOutMax = 2048;
  SpiceChar out[kOutMax] = {0};

  sce2s_c(sc, et, kOutMax, out);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling sce2s_c(sc=") + std::to_string(sc) +
      ", et=" + std::to_string(et) + "):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, RTrim(out));
}

static Napi::Object Ckgp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (
    info.Length() != 4 ||
    !info[0].IsNumber() ||
    !info[1].IsNumber() ||
    !info[2].IsNumber() ||
    !info[3].IsString()
  ) {
    Napi::TypeError::New(env, "ckgp(inst: number, sclkdp: number, tol: number, ref: string) expects (number, number, number, string)")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const SpiceInt inst = static_cast<SpiceInt>(info[0].As<Napi::Number>().Int32Value());
  const SpiceDouble sclkdp = static_cast<SpiceDouble>(info[1].As<Napi::Number>().DoubleValue());
  const SpiceDouble tol = static_cast<SpiceDouble>(info[2].As<Napi::Number>().DoubleValue());
  const std::string ref = info[3].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble cmat[3][3] = {{0}};
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgp_c(inst, sclkdp, tol, ref.c_str(), cmat, &clkout, &found);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling ckgp_c(inst=") + std::to_string(inst) +
      ", sclkdp=" + std::to_string(sclkdp) +
      ", tol=" + std::to_string(tol) +
      ", ref=\"" + ref + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  if (found == SPICEFALSE) {
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  double flat[9] = {0};
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      flat[i * 3 + j] = cmat[i][j];
    }
  }

  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("cmat", MakeNumberArray(env, flat, 9));
  result.Set("clkout", Napi::Number::New(env, static_cast<double>(clkout)));
  return result;
}

static Napi::Object Ckgpav(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (
    info.Length() != 4 ||
    !info[0].IsNumber() ||
    !info[1].IsNumber() ||
    !info[2].IsNumber() ||
    !info[3].IsString()
  ) {
    Napi::TypeError::New(env, "ckgpav(inst: number, sclkdp: number, tol: number, ref: string) expects (number, number, number, string)")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const SpiceInt inst = static_cast<SpiceInt>(info[0].As<Napi::Number>().Int32Value());
  const SpiceDouble sclkdp = static_cast<SpiceDouble>(info[1].As<Napi::Number>().DoubleValue());
  const SpiceDouble tol = static_cast<SpiceDouble>(info[2].As<Napi::Number>().DoubleValue());
  const std::string ref = info[3].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble cmat[3][3] = {{0}};
  SpiceDouble av[3] = {0};
  SpiceDouble clkout = 0.0;
  SpiceBoolean found = SPICEFALSE;

  ckgpav_c(inst, sclkdp, tol, ref.c_str(), cmat, av, &clkout, &found);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling ckgpav_c(inst=") + std::to_string(inst) +
      ", sclkdp=" + std::to_string(sclkdp) +
      ", tol=" + std::to_string(tol) +
      ", ref=\"" + ref + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  if (found == SPICEFALSE) {
    result.Set("found", Napi::Boolean::New(env, false));
    return result;
  }

  double flat[9] = {0};
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      flat[i * 3 + j] = cmat[i][j];
    }
  }

  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("cmat", MakeNumberArray(env, flat, 9));
  result.Set("av", MakeNumberArray(env, av, 3));
  result.Set("clkout", Napi::Number::New(env, static_cast<double>(clkout)));
  return result;
}

static Napi::Object Spkezr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (
    info.Length() != 5 ||
    !info[0].IsString() ||
    !info[1].IsNumber() ||
    !info[2].IsString() ||
    !info[3].IsString() ||
    !info[4].IsString()
  ) {
    Napi::TypeError::New(env, "spkezr(target: string, et: number, ref: string, abcorr: string, obs: string) expects (string, number, string, string, string)")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const SpiceDouble et = static_cast<SpiceDouble>(info[1].As<Napi::Number>().DoubleValue());
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string obs = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble state[6] = {0};
  SpiceDouble lt = 0;
  spkezr_c(target.c_str(), et, ref.c_str(), abcorr.c_str(), obs.c_str(), state, &lt);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling spkezr_c(target=\"") + target +
      "\", et=" + std::to_string(et) +
      ", ref=\"" + ref +
      "\", abcorr=\"" + abcorr +
      "\", obs=\"" + obs + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("state", MakeNumberArray(env, state, 6));
  result.Set("lt", Napi::Number::New(env, static_cast<double>(lt)));
  return result;
}

static Napi::Object Spkpos(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (
    info.Length() != 5 ||
    !info[0].IsString() ||
    !info[1].IsNumber() ||
    !info[2].IsString() ||
    !info[3].IsString() ||
    !info[4].IsString()
  ) {
    Napi::TypeError::New(env, "spkpos(target: string, et: number, ref: string, abcorr: string, obs: string) expects (string, number, string, string, string)")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const SpiceDouble et = static_cast<SpiceDouble>(info[1].As<Napi::Number>().DoubleValue());
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string obs = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble pos[3] = {0};
  SpiceDouble lt = 0;
  spkpos_c(target.c_str(), et, ref.c_str(), abcorr.c_str(), obs.c_str(), pos, &lt);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling spkpos_c(target=\"") + target +
      "\", et=" + std::to_string(et) +
      ", ref=\"" + ref +
      "\", abcorr=\"" + abcorr +
      "\", obs=\"" + obs + "\"):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("pos", MakeNumberArray(env, pos, 3));
  result.Set("lt", Napi::Number::New(env, static_cast<double>(lt)));
  return result;
}

static Napi::Array Pxform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "pxform(from: string, to: string, et: number) expects (string, string, number)")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  const std::string from = info[0].As<Napi::String>().Utf8Value();
  const std::string to = info[1].As<Napi::String>().Utf8Value();
  const SpiceDouble et = static_cast<SpiceDouble>(info[2].As<Napi::Number>().DoubleValue());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble rot[3][3] = {{0}};
  pxform_c(from.c_str(), to.c_str(), et, rot);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling pxform_c(from=\"") + from +
      "\", to=\"" + to +
      "\", et=" + std::to_string(et) + "):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  double flat[9] = {0};
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      flat[i * 3 + j] = rot[i][j];
    }
  }

  return MakeNumberArray(env, flat, 9);
}

static Napi::Array Sxform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "sxform(from: string, to: string, et: number) expects (string, string, number)")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  const std::string from = info[0].As<Napi::String>().Utf8Value();
  const std::string to = info[1].As<Napi::String>().Utf8Value();
  const SpiceDouble et = static_cast<SpiceDouble>(info[2].As<Napi::Number>().DoubleValue());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble xform[6][6] = {{0}};
  sxform_c(from.c_str(), to.c_str(), et, xform);
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling sxform_c(from=\"") + from +
      "\", to=\"" + to +
      "\", et=" + std::to_string(et) + "):\n" +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  double flat[36] = {0};
  for (int i = 0; i < 6; i++) {
    for (int j = 0; j < 6; j++) {
      flat[i * 6 + j] = xform[i][j];
    }
  }

  return MakeNumberArray(env, flat, 36);
}

static Napi::Object Reclat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    Napi::TypeError::New(env, "reclat(rect: number[3]) expects 1 argument")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!ReadNumberArray3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble radius = 0;
  SpiceDouble lon = 0;
  SpiceDouble lat = 0;
  reclat_c(rect, &radius, &lon, &lat);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling reclat_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("radius", Napi::Number::New(env, static_cast<double>(radius)));
  result.Set("lon", Napi::Number::New(env, static_cast<double>(lon)));
  result.Set("lat", Napi::Number::New(env, static_cast<double>(lat)));
  return result;
}

static Napi::Array Latrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "latrec(radius: number, lon: number, lat: number) expects (number, number, number)")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  const SpiceDouble radius = static_cast<SpiceDouble>(info[0].As<Napi::Number>().DoubleValue());
  const SpiceDouble lon = static_cast<SpiceDouble>(info[1].As<Napi::Number>().DoubleValue());
  const SpiceDouble lat = static_cast<SpiceDouble>(info[2].As<Napi::Number>().DoubleValue());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble rect[3] = {0};
  latrec_c(radius, lon, lat, rect);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling latrec_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, rect, 3);
}

static Napi::Object Recsph(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    Napi::TypeError::New(env, "recsph(rect: number[3]) expects 1 argument")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!ReadNumberArray3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble radius = 0;
  SpiceDouble colat = 0;
  SpiceDouble lon = 0;
  recsph_c(rect, &radius, &colat, &lon);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling recsph_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("radius", Napi::Number::New(env, static_cast<double>(radius)));
  result.Set("colat", Napi::Number::New(env, static_cast<double>(colat)));
  result.Set("lon", Napi::Number::New(env, static_cast<double>(lon)));
  return result;
}

static Napi::Array Sphrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "sphrec(radius: number, colat: number, lon: number) expects (number, number, number)")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  const SpiceDouble radius = static_cast<SpiceDouble>(info[0].As<Napi::Number>().DoubleValue());
  const SpiceDouble colat = static_cast<SpiceDouble>(info[1].As<Napi::Number>().DoubleValue());
  const SpiceDouble lon = static_cast<SpiceDouble>(info[2].As<Napi::Number>().DoubleValue());

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble rect[3] = {0};
  sphrec_c(radius, colat, lon, rect);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling sphrec_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, rect, 3);
}

static Napi::Number Vnorm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    Napi::TypeError::New(env, "vnorm(v: number[3]) expects 1 argument")
      .ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  double v[3] = {0};
  if (!ReadNumberArray3(env, info[0], v, "v")) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble out = vnorm_c(v);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling vnorm_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(out));
}

static Napi::Array Vhat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    Napi::TypeError::New(env, "vhat(v: number[3]) expects 1 argument")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  double v[3] = {0};
  if (!ReadNumberArray3(env, info[0], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble out[3] = {0};
  vhat_c(v, out);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling vhat_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Number Vdot(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    Napi::TypeError::New(env, "vdot(a: number[3], b: number[3]) expects 2 arguments")
      .ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!ReadNumberArray3(env, info[0], a, "a") || !ReadNumberArray3(env, info[1], b, "b")) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble out = vdot_c(a, b);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling vdot_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(out));
}

static Napi::Array Vcrss(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    Napi::TypeError::New(env, "vcrss(a: number[3], b: number[3]) expects 2 arguments")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!ReadNumberArray3(env, info[0], a, "a") || !ReadNumberArray3(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble out[3] = {0};
  vcrss_c(a, b, out);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling vcrss_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Mxv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    Napi::TypeError::New(env, "mxv(m: number[9], v: number[3]) expects 2 arguments")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  double m[3][3] = {{0}};
  double v[3] = {0};
  if (!ReadNumberArray9ToMat33(env, info[0], m, "m") || !ReadNumberArray3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble out[3] = {0};
  mxv_c(m, v, out);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling mxv_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Mtxv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    Napi::TypeError::New(env, "mtxv(m: number[9], v: number[3]) expects 2 arguments")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  double m[3][3] = {{0}};
  double v[3] = {0};
  if (!ReadNumberArray9ToMat33(env, info[0], m, "m") || !ReadNumberArray3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  InitCspiceErrorHandlingOnce();

  SpiceDouble out[3] = {0};
  mtxv_c(m, v, out);
  if (failed_c()) {
    const std::string msg = std::string("CSPICE failed while calling mtxv_c():\n") +
      GetSpiceErrorMessageAndReset();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
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
  exports.Set("bodn2c", Napi::Function::New(env, Bodn2c));
  exports.Set("bodc2n", Napi::Function::New(env, Bodc2n));
  exports.Set("namfrm", Napi::Function::New(env, Namfrm));
  exports.Set("frmnam", Napi::Function::New(env, Frmnam));
  exports.Set("cidfrm", Napi::Function::New(env, Cidfrm));
  exports.Set("cnmfrm", Napi::Function::New(env, Cnmfrm));
  exports.Set("scs2e", Napi::Function::New(env, Scs2e));
  exports.Set("sce2s", Napi::Function::New(env, Sce2s));
  exports.Set("ckgp", Napi::Function::New(env, Ckgp));
  exports.Set("ckgpav", Napi::Function::New(env, Ckgpav));
  exports.Set("spkezr", Napi::Function::New(env, Spkezr));
  exports.Set("spkpos", Napi::Function::New(env, Spkpos));
  exports.Set("pxform", Napi::Function::New(env, Pxform));
  exports.Set("sxform", Napi::Function::New(env, Sxform));

  exports.Set("reclat", Napi::Function::New(env, Reclat));
  exports.Set("latrec", Napi::Function::New(env, Latrec));
  exports.Set("recsph", Napi::Function::New(env, Recsph));
  exports.Set("sphrec", Napi::Function::New(env, Sphrec));

  exports.Set("vnorm", Napi::Function::New(env, Vnorm));
  exports.Set("vhat", Napi::Function::New(env, Vhat));
  exports.Set("vdot", Napi::Function::New(env, Vdot));
  exports.Set("vcrss", Napi::Function::New(env, Vcrss));
  exports.Set("mxv", Napi::Function::New(env, Mxv));
  exports.Set("mtxv", Napi::Function::New(env, Mtxv));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
