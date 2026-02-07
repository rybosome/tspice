#include "error.h"

#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static Napi::Boolean Failed(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "failed() does not take any arguments"));
    return Napi::Boolean::New(env, false);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  int outFailed = 0;
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_failed(&outFailed, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling failed()", err);
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, outFailed != 0);
}

static void Reset(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    ThrowSpiceError(Napi::TypeError::New(env, "reset() does not take any arguments"));
    return;
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_reset(err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling reset()", err);
  }
}

static Napi::String Getmsg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "getmsg(which: 'SHORT' | 'LONG' | 'EXPLAIN') expects exactly one string argument"));
    return Napi::String::New(env, "");
  }

  const std::string which = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);

  char out[tspice_backend_node::kOutMaxBytes];
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_getmsg(which.c_str(), out, (int)sizeof(out), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling getmsg", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out);
}

static void Setmsg(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "setmsg(message: string) expects exactly one string argument"));
    return;
  }

  const std::string msg = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_setmsg(msg.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling setmsg", err);
  }
}

static void Sigerr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "sigerr(short: string) expects exactly one string argument"));
    return;
  }

  const std::string shortMsg = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_sigerr(shortMsg.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling sigerr", err);
  }
}

static void Chkin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "chkin(name: string) expects exactly one string argument"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_chkin(name.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling chkin", err);
  }
}

static void Chkout(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "chkout(name: string) expects exactly one string argument"));
    return;
  }

  const std::string name = info[0].As<Napi::String>().Utf8Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_chkout(name.c_str(), err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling chkout", err);
  }
}

namespace tspice_backend_node {

void RegisterError(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "failed", Napi::Function::New(env, Failed), __func__)) return;
  if (!SetExportChecked(env, exports, "reset", Napi::Function::New(env, Reset), __func__)) return;
  if (!SetExportChecked(env, exports, "getmsg", Napi::Function::New(env, Getmsg), __func__)) return;
  if (!SetExportChecked(env, exports, "setmsg", Napi::Function::New(env, Setmsg), __func__)) return;
  if (!SetExportChecked(env, exports, "sigerr", Napi::Function::New(env, Sigerr), __func__)) return;
  if (!SetExportChecked(env, exports, "chkin", Napi::Function::New(env, Chkin), __func__)) return;
  if (!SetExportChecked(env, exports, "chkout", Napi::Function::New(env, Chkout), __func__)) return;
}

}  // namespace tspice_backend_node
