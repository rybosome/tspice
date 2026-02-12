#include "cells_windows.h"

#include "../addon_common.h"
#include "../cell_handles.h"
#include "../napi_helpers.h"

#include "tspice_backend_shim.h"

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

  if (!SetExportChecked(env, exports, "cellGeti", Napi::Function::New(env, CellGeti), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "cellGetd", Napi::Function::New(env, CellGetd), __func__)) {
    return;
  }
  if (!SetExportChecked(env, exports, "cellGetc", Napi::Function::New(env, CellGetc), __func__)) {
    return;
  }

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
