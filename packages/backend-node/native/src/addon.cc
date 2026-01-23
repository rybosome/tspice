#include <napi.h>

#include <mutex>
#include <string>

#include "napi_helpers.h"
#include "tspice_backend_shim.h"

// Forces a rebuild/relink when the resolved CSPICE install changes (cache/toolkit bump
// or TSPICE_CSPICE_DIR override).
#include "cspice_stamp.h"

// The value of TSPICE_CSPICE_STAMP is not used at runtime; this exists solely to create a
// compile-time dependency on the generated header so changes to the CSPICE toolkit/config
// trigger a rebuild.
static_assert(sizeof(TSPICE_CSPICE_STAMP) > 0, "TSPICE_CSPICE_STAMP must be non-empty");

static std::mutex g_cspice_mutex;

constexpr int kErrMaxBytes = 2048;
constexpr int kOutMaxBytes = 2048;

using tspice_napi::MakeFound;
using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::ThrowSpiceError;

static bool ReadNumberArrayFixed(
    Napi::Env env,
    const Napi::Value& value,
    size_t expectedLength,
    double* out,
    const char* name) {
  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, std::string(name) + " must be an array"));
    return false;
  }

  Napi::Array arr = value.As<Napi::Array>();
  if (arr.Length() != expectedLength) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        std::string(name) + " must have length " + std::to_string(expectedLength)));
    return false;
  }

  for (uint32_t i = 0; i < expectedLength; i++) {
    const Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      ThrowSpiceError(
          Napi::TypeError::New(env, std::string(name) + " must contain only numbers"));
      return false;
    }
    out[i] = v.As<Napi::Number>().DoubleValue();
  }

  return true;
}

static bool ReadVec3(Napi::Env env, const Napi::Value& value, double out[3], const char* name) {
  return ReadNumberArrayFixed(env, value, 3, out, name);
}

static bool ReadMat33RowMajor(
    Napi::Env env,
    const Napi::Value& value,
    double out[9],
    const char* name) {
  return ReadNumberArrayFixed(env, value, 9, out, name);
}

static Napi::String SpiceVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "spiceVersion() does not take any arguments"));
    return Napi::String::New(env, "");
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char out[kOutMaxBytes];
  char err[kErrMaxBytes];
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
    ThrowSpiceError(Napi::TypeError::New(env, "furnsh(path: string) expects exactly one string argument"));
    return;
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  const int code = tspice_furnsh(path.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling furnsh(\"") + path + "\")", err);
  }
}

static void Unload(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "unload(path: string) expects exactly one string argument"));
    return;
  }

  const std::string path = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  const int code = tspice_unload(path.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling unload(\"") + path + "\")", err);
  }
}

static void Kclear(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "kclear() does not take any arguments"));
    return;
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
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

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  int count = 0;
  const int code = tspice_ktotal(kind.c_str(), &count, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling ktotal(\"") + kind + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(count));
}

static Napi::Object Kdata(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || info.Length() > 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "kdata(which: number, kind?: string) expects 1 or 2 arguments"));
    return Napi::Object::New(env);
  }

  if (!info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "kdata(which: number, kind?: string) expects which to be a number"));
    return Napi::Object::New(env);
  }

  const int which = info[0].As<Napi::Number>().Int32Value();
  std::string kind = "ALL";
  if (info.Length() == 2) {
    if (!info[1].IsString()) {
      ThrowSpiceError(Napi::TypeError::New(env, "kdata(which: number, kind?: string) expects kind to be a string"));
      return Napi::Object::New(env);
    }
    kind = info[1].As<Napi::String>().Utf8Value();
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  char file[kOutMaxBytes];
  char filtyp[kOutMaxBytes];
  char source[kOutMaxBytes];
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
    (int)sizeof(err)
  );

  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling kdata(which=") + std::to_string(which) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("file", Napi::String::New(env, file));
  result.Set("filtyp", Napi::String::New(env, filtyp));
  result.Set("source", Napi::String::New(env, source));
  result.Set("handle", Napi::Number::New(env, static_cast<double>(handle)));
  return result;
}

static Napi::Number KtotalAll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "__ktotalAll() does not take any arguments"));
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  const int total = tspice_ktotal_all(err, (int)sizeof(err));
  if (total < 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ktotal(\"ALL\")", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, static_cast<double>(total));
}

static Napi::Number Str2et(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "str2et(time: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string time = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_str2et(time.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling str2et(\"") + time + "\")", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Et2utc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(
      Napi::TypeError::New(env, "et2utc(et: number, format: string, prec: number) expects (number, string, number)")
    );
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string format = info[1].As<Napi::String>().Utf8Value();
  const int prec = info[2].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  char out[kOutMaxBytes];
  const int code = tspice_et2utc(et, format.c_str(), prec, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling et2utc", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::String Timout(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "timout(et: number, picture: string) expects (number, string)"));
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string picture = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  char out[kOutMaxBytes];
  const int code = tspice_timout(et, picture.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling timout", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Object Bodn2c(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "bodn2c(name: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
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
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  char nameOut[kOutMaxBytes];
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

static Napi::Object Namfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "namfrm(name: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  int codeOut = 0;
  int found = 0;
  const int code = tspice_namfrm(name.c_str(), &codeOut, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling namfrm(\"") + name + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<double>(env, "code", static_cast<double>(codeOut));
}

static Napi::Object Frmnam(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "frmnam(code: number) expects exactly one number argument"));
    return Napi::Object::New(env);
  }

  const int codeIn = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  char nameOut[kOutMaxBytes];
  int found = 0;
  const int code = tspice_frmnam(codeIn, nameOut, (int)sizeof(nameOut), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling frmnam(") + std::to_string(codeIn) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  return MakeFound<const char*>(env, "name", nameOut);
}

static Napi::Object Cidfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cidfrm(center: number) expects exactly one number argument"));
    return Napi::Object::New(env);
  }

  const int center = info[0].As<Napi::Number>().Int32Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  char frname[kOutMaxBytes];
  int frcode = 0;
  int found = 0;
  const int code = tspice_cidfrm(center, &frcode, frname, (int)sizeof(frname), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling cidfrm(") + std::to_string(center) + ")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("frcode", Napi::Number::New(env, static_cast<double>(frcode)));
  result.Set("frname", Napi::String::New(env, frname));
  return result;
}

static Napi::Object Cnmfrm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "cnmfrm(centerName: string) expects exactly one string argument"));
    return Napi::Object::New(env);
  }

  const std::string centerName = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(g_cspice_mutex);

  char err[kErrMaxBytes];
  char frname[kOutMaxBytes];
  int frcode = 0;
  int found = 0;
  const int code = tspice_cnmfrm(centerName.c_str(), &frcode, frname, (int)sizeof(frname), &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, std::string("CSPICE failed while calling cnmfrm(\"") + centerName + "\")", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("frcode", Napi::Number::New(env, static_cast<double>(frcode)));
  result.Set("frname", Napi::String::New(env, frname));
  return result;
}

static Napi::Number Scs2e(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "scs2e(sc: number, sclkch: string) expects (number, string)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const std::string sclkch = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_scs2e(sc, sclkch.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scs2e", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Sce2s(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sce2s(sc: number, et: number) expects (number, number)"));
    return Napi::String::New(env, "");
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  char out[kOutMaxBytes];
  const int code = tspice_sce2s(sc, et, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sce2s", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Object Ckgp(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
      !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckgp(inst: number, sclkdp: number, tol: number, ref: string) expects (number, number, number, string)"));
    return Napi::Object::New(env);
  }

  const int inst = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();
  const double tol = info[2].As<Napi::Number>().DoubleValue();
  const std::string ref = info[3].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double cmat[9] = {0};
  double clkout = 0.0;
  int found = 0;
  const int code = tspice_ckgp(inst, sclkdp, tol, ref.c_str(), cmat, &clkout, &found, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckgp", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("cmat", MakeNumberArray(env, cmat, 9));
  result.Set("clkout", Napi::Number::New(env, clkout));
  return result;
}

static Napi::Object Ckgpav(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 4 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
      !info[3].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ckgpav(inst: number, sclkdp: number, tol: number, ref: string) expects (number, number, number, string)"));
    return Napi::Object::New(env);
  }

  const int inst = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();
  const double tol = info[2].As<Napi::Number>().DoubleValue();
  const std::string ref = info[3].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double cmat[9] = {0};
  double av[3] = {0};
  double clkout = 0.0;
  int found = 0;
  const int code = tspice_ckgpav(
    inst,
    sclkdp,
    tol,
    ref.c_str(),
    cmat,
    av,
    &clkout,
    &found,
    err,
    (int)sizeof(err)
  );
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ckgpav", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("cmat", MakeNumberArray(env, cmat, 9));
  result.Set("av", MakeNumberArray(env, av, 3));
  result.Set("clkout", Napi::Number::New(env, clkout));
  return result;
}

static Napi::Object Spkezr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
      env,
      "spkezr(target: string, et: number, ref: string, abcorr: string, observer: string) expects (string, number, string, string, string)"
    ));
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string observer = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double state[6] = {0};
  double lt = 0.0;
  const int code = tspice_spkezr(
    target.c_str(),
    et,
    ref.c_str(),
    abcorr.c_str(),
    observer.c_str(),
    state,
    &lt,
    err,
    (int)sizeof(err)
  );
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkezr", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("state", MakeNumberArray(env, state, 6));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Object Spkpos(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsString() || !info[1].IsNumber() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
      env,
      "spkpos(target: string, et: number, ref: string, abcorr: string, observer: string) expects (string, number, string, string, string)"
    ));
    return Napi::Object::New(env);
  }

  const std::string target = info[0].As<Napi::String>().Utf8Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();
  const std::string ref = info[2].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[3].As<Napi::String>().Utf8Value();
  const std::string observer = info[4].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double pos[3] = {0};
  double lt = 0.0;
  const int code = tspice_spkpos(
    target.c_str(),
    et,
    ref.c_str(),
    abcorr.c_str(),
    observer.c_str(),
    pos,
    &lt,
    err,
    (int)sizeof(err)
  );
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling spkpos", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("pos", MakeNumberArray(env, pos, 3));
  result.Set("lt", Napi::Number::New(env, lt));
  return result;
}

static Napi::Object Subpnt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 6 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
      env,
      "subpnt(method: string, target: string, et: number, fixref: string, abcorr: string, observer: string) expects (string, string, number, string, string, string)"
    ));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[3].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[4].As<Napi::String>().Utf8Value();
  const std::string observer = info[5].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double spoint[3] = {0};
  double trgepc = 0.0;
  double srfvec[3] = {0};
  const int code = tspice_subpnt(
    method.c_str(),
    target.c_str(),
    et,
    fixref.c_str(),
    abcorr.c_str(),
    observer.c_str(),
    spoint,
    &trgepc,
    srfvec,
    err,
    (int)sizeof(err)
  );
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling subpnt", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("spoint", MakeNumberArray(env, spoint, 3));
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  return result;
}

static Napi::Object Subslr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 6 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
      env,
      "subslr(method: string, target: string, et: number, fixref: string, abcorr: string, observer: string) expects (string, string, number, string, string, string)"
    ));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[3].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[4].As<Napi::String>().Utf8Value();
  const std::string observer = info[5].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double spoint[3] = {0};
  double trgepc = 0.0;
  double srfvec[3] = {0};
  const int code = tspice_subslr(
    method.c_str(),
    target.c_str(),
    et,
    fixref.c_str(),
    abcorr.c_str(),
    observer.c_str(),
    spoint,
    &trgepc,
    srfvec,
    err,
    (int)sizeof(err)
  );
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling subslr", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("spoint", MakeNumberArray(env, spoint, 3));
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  return result;
}

static Napi::Object Sincpt(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 8 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString() || !info[6].IsString() ||
      !info[7].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(
      env,
      "sincpt(method: string, target: string, et: number, fixref: string, abcorr: string, observer: string, dref: string, dvec: number[3]) expects (string, string, number, string, string, string, string, number[])"
    ));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[3].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[4].As<Napi::String>().Utf8Value();
  const std::string observer = info[5].As<Napi::String>().Utf8Value();
  const std::string dref = info[6].As<Napi::String>().Utf8Value();

  Napi::Array dvecArr = info[7].As<Napi::Array>();
  if (dvecArr.Length() != 3 || !dvecArr.Get((uint32_t)0).IsNumber() || !dvecArr.Get((uint32_t)1).IsNumber() ||
      !dvecArr.Get((uint32_t)2).IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sincpt(..., dvec) expects dvec to be a length-3 number array"));
    return Napi::Object::New(env);
  }
  double dvec[3] = {
    dvecArr.Get((uint32_t)0).As<Napi::Number>().DoubleValue(),
    dvecArr.Get((uint32_t)1).As<Napi::Number>().DoubleValue(),
    dvecArr.Get((uint32_t)2).As<Napi::Number>().DoubleValue(),
  };

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double spoint[3] = {0};
  double trgepc = 0.0;
  double srfvec[3] = {0};
  int found = 0;
  const int code = tspice_sincpt(
    method.c_str(),
    target.c_str(),
    et,
    fixref.c_str(),
    abcorr.c_str(),
    observer.c_str(),
    dref.c_str(),
    dvec,
    spoint,
    &trgepc,
    srfvec,
    &found,
    err,
    (int)sizeof(err)
  );
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sincpt", err);
    return Napi::Object::New(env);
  }

  if (!found) {
    return MakeNotFound(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("found", Napi::Boolean::New(env, true));
  result.Set("spoint", MakeNumberArray(env, spoint, 3));
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  return result;
}

static Napi::Object Ilumin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 7 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString() || !info[6].IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(
      env,
      "ilumin(method: string, target: string, et: number, fixref: string, abcorr: string, observer: string, spoint: number[3]) expects (string, string, number, string, string, string, number[])"
    ));
    return Napi::Object::New(env);
  }

  const std::string method = info[0].As<Napi::String>().Utf8Value();
  const std::string target = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();
  const std::string fixref = info[3].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[4].As<Napi::String>().Utf8Value();
  const std::string observer = info[5].As<Napi::String>().Utf8Value();

  Napi::Array spointArr = info[6].As<Napi::Array>();
  if (spointArr.Length() != 3 || !spointArr.Get((uint32_t)0).IsNumber() || !spointArr.Get((uint32_t)1).IsNumber() ||
      !spointArr.Get((uint32_t)2).IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ilumin(..., spoint) expects spoint to be a length-3 number array"));
    return Napi::Object::New(env);
  }
  double spoint[3] = {
    spointArr.Get((uint32_t)0).As<Napi::Number>().DoubleValue(),
    spointArr.Get((uint32_t)1).As<Napi::Number>().DoubleValue(),
    spointArr.Get((uint32_t)2).As<Napi::Number>().DoubleValue(),
  };

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double trgepc = 0.0;
  double srfvec[3] = {0};
  double observerIlluminatorAngle = 0.0;
  double incdnc = 0.0;
  double emissn = 0.0;
  const int code = tspice_ilumin(
    method.c_str(),
    target.c_str(),
    et,
    fixref.c_str(),
    abcorr.c_str(),
    observer.c_str(),
    spoint,
    &trgepc,
    srfvec,
    &observerIlluminatorAngle,
    &incdnc,
    &emissn,
    err,
    (int)sizeof(err)
  );
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ilumin", err);
    return Napi::Object::New(env);
  }

  Napi::Object result = Napi::Object::New(env);
  result.Set("trgepc", Napi::Number::New(env, trgepc));
  result.Set("srfvec", MakeNumberArray(env, srfvec, 3));
  result.Set("observerIlluminatorAngle", Napi::Number::New(env, observerIlluminatorAngle));
  result.Set("incdnc", Napi::Number::New(env, incdnc));
  result.Set("emissn", Napi::Number::New(env, emissn));
  return result;
}

static Napi::Number Occult(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 9 || !info[0].IsString() || !info[1].IsString() || !info[2].IsString() ||
      !info[3].IsString() || !info[4].IsString() || !info[5].IsString() || !info[6].IsString() ||
      !info[7].IsString() || !info[8].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
      env,
      "occult(targ1: string, shape1: string, frame1: string, targ2: string, shape2: string, frame2: string, abcorr: string, observer: string, et: number) expects (string, string, string, string, string, string, string, string, number)"
    ));
    return Napi::Number::New(env, 0);
  }

  const std::string targ1 = info[0].As<Napi::String>().Utf8Value();
  const std::string shape1 = info[1].As<Napi::String>().Utf8Value();
  const std::string frame1 = info[2].As<Napi::String>().Utf8Value();
  const std::string targ2 = info[3].As<Napi::String>().Utf8Value();
  const std::string shape2 = info[4].As<Napi::String>().Utf8Value();
  const std::string frame2 = info[5].As<Napi::String>().Utf8Value();
  const std::string abcorr = info[6].As<Napi::String>().Utf8Value();
  const std::string observer = info[7].As<Napi::String>().Utf8Value();
  const double et = info[8].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  int ocltid = 0;
  const int code = tspice_occult(
    targ1.c_str(),
    shape1.c_str(),
    frame1.c_str(),
    targ2.c_str(),
    shape2.c_str(),
    frame2.c_str(),
    abcorr.c_str(),
    observer.c_str(),
    et,
    &ocltid,
    err,
    (int)sizeof(err)
  );
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling occult", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, static_cast<double>(ocltid));
}

static Napi::Array Pxform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "pxform(from: string, to: string, et: number) expects (string, string, number)"));
    return Napi::Array::New(env);
  }

  const std::string from = info[0].As<Napi::String>().Utf8Value();
  const std::string to = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double m[9] = {0};
  const int code = tspice_pxform(from.c_str(), to.c_str(), et, m, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling pxform", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, m, 9);
}

static Napi::Array Sxform(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sxform(from: string, to: string, et: number) expects (string, string, number)"));
    return Napi::Array::New(env);
  }

  const std::string from = info[0].As<Napi::String>().Utf8Value();
  const std::string to = info[1].As<Napi::String>().Utf8Value();
  const double et = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double m[36] = {0};
  const int code = tspice_sxform(from.c_str(), to.c_str(), et, m, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sxform", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, m, 36);
}

static Napi::Object Reclat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "reclat(rect: number[3]) expects 1 argument"));
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!ReadVec3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double radius = 0.0;
  double lon = 0.0;
  double lat = 0.0;
  const int code = tspice_reclat(rect, &radius, &lon, &lat, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling reclat", err);
    return Napi::Object::New(env);
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, radius));
  out.Set("lon", Napi::Number::New(env, lon));
  out.Set("lat", Napi::Number::New(env, lat));
  return out;
}

static Napi::Array Latrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "latrec(radius: number, lon: number, lat: number) expects (number, number, number)"));
    return Napi::Array::New(env);
  }

  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();
  const double lat = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double rect[3] = {0};
  const int code = tspice_latrec(radius, lon, lat, rect, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling latrec", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, rect, 3);
}

static Napi::Object Recsph(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "recsph(rect: number[3]) expects 1 argument"));
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!ReadVec3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double radius = 0.0;
  double colat = 0.0;
  double lon = 0.0;
  const int code = tspice_recsph(rect, &radius, &colat, &lon, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling recsph", err);
    return Napi::Object::New(env);
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("radius", Napi::Number::New(env, radius));
  out.Set("colat", Napi::Number::New(env, colat));
  out.Set("lon", Napi::Number::New(env, lon));
  return out;
}

static Napi::Array Sphrec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "sphrec(radius: number, colat: number, lon: number) expects (number, number, number)"));
    return Napi::Array::New(env);
  }

  const double radius = info[0].As<Napi::Number>().DoubleValue();
  const double colat = info[1].As<Napi::Number>().DoubleValue();
  const double lon = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double rect[3] = {0};
  const int code = tspice_sphrec(radius, colat, lon, rect, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sphrec", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, rect, 3);
}

static Napi::Number Vnorm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vnorm(v: number[3]) expects 1 argument"));
    return Napi::Number::New(env, 0);
  }

  double v[3] = {0};
  if (!ReadVec3(env, info[0], v, "v")) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double out = 0.0;
  const int code = tspice_vnorm(v, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vnorm", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, out);
}

static Napi::Array Vhat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vhat(v: number[3]) expects 1 argument"));
    return Napi::Array::New(env);
  }

  double v[3] = {0};
  if (!ReadVec3(env, info[0], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vhat(v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vhat", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Number Vdot(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vdot(a: number[3], b: number[3]) expects 2 arguments"));
    return Napi::Number::New(env, 0);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!ReadVec3(env, info[0], a, "a")) {
    return Napi::Number::New(env, 0);
  }
  if (!ReadVec3(env, info[1], b, "b")) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double out = 0.0;
  const int code = tspice_vdot(a, b, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vdot", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, out);
}

static Napi::Array Vcrss(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vcrss(a: number[3], b: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!ReadVec3(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!ReadVec3(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vcrss(a, b, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vcrss", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Mxv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "mxv(m: number[9], v: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double m[9] = {0};
  double v[3] = {0};
  if (!ReadMat33RowMajor(env, info[0], m, "m")) {
    return Napi::Array::New(env);
  }
  if (!ReadVec3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_mxv(m, v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mxv", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Mtxv(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "mtxv(m: number[9], v: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double m[9] = {0};
  double v[3] = {0};
  if (!ReadMat33RowMajor(env, info[0], m, "m")) {
    return Napi::Array::New(env);
  }
  if (!ReadVec3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(g_cspice_mutex);
  char err[kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_mtxv(m, v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mtxv", err);
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
  exports.Set("__ktotalAll", Napi::Function::New(env, KtotalAll));
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
  exports.Set("subpnt", Napi::Function::New(env, Subpnt));
  exports.Set("subslr", Napi::Function::New(env, Subslr));
  exports.Set("sincpt", Napi::Function::New(env, Sincpt));
  exports.Set("ilumin", Napi::Function::New(env, Ilumin));
  exports.Set("occult", Napi::Function::New(env, Occult));
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
