#include <napi.h>

#include <mutex>
#include <string>

extern "C" {
#include "SpiceUsr.h"
}

static std::string GetSpiceErrorMessage() {
  constexpr SpiceInt kMsgLen = 1840;
  SpiceChar shortMsg[kMsgLen + 1] = {0};
  SpiceChar longMsg[kMsgLen + 1] = {0};

  getmsg_c("SHORT", kMsgLen, shortMsg);
  getmsg_c("LONG", kMsgLen, longMsg);
  reset_c();

  auto trim = [](const char* s) {
    std::string out(s);
    while (!out.empty() && (out.back() == '\0' || out.back() == '\n' || out.back() == '\r')) {
      out.pop_back();
    }
    return out;
  };

  const std::string shortStr = trim(shortMsg);
  const std::string longStr = trim(longMsg);

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

  InitCspiceErrorHandlingOnce();

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
  exports.Set("spiceVersion", Napi::Function::New(env, SpiceVersion));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
