#include "time.h"

#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::SetExportChecked;
using tspice_napi::PreviewForError;
using tspice_napi::ThrowSpiceError;

static Napi::Number Str2et(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "str2et(time: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string time = info[0].As<Napi::String>().Utf8Value();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char err[tspice_backend_node::kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_str2et(time.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling str2et(\"") + PreviewForError(time) + "\")",
        err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Et2utc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "et2utc(et: number, format: string, prec: number) expects (number, string, number)"));
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string format = info[1].As<Napi::String>().Utf8Value();
  const int prec = info[2].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code =
      tspice_et2utc(et, format.c_str(), prec, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling et2utc", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::String Timout(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "timout(et: number, picture: string) expects (number, string)"));
    return Napi::String::New(env, "");
  }

  const double et = info[0].As<Napi::Number>().DoubleValue();
  const std::string picture = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_timout(et, picture.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling timout", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Number Deltet(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "deltet(epoch: number, eptype: string) expects (number, string)"));
    return Napi::Number::New(env, 0);
  }

  const double epoch = info[0].As<Napi::Number>().DoubleValue();
  const std::string eptype = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double delta = 0.0;
  const int code = tspice_deltet(epoch, eptype.c_str(), &delta, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling deltet", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, delta);
}

static Napi::Number Unitim(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsString() || !info[2].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "unitim(epoch: number, insys: string, outsys: string) expects (number, string, string)"));
    return Napi::Number::New(env, 0);
  }

  const double epoch = info[0].As<Napi::Number>().DoubleValue();
  const std::string insys = info[1].As<Napi::String>().Utf8Value();
  const std::string outsys = info[2].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double outEpoch = 0.0;
  const int code =
      tspice_unitim(epoch, insys.c_str(), outsys.c_str(), &outEpoch, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling unitim", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, outEpoch);
}

static Napi::Number Tparse(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "tparse(timstr: string) expects exactly one string argument"));
    return Napi::Number::New(env, 0);
  }

  const std::string timstr = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_tparse(timstr.c_str(), &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(
        env,
        std::string("CSPICE failed while calling tparse(\"") + PreviewForError(timstr) + "\")",
        err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::String Tpictr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "tpictr(sample: string, pictur: string) expects exactly two string arguments"));
    return Napi::String::New(env, "");
  }

  const std::string sample = info[0].As<Napi::String>().Utf8Value();
  const std::string picturIn = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code =
      tspice_tpictr(sample.c_str(), picturIn.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling tpictr", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::String TimdefGet(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "timdefGet(item: string) expects exactly one string argument"));
    return Napi::String::New(env, "");
  }

  const std::string item = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_timdef_get(item.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling timdef(GET)", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static void TimdefSet(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsString() || !info[1].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "timdefSet(item: string, value: string) expects (string, string)"));
    return;
  }

  const std::string item = info[0].As<Napi::String>().Utf8Value();
  const std::string value = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_timdef_set(item.c_str(), value.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling timdef(SET)", err);
  }
}

static Napi::Number Scs2e(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "scs2e(sc: number, sclkch: string) expects (number, string)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const std::string sclkch = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_sce2s(sc, et, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sce2s", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Number Scencd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "scencd(sc: number, sclkch: string) expects (number, string)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const std::string sclkch = info[1].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double sclkdp = 0.0;
  const int code = tspice_scencd(sc, sclkch.c_str(), &sclkdp, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scencd", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, sclkdp);
}

static Napi::String Scdecd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "scdecd(sc: number, sclkdp: number) expects (number, number)"));
    return Napi::String::New(env, "");
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  char out[tspice_backend_node::kOutMaxBytes];
  const int code = tspice_scdecd(sc, sclkdp, out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scdecd", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static Napi::Number Sct2e(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sct2e(sc: number, sclkdp: number) expects (number, number)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double sclkdp = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double et = 0.0;
  const int code = tspice_sct2e(sc, sclkdp, &et, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sct2e", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, et);
}

static Napi::Number Sce2c(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sce2c(sc: number, et: number) expects (number, number)"));
    return Napi::Number::New(env, 0);
  }

  const int sc = info[0].As<Napi::Number>().Int32Value();
  const double et = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double sclkdp = 0.0;
  const int code = tspice_sce2c(sc, et, &sclkdp, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sce2c", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, sclkdp);
}

namespace tspice_backend_node {

void RegisterTime(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "str2et", Napi::Function::New(env, Str2et), __func__)) return;
  if (!SetExportChecked(env, exports, "et2utc", Napi::Function::New(env, Et2utc), __func__)) return;
  if (!SetExportChecked(env, exports, "timout", Napi::Function::New(env, Timout), __func__)) return;

  if (!SetExportChecked(env, exports, "deltet", Napi::Function::New(env, Deltet), __func__)) return;
  if (!SetExportChecked(env, exports, "unitim", Napi::Function::New(env, Unitim), __func__)) return;
  if (!SetExportChecked(env, exports, "tparse", Napi::Function::New(env, Tparse), __func__)) return;
  if (!SetExportChecked(env, exports, "tpictr", Napi::Function::New(env, Tpictr), __func__)) return;
  if (!SetExportChecked(env, exports, "timdefGet", Napi::Function::New(env, TimdefGet), __func__)) return;
  if (!SetExportChecked(env, exports, "timdefSet", Napi::Function::New(env, TimdefSet), __func__)) return;

  if (!SetExportChecked(env, exports, "scs2e", Napi::Function::New(env, Scs2e), __func__)) return;
  if (!SetExportChecked(env, exports, "sce2s", Napi::Function::New(env, Sce2s), __func__)) return;
  if (!SetExportChecked(env, exports, "scencd", Napi::Function::New(env, Scencd), __func__)) return;
  if (!SetExportChecked(env, exports, "scdecd", Napi::Function::New(env, Scdecd), __func__)) return;
  if (!SetExportChecked(env, exports, "sct2e", Napi::Function::New(env, Sct2e), __func__)) return;
  if (!SetExportChecked(env, exports, "sce2c", Napi::Function::New(env, Sce2c), __func__)) return;
}

}  // namespace tspice_backend_node
