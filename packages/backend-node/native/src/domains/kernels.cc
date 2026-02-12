#include "kernels.h"

#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNotFound;
using tspice_napi::MakeNumberArray;
using tspice_napi::PreviewForError;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

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
        std::string("CSPICE failed while calling furnsh(\"") + PreviewForError(path) + "\")",
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
        std::string("CSPICE failed while calling unload(\"") + PreviewForError(path) + "\")",
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
        std::string("CSPICE failed while calling ktotal(\"") + PreviewForError(kind) + "\")",
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
  if (!SetExportChecked(env, exports, "__ktotalAll", Napi::Function::New(env, KtotalAll), __func__)) return;
}

}  // namespace tspice_backend_node
