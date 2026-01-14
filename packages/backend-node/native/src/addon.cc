#include <napi.h>

#include <mutex>
#include <string>

extern "C" {
#include "SpiceUsr.h"
}

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

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("spiceVersion", Napi::Function::New(env, SpiceVersion));
  return exports;
}

NODE_API_MODULE(tspice_backend_node, Init)
