#include <napi.h>

#include <mutex>
#include <string>
#include <vector>

extern "C" {
#include "tspice_backend_shim.h"
}

// Forces a rebuild/relink when the resolved CSPICE install changes (cache/toolkit bump
// or TSPICE_CSPICE_DIR override).
#include "cspice_stamp.h"

// The value of TSPICE_CSPICE_STAMP is not used at runtime; this exists solely to create a
// compile-time dependency on the generated header so changes to the CSPICE toolkit/config
// trigger a rebuild.
static_assert(sizeof(TSPICE_CSPICE_STAMP) > 0, "TSPICE_CSPICE_STAMP must be non-empty");

static std::mutex g_cspice_mutex;

static Napi::String SpiceVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    Napi::TypeError::New(env, "spiceVersion() does not take any arguments").ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char out[256];
  char err[2048];

  const int rc = tspice_tkvrsn_toolkit(out, (int)sizeof(out), err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_tkvrsn_toolkit():\n") + err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Value Furnsh(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "furnsh(path) expects a single string argument").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int rc = tspice_furnsh(path.c_str(), err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_furnsh(\"") + path + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

static Napi::Value Unload(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "unload(path) expects a single string argument").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int rc = tspice_unload(path.c_str(), err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_unload(\"") + path + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

static Napi::Value Kclear(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    Napi::TypeError::New(env, "kclear() does not take any arguments").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int rc = tspice_kclear(err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_kclear():\n") +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  return env.Undefined();
}

static Napi::Number Ktotal(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() > 1 || (info.Length() == 1 && !info[0].IsString())) {
    Napi::TypeError::New(env, "ktotal(kind?) expects (string?)").ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  const std::string kind = info.Length() == 1 ? info[0].As<Napi::String>().Utf8Value() : "ALL";

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  int count = 0;
  const int rc = tspice_ktotal(kind.c_str(), &count, err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_ktotal(\"") + kind + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(count));
}

static Napi::Object Kdata(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || info.Length() > 2 || !info[0].IsNumber() ||
      (info.Length() == 2 && !info[1].IsString())) {
    Napi::TypeError::New(env, "kdata(which, kind?) expects (number, string?)")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const int which = info[0].As<Napi::Number>().Int32Value();
  const std::string kind = info.Length() == 2 ? info[1].As<Napi::String>().Utf8Value() : "ALL";

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  char file[2048];
  char filtyp[256];
  char source[2048];
  int handle = 0;
  int found = 0;

  const int rc = tspice_kdata(
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

  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_kdata(which=") + std::to_string(which) +
      ", kind=\"" + kind + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("found", Napi::Boolean::New(env, found != 0));
  if (found != 0) {
    out.Set("file", Napi::String::New(env, file));
    out.Set("filtyp", Napi::String::New(env, filtyp));
    out.Set("source", Napi::String::New(env, source));
    out.Set("handle", Napi::Number::New(env, static_cast<double>(handle)));
  }
  return out;
}

static Napi::Number KtotalAll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    Napi::TypeError::New(env, "__ktotalAll() does not take any arguments").ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int count = tspice_ktotal_all(err, (int)sizeof(err));
  if (count < 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_ktotal_all():\n") +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(count));
}

static Napi::Number Str2et(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "str2et(time) expects a single string argument").ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  const std::string time = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  double et = 0.0;
  const int rc = tspice_str2et(time.c_str(), &et, err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_str2et(\"") + time + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Et2utc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "et2utc(et, format, prec) expects (number, string, number)")
      .ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string format = info[1].As<Napi::String>().Utf8Value();
  const int prec = info[2].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int outMaxBytes = 256;
  std::vector<char> out((size_t)outMaxBytes);
  const int rc = tspice_et2utc(et, format.c_str(), prec, out.data(), outMaxBytes, err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_et2utc(et, \"") + format + "\", " +
      std::to_string(prec) + "):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out.data());
}

static Napi::String Timout(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    Napi::TypeError::New(env, "timout(et, picture) expects (number, string)")
      .ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string picture = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  const int outMaxBytes = 2048;
  std::vector<char> out((size_t)outMaxBytes);
  const int rc = tspice_timout(
    et,
    picture.c_str(),
    out.data(),
    outMaxBytes,
    err,
    (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_timout(et, \"") + picture + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out.data());
}

static Napi::Array Pxform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "pxform(from, to, et) expects (string, string, number)")
      .ThrowAsJavaScriptException();
    return Napi::Array::New(env, 0);
  }

  const std::string from = info[0].As<Napi::String>().Utf8Value();
  const std::string to = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  double m[9];
  const int rc = tspice_pxform(from.c_str(), to.c_str(), et, m, err, (int)sizeof(err));
  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_pxform(\"") + from + "\", \"" + to +
      "\", et):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Array::New(env, 0);
  }

  Napi::Array out = Napi::Array::New(env, 9);
  for (uint32_t i = 0; i < 9; i++) {
    out.Set(i, Napi::Number::New(env, m[i]));
  }
  return out;
}

static Napi::Object Spkezr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString()) {
    Napi::TypeError::New(env, "spkezr(target, et, ref, abcorr, observer) expects (string, number, string, string, string)")
      .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string observer = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[2048];
  double state[6];
  double lt = 0.0;

  const int rc = tspice_spkezr(
    target.c_str(),
    et,
    ref.c_str(),
    abcorr.c_str(),
    observer.c_str(),
    state,
    &lt,
    err,
    (int)sizeof(err));

  if (rc != 0) {
    const std::string msg =
      std::string("CSPICE failed while calling tspice_spkezr(\"") + target + "\", et, \"" + ref +
      "\", \"" + abcorr + "\", \"" + observer + "\"):\n" +
      err;
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Array stateArr = Napi::Array::New(env, 6);
  for (uint32_t i = 0; i < 6; i++) {
    stateArr.Set(i, Napi::Number::New(env, state[i]));
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("state", stateArr);
  out.Set("lt", Napi::Number::New(env, lt));
  return out;
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
  exports.Set("pxform", Napi::Function::New(env, Pxform));
  exports.Set("spkezr", Napi::Function::New(env, Spkezr));

  // Internal test helper (not part of the backend contract).
  exports.Set("__ktotalAll", Napi::Function::New(env, KtotalAll));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
