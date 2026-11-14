#include "cells_windows.h"

#include "../addon_common.h"
#include "../cell_handles.h"
#include "../napi_helpers.h"

#include "tspice_backend_shim.h"

#include <cmath>
#include <limits>
#include <string>
#include <cstdint>
#include <mutex>

using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static Napi::Number NewIntCell(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "newIntCell(size: number) expects 1 number"));
    return Napi::Number::New(env, 0);
  }

  const int size = info[0].As<Napi::Number>().Int32Value();

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];

  uintptr_t ptr = 0;
  const int code = tspice_new_int_cell(size, &ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling newIntCell", err);
    return Napi::Number::New(env, 0);
  }

  const uint32_t handle = tspice_backend_node::AddCellHandle(lock, env, ptr, "newIntCell");
  if (handle == 0) {
    // Best-effort: avoid leaking the newly allocated cell.
    (void)tspice_free_cell(ptr, err, (int)sizeof(err));
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, (double)handle);
}

static Napi::Number NewDoubleCell(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "newDoubleCell(size: number) expects 1 number"));
    return Napi::Number::New(env, 0);
  }

  const int size = info[0].As<Napi::Number>().Int32Value();

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];

  uintptr_t ptr = 0;
  const int code = tspice_new_double_cell(size, &ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling newDoubleCell", err);
    return Napi::Number::New(env, 0);
  }

  const uint32_t handle = tspice_backend_node::AddCellHandle(lock, env, ptr, "newDoubleCell");
  if (handle == 0) {
    // Best-effort: avoid leaking the newly allocated cell.
    (void)tspice_free_cell(ptr, err, (int)sizeof(err));
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, (double)handle);
}

static Napi::Number NewCharCell(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "newCharCell(size: number, length: number) expects 2 numbers"));
    return Napi::Number::New(env, 0);
  }

  const int size = info[0].As<Napi::Number>().Int32Value();
  const int length = info[1].As<Napi::Number>().Int32Value();

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];

  uintptr_t ptr = 0;
  const int code = tspice_new_char_cell(size, length, &ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling newCharCell", err);
    return Napi::Number::New(env, 0);
  }

  const uint32_t handle = tspice_backend_node::AddCellHandle(lock, env, ptr, "newCharCell");
  if (handle == 0) {
    // Best-effort: avoid leaking the newly allocated cell.
    (void)tspice_free_cell(ptr, err, (int)sizeof(err));
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, (double)handle);
}

static Napi::Number NewWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "newWindow(maxIntervals: number) expects 1 number"));
    return Napi::Number::New(env, 0);
  }

  const int maxIntervals = info[0].As<Napi::Number>().Int32Value();

  tspice_backend_node::CspiceLock lock;
  char err[tspice_backend_node::kErrMaxBytes];

  uintptr_t ptr = 0;
  const int code = tspice_new_window(maxIntervals, &ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling newWindow", err);
    return Napi::Number::New(env, 0);
  }

  const uint32_t handle = tspice_backend_node::AddCellHandle(lock, env, ptr, "newWindow");
  if (handle == 0) {
    // Best-effort: avoid leaking the newly allocated window.
    (void)tspice_free_window(ptr, err, (int)sizeof(err));
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, (double)handle);
}

using FreeHandleFn = int (*)(uintptr_t ptr, char* err, int errMaxBytes);

static void FreeHandleCommon(
    Napi::Env env,
    uint32_t handle,
    const char* context,
    const char* kindLabel,
    FreeHandleFn freeHandle) {
  tspice_backend_node::CspiceLock lock;

  uintptr_t ptr = 0;
  if (!tspice_backend_node::RemoveCellPtr(lock, handle, &ptr) || ptr == 0) {
    ThrowSpiceError(
        Napi::RangeError::New(
            env,
            std::string(context) + ": unknown/expired " + kindLabel + " handle: " + std::to_string(handle)));
    return;
  }

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = freeHandle(ptr, err, (int)sizeof(err));
  if (code != 0) {
    // Note: handle is removed even if free fails; otherwise double-frees are easy.
    ThrowSpiceError(env, std::string("CSPICE failed while calling ") + context, err);
    return;
  }
}

static Napi::Value FreeCell(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "freeCell(cellHandle: number) expects 1 argument"));
    return env.Undefined();
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "cell", &handle)) {
    return env.Undefined();
  }

  FreeHandleCommon(env, handle, "freeCell", "cell", tspice_free_cell);
  return env.Undefined();
}

static Napi::Value FreeWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "freeWindow(windowHandle: number) expects 1 argument"));
    return env.Undefined();
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &handle)) {
    return env.Undefined();
  }

  FreeHandleCommon(env, handle, "freeWindow", "window", tspice_free_window);
  return env.Undefined();
}

static Napi::Value Ssize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "ssize(size: number, cellHandle: number) expects (number, handle)"));
    return env.Undefined();
  }

  const int size = info[0].As<Napi::Number>().Int32Value();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &handle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, "ssize", "cell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_ssize(size, ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling ssize", err);
  }
  return env.Undefined();
}

static Napi::Value Scard(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "scard(card: number, cellHandle: number) expects (number, handle)"));
    return env.Undefined();
  }

  const int card = info[0].As<Napi::Number>().Int32Value();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &handle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, "scard", "cell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_scard(card, ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling scard", err);
  }
  return env.Undefined();
}

static Napi::Number Card(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "card(cellHandle: number) expects 1 argument"));
    return Napi::Number::New(env, 0);
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "cell", &handle)) {
    return Napi::Number::New(env, 0);
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, "card", "cell");
  if (env.IsExceptionPending()) return Napi::Number::New(env, 0);

  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int code = tspice_card(ptr, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling card", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, (double)out);
}

static Napi::Number Size(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "size(cellHandle: number) expects 1 argument"));
    return Napi::Number::New(env, 0);
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "cell", &handle)) {
    return Napi::Number::New(env, 0);
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, "size", "cell");
  if (env.IsExceptionPending()) return Napi::Number::New(env, 0);

  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int code = tspice_size(ptr, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling size", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, (double)out);
}

static Napi::Value Valid(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "valid(size: number, n: number, cellHandle: number) expects (number, number, handle)"));
    return env.Undefined();
  }

  const int size = info[0].As<Napi::Number>().Int32Value();
  const int n = info[1].As<Napi::Number>().Int32Value();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "cell", &handle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, "valid", "cell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_valid(size, n, ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling valid", err);
  }
  return env.Undefined();
}

static Napi::Value Insrti(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "insrti(item: number, cellHandle: number) expects (number, handle)"));
    return env.Undefined();
  }

  const int item = info[0].As<Napi::Number>().Int32Value();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &handle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_INT, "insrti", "cell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_insrti(item, ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling insrti", err);
  }
  return env.Undefined();
}

static Napi::Value Insrtd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "insrtd(item: number, cellHandle: number) expects (number, handle)"));
    return env.Undefined();
  }

  const double item = info[0].As<Napi::Number>().DoubleValue();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &handle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_DP, "insrtd", "cell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_insrtd(item, ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling insrtd", err);
  }
  return env.Undefined();
}

static Napi::Value Insrtc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsString()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "insrtc(item: string, cellHandle: number) expects (string, handle)"));
    return env.Undefined();
  }

  const std::string item = info[0].As<Napi::String>().Utf8Value();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &handle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_CHR, "insrtc", "cell");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_insrtc(item.c_str(), ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling insrtc", err);
  }
  return env.Undefined();
}

static Napi::Number CellGeti(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "cellGeti(cellHandle: number, index: number) expects (handle, number)"));
    return Napi::Number::New(env, 0);
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "cell", &handle)) {
    return Napi::Number::New(env, 0);
  }
  const int index = info[1].As<Napi::Number>().Int32Value();

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_INT, "cellGeti", "cell");
  if (env.IsExceptionPending()) return Napi::Number::New(env, 0);

  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int code = tspice_cell_geti(ptr, index, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cellGeti", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, (double)out);
}

static Napi::Number CellGetd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "cellGetd(cellHandle: number, index: number) expects (handle, number)"));
    return Napi::Number::New(env, 0);
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "cell", &handle)) {
    return Napi::Number::New(env, 0);
  }
  const int index = info[1].As<Napi::Number>().Int32Value();

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_DP, "cellGetd", "cell");
  if (env.IsExceptionPending()) return Napi::Number::New(env, 0);

  char err[tspice_backend_node::kErrMaxBytes];
  double out = 0.0;
  const int code = tspice_cell_getd(ptr, index, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cellGetd", err);
    return Napi::Number::New(env, 0);
  }

  return Napi::Number::New(env, out);
}

static Napi::String CellGetc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "cellGetc(cellHandle: number, index: number) expects (handle, number)"));
    return Napi::String::New(env, "");
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "cell", &handle)) {
    return Napi::String::New(env, "");
  }
  const int index = info[1].As<Napi::Number>().Int32Value();

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_CHR, "cellGetc", "cell");
  if (env.IsExceptionPending()) return Napi::String::New(env, "");

  char err[tspice_backend_node::kErrMaxBytes];

  int outMaxBytes = 0;
  const int lengthCode = tspice_char_cell_length(ptr, &outMaxBytes, err, (int)sizeof(err));
  if (lengthCode != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cellGetc", err);
    return Napi::String::New(env, "");
  }
  if (outMaxBytes <= 0) {
    outMaxBytes = 2048;
  }

  std::string out;
  out.resize((size_t)outMaxBytes, '\0');

  const int code = tspice_cell_getc(ptr, index, out.data(), outMaxBytes, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling cellGetc", err);
    return Napi::String::New(env, "");
  }

  return Napi::String::New(env, out.c_str());
}

static bool ReadCellString(Napi::Env env, const Napi::Value& value, std::string* text) {
  if (!value.IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a string"));
    return false;
  }
  size_t bytes = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &bytes) != napi_ok || bytes >= std::numeric_limits<int>::max()) {
    ThrowSpiceError(Napi::RangeError::New(env, "String exceeds its UTF-8 byte limit"));
    return false;
  }
  const Napi::String input = value.As<Napi::String>();
  // N-API replaces unpaired surrogates when encoding UTF-8. Validate the
  // original UTF-16 units before making the C string.
  const std::u16string units = input.Utf16Value();
  for (size_t i = 0; i < units.size(); i++) {
    const char16_t c = units[i];
    if (c == 0) {
      ThrowSpiceError(Napi::TypeError::New(env, "Input contains an embedded NUL"));
      return false;
    }
    if (c >= 0xd800 && c <= 0xdfff) {
      if (c > 0xdbff || i + 1 == units.size() || units[i+1] < 0xdc00 || units[i+1] > 0xdfff) {
        ThrowSpiceError(Napi::TypeError::New(env, "Input contains an unpaired UTF-16 surrogate"));
        return false;
      }
      i++;
    }
  }
  *text = input.Utf8Value();
  return true;
}

static bool ReadCellInteger(Napi::Env env, const Napi::Value& value, int* out) {
  if (value.IsNumber()) {
    const double n = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(n) && std::trunc(n) == n && n >= INT32_MIN && n <= INT32_MAX) {
      *out = static_cast<int>(n);
      return true;
    }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a signed 32-bit cell item"));
  return false;
}

static Napi::Value Appndc(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "appndc() expects two arguments"));
    return env.Undefined();
  }
  std::string item;
  if (!ReadCellString(env, info[0], &item)) return env.Undefined();
  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &cellHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t cell = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, cellHandle, "appndc", "cell");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_appndc(item.c_str(), cell, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling appndc", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Appndd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "appndd() expects two arguments"));
    return env.Undefined();
  }
  if (!info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a numeric cell item"));
    return env.Undefined();
  }
  const double item = info[0].As<Napi::Number>().DoubleValue();
  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &cellHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t cell = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, cellHandle, "appndd", "cell");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_appndd(item, cell, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling appndd", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Appndi(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "appndi() expects two arguments"));
    return env.Undefined();
  }
  int item;
  if (!ReadCellInteger(env, info[0], &item)) return env.Undefined();
  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &cellHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t cell = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, cellHandle, "appndi", "cell");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_appndi(item, cell, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling appndi", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Elemc(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "elemc() expects two arguments"));
    return env.Undefined();
  }
  std::string item;
  if (!ReadCellString(env, info[0], &item)) return env.Undefined();
  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &cellHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t cell = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, cellHandle, "elemc", "cell");
  if (env.IsExceptionPending()) return env.Undefined();
  int out = 0;
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_elemc(item.c_str(), cell, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling elemc", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Elemd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "elemd() expects two arguments"));
    return env.Undefined();
  }
  if (!info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a numeric cell item"));
    return env.Undefined();
  }
  const double item = info[0].As<Napi::Number>().DoubleValue();
  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &cellHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t cell = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, cellHandle, "elemd", "cell");
  if (env.IsExceptionPending()) return env.Undefined();
  int out = 0;
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_elemd(item, cell, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling elemd", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Elemi(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "elemi() expects two arguments"));
    return env.Undefined();
  }
  int item;
  if (!ReadCellInteger(env, info[0], &item)) return env.Undefined();
  uint32_t cellHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "cell", &cellHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t cell = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, cellHandle, "elemi", "cell");
  if (env.IsExceptionPending()) return env.Undefined();
  int out = 0;
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_elemi(item, cell, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling elemi", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Copy(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "copy() expects two arguments"));
    return env.Undefined();
  }
  uint32_t sourceHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "source", &sourceHandle)) return env.Undefined();
  uint32_t destinationHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "destination", &destinationHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t source = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, sourceHandle, "copy", "cell");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t destination = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, destinationHandle, "copy", "cell");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_copy(source, destination, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling copy", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static bool ReadWindowSide(Napi::Env env, const Napi::Value& value, int* out) {
  size_t units = 0;
  if (value.IsString() && napi_get_value_string_utf16(env, value, nullptr, 0, &units) == napi_ok && units == 1) {
    const auto text = value.As<Napi::String>().Utf16Value();
    if (text.size() == 1 && text[0] <= 127) { *out = text[0]; return true; }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected one ASCII byte"));
  return false;
}

static bool ReadWindowScalar(Napi::Env env, const Napi::Value& value, double* out) {
  if (value.IsNumber()) {
    const double number = value.As<Napi::Number>().DoubleValue();
    if (std::isfinite(number)) { *out = number; return true; }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a finite window argument"));
  return false;
}

static Napi::Value Wncomd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 4) {
    ThrowSpiceError(Napi::TypeError::New(env, "wncomd() expects 4 arguments"));
    return env.Undefined();
  }
  double left = 0;
  if (!ReadWindowScalar(env, info[0], &left)) return env.Undefined();
  double right = 0;
  if (!ReadWindowScalar(env, info[1], &right)) return env.Undefined();
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &windowHandle)) return env.Undefined();
  uint32_t resultHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[3], "window", &resultHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wncomd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t result = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, resultHandle, SPICE_DP, "wncomd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wncomd(left, right, window, result, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wncomd", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wncond(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "wncond() expects 3 arguments"));
    return env.Undefined();
  }
  double left = 0;
  if (!ReadWindowScalar(env, info[0], &left)) return env.Undefined();
  double right = 0;
  if (!ReadWindowScalar(env, info[1], &right)) return env.Undefined();
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &windowHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wncond", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wncond(left, right, window, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wncond", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wndifd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "wndifd() expects 3 arguments"));
    return env.Undefined();
  }
  uint32_t aHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &aHandle)) return env.Undefined();
  uint32_t bHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "window", &bHandle)) return env.Undefined();
  uint32_t resultHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &resultHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t a = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, aHandle, SPICE_DP, "wndifd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t b = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, bHandle, SPICE_DP, "wndifd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t result = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, resultHandle, SPICE_DP, "wndifd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wndifd(a, b, result, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wndifd", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wnelmd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnelmd() expects 2 arguments"));
    return env.Undefined();
  }
  double point = 0;
  if (!ReadWindowScalar(env, info[0], &point)) return env.Undefined();
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "window", &windowHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wnelmd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  int out = 0;
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnelmd(point, window, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnelmd", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Wnexpd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnexpd() expects 3 arguments"));
    return env.Undefined();
  }
  double left = 0;
  if (!ReadWindowScalar(env, info[0], &left)) return env.Undefined();
  double right = 0;
  if (!ReadWindowScalar(env, info[1], &right)) return env.Undefined();
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &windowHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wnexpd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnexpd(left, right, window, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnexpd", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wnextd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnextd() expects 2 arguments"));
    return env.Undefined();
  }
  int side = 0;
  if (!ReadWindowSide(env, info[0], &side)) return env.Undefined();
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "window", &windowHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wnextd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnextd(side, window, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnextd", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wnfild(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnfild() expects 2 arguments"));
    return env.Undefined();
  }
  double small = 0;
  if (!ReadWindowScalar(env, info[0], &small)) return env.Undefined();
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "window", &windowHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wnfild", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnfild(small, window, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnfild", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wnfltd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnfltd() expects 2 arguments"));
    return env.Undefined();
  }
  double small = 0;
  if (!ReadWindowScalar(env, info[0], &small)) return env.Undefined();
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "window", &windowHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wnfltd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnfltd(small, window, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnfltd", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wnincd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnincd() expects 3 arguments"));
    return env.Undefined();
  }
  double left = 0;
  if (!ReadWindowScalar(env, info[0], &left)) return env.Undefined();
  double right = 0;
  if (!ReadWindowScalar(env, info[1], &right)) return env.Undefined();
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &windowHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wnincd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  int out = 0;
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnincd(left, right, window, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnincd", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Wnintd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnintd() expects 3 arguments"));
    return env.Undefined();
  }
  uint32_t aHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &aHandle)) return env.Undefined();
  uint32_t bHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "window", &bHandle)) return env.Undefined();
  uint32_t resultHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &resultHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t a = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, aHandle, SPICE_DP, "wnintd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t b = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, bHandle, SPICE_DP, "wnintd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t result = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, resultHandle, SPICE_DP, "wnintd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnintd(a, b, result, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnintd", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wnreld(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnreld() expects 3 arguments"));
    return env.Undefined();
  }
  uint32_t aHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &aHandle)) return env.Undefined();
  std::string op;
  if (!ReadCellString(env, info[1], &op)) return env.Undefined();
  uint32_t bHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &bHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t a = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, aHandle, SPICE_DP, "wnreld", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t b = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, bHandle, SPICE_DP, "wnreld", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  int out = 0;
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnreld(a, op.c_str(), b, &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnreld", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Wnsumd(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnsumd() expects 1 arguments"));
    return env.Undefined();
  }
  uint32_t windowHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &windowHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t window = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, windowHandle, SPICE_DP, "wnsumd", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  double meas = 0, avg = 0, stddev = 0;
  int shortest = -1, longest = -1;
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnsumd(window, &meas, &avg, &stddev, &shortest, &longest, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnsumd", err);
    return env.Undefined();
  }
  const Napi::Object summary = Napi::Object::New(env);
  summary.Set("meas", Napi::Number::New(env, meas));
  summary.Set("avg", Napi::Number::New(env, avg));
  summary.Set("stddev", Napi::Number::New(env, stddev));
  summary.Set("shortest", Napi::Number::New(env, shortest));
  summary.Set("longest", Napi::Number::New(env, longest));
  return summary;
}

static Napi::Value Wnunid(const Napi::CallbackInfo& info) {
  const Napi::Env env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "wnunid() expects 3 arguments"));
    return env.Undefined();
  }
  uint32_t aHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &aHandle)) return env.Undefined();
  uint32_t bHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[1], "window", &bHandle)) return env.Undefined();
  uint32_t resultHandle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &resultHandle)) return env.Undefined();
  tspice_backend_node::CspiceLock lock;
  const uintptr_t a = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, aHandle, SPICE_DP, "wnunid", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t b = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, bHandle, SPICE_DP, "wnunid", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  const uintptr_t result = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, resultHandle, SPICE_DP, "wnunid", "window");
  if (env.IsExceptionPending()) return env.Undefined();
  char err[tspice_backend_node::kErrMaxBytes];
  if (tspice_wnunid(a, b, result, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnunid", err);
    return env.Undefined();
  }
  return env.Undefined();
}

static Napi::Value Wninsd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "wninsd(left: number, right: number, windowHandle: number) expects (number, number, handle)"));
    return env.Undefined();
  }

  const double left = info[0].As<Napi::Number>().DoubleValue();
  const double right = info[1].As<Napi::Number>().DoubleValue();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &handle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_DP, "wninsd", "window");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_wninsd(left, right, ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wninsd", err);
  }
  return env.Undefined();
}

static Napi::Number Wncard(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "wncard(windowHandle: number) expects 1 argument"));
    return Napi::Number::New(env, 0);
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &handle)) {
    return Napi::Number::New(env, 0);
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_DP, "wncard", "window");
  if (env.IsExceptionPending()) return Napi::Number::New(env, 0);

  char err[tspice_backend_node::kErrMaxBytes];
  int out = 0;
  const int code = tspice_wncard(ptr, &out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wncard", err);
    return Napi::Number::New(env, 0);
  }
  return Napi::Number::New(env, (double)out);
}

static Napi::Array Wnfetd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "wnfetd(windowHandle: number, index: number) expects (handle, number)"));
    return Napi::Array::New(env);
  }

  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[0], "window", &handle)) {
    return Napi::Array::New(env);
  }
  const int index = info[1].As<Napi::Number>().Int32Value();

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_DP, "wnfetd", "window");
  if (env.IsExceptionPending()) return Napi::Array::New(env);

  char err[tspice_backend_node::kErrMaxBytes];
  double left = 0;
  double right = 0;
  const int code = tspice_wnfetd(ptr, index, &left, &right, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnfetd", err);
    return Napi::Array::New(env);
  }

  Napi::Array out = Napi::Array::New(env, 2);
  out.Set((uint32_t)0, Napi::Number::New(env, left));
  out.Set((uint32_t)1, Napi::Number::New(env, right));
  return out;
}

static Napi::Value Wnvald(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 3 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(
        Napi::TypeError::New(env, "wnvald(size: number, n: number, windowHandle: number) expects (number, number, handle)"));
    return env.Undefined();
  }

  const int size = info[0].As<Napi::Number>().Int32Value();
  const int n = info[1].As<Napi::Number>().Int32Value();
  uint32_t handle = 0;
  if (!tspice_backend_node::ReadCellHandleArg(env, info[2], "window", &handle)) {
    return env.Undefined();
  }

  tspice_backend_node::CspiceLock lock;
  const uintptr_t ptr = tspice_backend_node::GetCellHandlePtrOrThrow(lock, env, handle, SPICE_DP, "wnvald", "window");
  if (env.IsExceptionPending()) return env.Undefined();

  char err[tspice_backend_node::kErrMaxBytes];
  const int code = tspice_wnvald(size, n, ptr, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling wnvald", err);
  }
  return env.Undefined();
}

namespace tspice_backend_node {

void RegisterCellsWindows(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env, exports, "newIntCell", Napi::Function::New(env, NewIntCell), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "newDoubleCell", Napi::Function::New(env, NewDoubleCell), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "newCharCell", Napi::Function::New(env, NewCharCell), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "newWindow", Napi::Function::New(env, NewWindow), __func__)) {
    return;
  }

  if (!SetExportChecked(env, exports, "freeCell", Napi::Function::New(env, FreeCell), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "freeWindow", Napi::Function::New(env, FreeWindow), __func__)) {
    return;
  }

  if (!SetExportChecked(env, exports, "ssize", Napi::Function::New(env, Ssize), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "scard", Napi::Function::New(env, Scard), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "card", Napi::Function::New(env, Card), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "size", Napi::Function::New(env, Size), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "valid", Napi::Function::New(env, Valid), __func__)) {
    return;
  }

  if (!SetExportChecked(env, exports, "insrti", Napi::Function::New(env, Insrti), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "insrtd", Napi::Function::New(env, Insrtd), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "insrtc", Napi::Function::New(env, Insrtc), __func__)) {
    return;
  }

  if (!SetExportChecked(env, exports, "appndc", Napi::Function::New(env, Appndc), __func__)) return;
  if (!SetExportChecked(env, exports, "appndd", Napi::Function::New(env, Appndd), __func__)) return;
  if (!SetExportChecked(env, exports, "appndi", Napi::Function::New(env, Appndi), __func__)) return;
  if (!SetExportChecked(env, exports, "elemc", Napi::Function::New(env, Elemc), __func__)) return;
  if (!SetExportChecked(env, exports, "elemd", Napi::Function::New(env, Elemd), __func__)) return;
  if (!SetExportChecked(env, exports, "elemi", Napi::Function::New(env, Elemi), __func__)) return;
  if (!SetExportChecked(env, exports, "copy", Napi::Function::New(env, Copy), __func__)) return;

  if (!SetExportChecked(env, exports, "cellGeti", Napi::Function::New(env, CellGeti), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "cellGetd", Napi::Function::New(env, CellGetd), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "cellGetc", Napi::Function::New(env, CellGetc), __func__)) {
    return;
  }

  if (!SetExportChecked(env, exports, "wncomd", Napi::Function::New(env, Wncomd), __func__)) return;
  if (!SetExportChecked(env, exports, "wncond", Napi::Function::New(env, Wncond), __func__)) return;
  if (!SetExportChecked(env, exports, "wndifd", Napi::Function::New(env, Wndifd), __func__)) return;
  if (!SetExportChecked(env, exports, "wnelmd", Napi::Function::New(env, Wnelmd), __func__)) return;
  if (!SetExportChecked(env, exports, "wnexpd", Napi::Function::New(env, Wnexpd), __func__)) return;
  if (!SetExportChecked(env, exports, "wnextd", Napi::Function::New(env, Wnextd), __func__)) return;
  if (!SetExportChecked(env, exports, "wnfild", Napi::Function::New(env, Wnfild), __func__)) return;
  if (!SetExportChecked(env, exports, "wnfltd", Napi::Function::New(env, Wnfltd), __func__)) return;
  if (!SetExportChecked(env, exports, "wnincd", Napi::Function::New(env, Wnincd), __func__)) return;
  if (!SetExportChecked(env, exports, "wnintd", Napi::Function::New(env, Wnintd), __func__)) return;
  if (!SetExportChecked(env, exports, "wnreld", Napi::Function::New(env, Wnreld), __func__)) return;
  if (!SetExportChecked(env, exports, "wnsumd", Napi::Function::New(env, Wnsumd), __func__)) return;
  if (!SetExportChecked(env, exports, "wnunid", Napi::Function::New(env, Wnunid), __func__)) return;
  if (!SetExportChecked(env, exports, "wninsd", Napi::Function::New(env, Wninsd), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "wncard", Napi::Function::New(env, Wncard), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "wnfetd", Napi::Function::New(env, Wnfetd), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "wnvald", Napi::Function::New(env, Wnvald), __func__)) {
    return;
  }
}

}  // namespace tspice_backend_node
