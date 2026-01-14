#include <napi.h>

#include <string>

extern "C" {
#include "SpiceUsr.h"
}

static std::string GetSpiceErrorMessage() {
  constexpr SpiceInt kMsgLen = 1840;
  SpiceChar shortMsg[kMsgLen + 1];
  SpiceChar longMsg[kMsgLen + 1];

  getmsg_c("SHORT", kMsgLen, shortMsg);
  getmsg_c("LONG", kMsgLen, longMsg);
  reset_c();

  std::string result;
  result.reserve(kMsgLen * 2);
  result.append(shortMsg);
  if (!result.empty()) {
    result.append("\n");
  }
  result.append(longMsg);
  return result;
}

static Napi::String SpiceVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 0) {
    Napi::TypeError::New(env, "spiceVersion() does not take any arguments").ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  const SpiceChar* version = tkvrsn_c("TOOLKIT");
  if (failed_c()) {
    const std::string msg =
      std::string("CSPICE failed while calling tkvrsn_c(\"TOOLKIT\"):\n") +
      GetSpiceErrorMessage();
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, version);
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  erract_c("SET", 0, const_cast<SpiceChar*>("RETURN"));
  errprt_c("SET", 0, const_cast<SpiceChar*>("NONE"));

  exports.Set("spiceVersion", Napi::Function::New(env, SpiceVersion));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
