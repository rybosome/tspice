#include "coords_vectors.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <memory>
#include <new>
#include <string>

#include "../addon_common.h"
#include "../napi_helpers.h"
#include "tspice_backend_shim.h"

using tspice_napi::MakeNumberArray;
using tspice_napi::SetExportChecked;
using tspice_napi::ThrowSpiceError;

static bool ReadBoundNumber(Napi::Env env, const Napi::Value& value, double* out) {
  if (value.IsNumber()) {
    const double number = value.As<Napi::Number>().DoubleValue();
    if (!std::isnan(number)) { *out = number; return true; }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected an ordered double value"));
  return false;
}

static bool ReadBoundNumber(Napi::Env env, const Napi::Value& value, int* out) {
  if (value.IsNumber()) {
    const double number = value.As<Napi::Number>().DoubleValue();
    if (number >= INT32_MIN && number <= INT32_MAX && std::trunc(number) == number) {
      *out = static_cast<int>(number);
      return true;
    }
  }
  ThrowSpiceError(Napi::TypeError::New(env, "Expected a signed 32-bit integer"));
  return false;
}

static bool BoundCount(Napi::Env env, const Napi::Value& value, size_t elementSize,
                       uint32_t maximum, int* count) {
  if (!value.IsArray()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a sorted array"));
    return false;
  }
  const uint32_t length = value.As<Napi::Array>().Length();
  if (length > maximum || static_cast<size_t>(length) > SIZE_MAX / elementSize) {
    ThrowSpiceError(Napi::RangeError::New(env, "Sorted array is too large"));
    return false;
  }
  *count = static_cast<int>(length);
  return true;
}

template<typename T>
static std::unique_ptr<T[]> AllocateBounds(Napi::Env env, size_t count) {
  std::unique_ptr<T[]> buffer(new (std::nothrow) T[std::max<size_t>(1, count)]);
  if (!buffer) ThrowSpiceError(Napi::Error::New(env, "Sorted search allocation failed"));
  return buffer;
}

template<typename T>
static std::unique_ptr<T[]> CopyBoundNumbers(Napi::Env env, const Napi::Array& values, int count) {
  auto buffer = AllocateBounds<T>(env, static_cast<size_t>(count));
  if (!buffer) return nullptr;
  if (count == 0) buffer[0] = 0;
  for (int i = 0; i < count; i++) {
    const Napi::Value item = values.Get(static_cast<uint32_t>(i));
    if (env.IsExceptionPending() || !ReadBoundNumber(env, item, &buffer[i])) return nullptr;
  }
  return buffer;
}

static bool ReadBoundText(Napi::Env env, const Napi::Value& value, size_t maxBytes, std::string* out) {
  if (!value.IsString()) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected a search string"));
    return false;
  }
  size_t size = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &size) != napi_ok || size > maxBytes) {
    ThrowSpiceError(Napi::RangeError::New(env, "Search string exceeds its UTF-8 byte limit"));
    return false;
  }
  const auto input = value.As<Napi::String>();
  const auto units = input.Utf16Value();
  for (size_t i = 0; i < units.size(); i++) {
    const auto c = units[i];
    if (c == 0) {
      ThrowSpiceError(Napi::TypeError::New(env, "Search string contains an embedded NUL"));
      return false;
    }
    if (c >= 0xd800 && c <= 0xdfff) {
      if (c > 0xdbff || i + 1 == units.size() || units[i+1] < 0xdc00 || units[i+1] > 0xdfff) {
        ThrowSpiceError(Napi::TypeError::New(env, "Search string contains an unpaired UTF-16 surrogate"));
        return false;
      }
      i++;
    }
  }
  *out = input.Utf8Value();
  return true;
}

static std::unique_ptr<char[]> PackBoundRows(Napi::Env env, const Napi::Array& values,
                                            int count, int* width) {
  *width = 2;
  auto rows = AllocateBounds<std::string>(env, static_cast<size_t>(count));
  if (!rows) return nullptr;
  const size_t maxRowBytes = INT32_MAX / std::max(1, count) - 1;
  for (int i = 0; i < count; i++) {
    const Napi::Value item = values.Get(static_cast<uint32_t>(i));
    if (env.IsExceptionPending() || !ReadBoundText(env, item, maxRowBytes, &rows[i])) return nullptr;
    *width = std::max(*width, static_cast<int>(rows[i].size() + 1));
  }
  const size_t size = static_cast<size_t>(count) * *width;
  auto table = AllocateBounds<char>(env, size);
  if (!table) return nullptr;
  if (count == 0) table[0] = '\0';
  for (int i = 0; i < count; i++) {
    char* row = table.get() + static_cast<size_t>(i) * *width;
    std::fill_n(row, *width - 1, ' ');
    std::memcpy(row, rows[i].data(), rows[i].size());
    row[*width - 1] = '\0';
  }
  return table;
}

template <typename T>
static bool CopyOrderBuffer(Napi::Env env, const Napi::Value &input, napi_typedarray_type kind,
                            std::unique_ptr<T[]> *target, int *count) {
  if (!input.IsTypedArray() || input.As<Napi::TypedArray>().TypedArrayType() != kind) {
    ThrowSpiceError(Napi::TypeError::New(env, "Expected typed array of the correct element kind"));
    return false;
  }
  auto array = input.As<Napi::TypedArrayOf<T>>();
  size_t n = array.ElementLength();
  if (n > INT32_MAX / sizeof(T)) {
    ThrowSpiceError(Napi::RangeError::New(env, "Array exceeds supported native byte count"));
    return false;
  }
  *count = static_cast<int>(n);
  *target = AllocateBounds<T>(env, std::max<size_t>(1, n));
  if (!*target)
    return false;
  if (n)
    std::copy_n(array.Data(), n, target->get());
  else
    (*target)[0] = 0;
  return true;
}

template <typename T>
static Napi::Value OrderArrayResult(Napi::Env env, const T *data, size_t count) {
  auto result = Napi::TypedArrayOf<T>::New(env, count);
  if (count)
    std::copy_n(data, count, result.Data());
  return result;
}

static Napi::Value Isordv(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid isordv arguments"));
    return env.Undefined();
  }
  std::unique_ptr<int32_t[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[0], napi_int32_array, &values, &size))
    return env.Undefined();
  const int n = size;
  int out = 0;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_isordv(n, values.get(), &out, err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling isordv", err);
    return env.Undefined();
  }
  return Napi::Boolean::New(env, out != 0);
}

static Napi::Value Orderc(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid orderc arguments"));
    return env.Undefined();
  }
  int width = 0;
  if (!ReadBoundNumber(env, info[0], &width))
    return env.Undefined();
  std::unique_ptr<uint8_t[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[1], napi_uint8_array, &values, &size))
    return env.Undefined();
  if (width < 2 || size % width != 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid packed row layout"));
    return env.Undefined();
  }
  const int n = size / width;
  auto out = AllocateBounds<int32_t>(env, n);
  if (!out)
    return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_orderc(n, width, reinterpret_cast<char *>(values.get()), out.get(), err,
                    sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling orderc", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, out.get(), n);
}

static Napi::Value Orderd(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid orderd arguments"));
    return env.Undefined();
  }
  std::unique_ptr<double[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[0], napi_float64_array, &values, &size))
    return env.Undefined();
  const int n = size;
  auto out = AllocateBounds<int32_t>(env, n);
  if (!out)
    return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_orderd(n, values.get(), out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling orderd", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, out.get(), n);
}

static Napi::Value Orderi(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid orderi arguments"));
    return env.Undefined();
  }
  std::unique_ptr<int32_t[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[0], napi_int32_array, &values, &size))
    return env.Undefined();
  const int n = size;
  auto out = AllocateBounds<int32_t>(env, n);
  if (!out)
    return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_orderi(n, values.get(), out.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling orderi", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, out.get(), n);
}

static Napi::Value Reordc(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 3) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid reordc arguments"));
    return env.Undefined();
  }
  int width = 0;
  if (!ReadBoundNumber(env, info[1], &width))
    return env.Undefined();
  std::unique_ptr<uint8_t[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[2], napi_uint8_array, &values, &size))
    return env.Undefined();
  if (width < 2 || size % width != 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid packed row layout"));
    return env.Undefined();
  }
  const int n = size / width;
  std::unique_ptr<int32_t[]> order;
  int length = 0;
  if (!CopyOrderBuffer(env, info[0], napi_int32_array, &order, &length))
    return env.Undefined();
  if (length != n) {
    ThrowSpiceError(Napi::RangeError::New(env, "Permutation length differs from data"));
    return env.Undefined();
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_reordc(n, order.get(), width, reinterpret_cast<char *>(values.get()), err,
                    sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling reordc", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, values.get(), size);
}

static Napi::Value Reordd(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid reordd arguments"));
    return env.Undefined();
  }
  std::unique_ptr<double[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[1], napi_float64_array, &values, &size))
    return env.Undefined();
  const int n = size;
  std::unique_ptr<int32_t[]> order;
  int length = 0;
  if (!CopyOrderBuffer(env, info[0], napi_int32_array, &order, &length))
    return env.Undefined();
  if (length != n) {
    ThrowSpiceError(Napi::RangeError::New(env, "Permutation length differs from data"));
    return env.Undefined();
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_reordd(n, order.get(), values.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling reordd", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, values.get(), size);
}

static Napi::Value Reordi(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid reordi arguments"));
    return env.Undefined();
  }
  std::unique_ptr<int32_t[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[1], napi_int32_array, &values, &size))
    return env.Undefined();
  const int n = size;
  std::unique_ptr<int32_t[]> order;
  int length = 0;
  if (!CopyOrderBuffer(env, info[0], napi_int32_array, &order, &length))
    return env.Undefined();
  if (length != n) {
    ThrowSpiceError(Napi::RangeError::New(env, "Permutation length differs from data"));
    return env.Undefined();
  }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_reordi(n, order.get(), values.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling reordi", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, values.get(), size);
}

static Napi::Value Reordl(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid reordl arguments"));
    return env.Undefined();
  }
  std::unique_ptr<int32_t[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[1], napi_int32_array, &values, &size))
    return env.Undefined();
  const int n = size;
  std::unique_ptr<int32_t[]> order;
  int length = 0;
  if (!CopyOrderBuffer(env, info[0], napi_int32_array, &order, &length))
    return env.Undefined();
  if (length != n) {
    ThrowSpiceError(Napi::RangeError::New(env, "Permutation length differs from data"));
    return env.Undefined();
  }
  for (int i = 0; i < n; ++i)
    if (values[i] != 0 && values[i] != 1) {
      ThrowSpiceError(Napi::RangeError::New(env, "Expected logical 0/1"));
      return env.Undefined();
    }
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_reordl(n, order.get(), values.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling reordl", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, values.get(), size);
}

static Napi::Value Shellc(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid shellc arguments"));
    return env.Undefined();
  }
  int width = 0;
  if (!ReadBoundNumber(env, info[0], &width))
    return env.Undefined();
  std::unique_ptr<uint8_t[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[1], napi_uint8_array, &values, &size))
    return env.Undefined();
  if (width < 2 || size % width != 0) {
    ThrowSpiceError(Napi::RangeError::New(env, "Invalid packed row layout"));
    return env.Undefined();
  }
  const int n = size / width;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_shellc(n, width, reinterpret_cast<char *>(values.get()), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling shellc", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, values.get(), size);
}

static Napi::Value Shelld(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid shelld arguments"));
    return env.Undefined();
  }
  std::unique_ptr<double[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[0], napi_float64_array, &values, &size))
    return env.Undefined();
  const int n = size;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_shelld(n, values.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling shelld", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, values.get(), size);
}

static Napi::Value Shelli(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "Invalid shelli arguments"));
    return env.Undefined();
  }
  std::unique_ptr<int32_t[]> values;
  int size = 0;
  if (!CopyOrderBuffer(env, info[0], napi_int32_array, &values, &size))
    return env.Undefined();
  const int n = size;
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes] = {};
  if (tspice_shelli(n, values.get(), err, sizeof(err))) {
    ThrowSpiceError(env, "CSPICE failed while calling shelli", err);
    return env.Undefined();
  }
  return OrderArrayResult(env, values.get(), size);
}

static Napi::Value Lstlec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lstlec() expects key and values"));
    return env.Undefined();
  }
  int count = 0;
  if (!BoundCount(env, info[1], sizeof(std::string), INT32_MAX / 2, &count)) return env.Undefined();
  std::string key;
  if (!ReadBoundText(env, info[0], INT32_MAX - 1, &key)) return env.Undefined();
  int width = 2;
  auto rows = PackBoundRows(env, info[1].As<Napi::Array>(), count, &width);
  if (!rows) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_lstlec(key.c_str(), count, width, rows.get(), &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lstlec", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Lstled(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lstled() expects key and values"));
    return env.Undefined();
  }
  int count = 0;
  if (!BoundCount(env, info[1], sizeof(double), INT32_MAX, &count)) return env.Undefined();
  double key = 0;
  if (!ReadBoundNumber(env, info[0], &key)) return env.Undefined();
  auto values = CopyBoundNumbers<double>(env, info[1].As<Napi::Array>(), count);
  if (!values) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_lstled(key, count, values.get(), &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lstled", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Lstlei(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lstlei() expects key and values"));
    return env.Undefined();
  }
  int count = 0;
  if (!BoundCount(env, info[1], sizeof(int), INT32_MAX, &count)) return env.Undefined();
  int key = 0;
  if (!ReadBoundNumber(env, info[0], &key)) return env.Undefined();
  auto values = CopyBoundNumbers<int>(env, info[1].As<Napi::Array>(), count);
  if (!values) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_lstlei(key, count, values.get(), &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lstlei", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Lstltc(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lstltc() expects key and values"));
    return env.Undefined();
  }
  int count = 0;
  if (!BoundCount(env, info[1], sizeof(std::string), INT32_MAX / 2, &count)) return env.Undefined();
  std::string key;
  if (!ReadBoundText(env, info[0], INT32_MAX - 1, &key)) return env.Undefined();
  int width = 2;
  auto rows = PackBoundRows(env, info[1].As<Napi::Array>(), count, &width);
  if (!rows) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_lstltc(key.c_str(), count, width, rows.get(), &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lstltc", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Lstltd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lstltd() expects key and values"));
    return env.Undefined();
  }
  int count = 0;
  if (!BoundCount(env, info[1], sizeof(double), INT32_MAX, &count)) return env.Undefined();
  double key = 0;
  if (!ReadBoundNumber(env, info[0], &key)) return env.Undefined();
  auto values = CopyBoundNumbers<double>(env, info[1].As<Napi::Array>(), count);
  if (!values) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_lstltd(key, count, values.get(), &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lstltd", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Value Lstlti(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "lstlti() expects key and values"));
    return env.Undefined();
  }
  int count = 0;
  if (!BoundCount(env, info[1], sizeof(int), INT32_MAX, &count)) return env.Undefined();
  int key = 0;
  if (!ReadBoundNumber(env, info[0], &key)) return env.Undefined();
  auto values = CopyBoundNumbers<int>(env, info[1].As<Napi::Array>(), count);
  if (!values) return env.Undefined();
  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  int out = -1;
  if (tspice_lstlti(key, count, values.get(), &out, err, static_cast<int>(sizeof(err))) != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling lstlti", err);
    return env.Undefined();
  }
  return Napi::Number::New(env, out);
}

static Napi::Object Reclat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "reclat(rect: number[3]) expects 1 argument"));
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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
  if (!tspice_backend_node::ReadVec3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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
  if (!tspice_backend_node::ReadVec3(env, info[0], v, "v")) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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
  if (!tspice_backend_node::ReadVec3(env, info[0], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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
  if (!tspice_backend_node::ReadVec3(env, info[0], a, "a")) {
    return Napi::Number::New(env, 0);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], b, "b")) {
    return Napi::Number::New(env, 0);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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
  if (!tspice_backend_node::ReadVec3(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[0], m, "m")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
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
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[0], m, "m")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_mtxv(m, v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mtxv", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}


static Napi::Array Vadd(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vadd(a: number[3], b: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vadd(a, b, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vadd", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vsub(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "vsub(a: number[3], b: number[3]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double a[3] = {0};
  double b[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadVec3(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vsub(a, b, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vsub", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vminus(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 1) {
    ThrowSpiceError(Napi::TypeError::New(env, "vminus(v: number[3]) expects 1 argument"));
    return Napi::Array::New(env);
  }

  double v[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vminus(v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vminus", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Vscl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "vscl(s: number, v: number[3]) expects (number, number[3])"));
    return Napi::Array::New(env);
  }

  const double s = info[0].As<Napi::Number>().DoubleValue();

  double v[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[1], v, "v")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_vscl(s, v, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling vscl", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Array Mxm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2) {
    ThrowSpiceError(Napi::TypeError::New(env, "mxm(a: number[9], b: number[9]) expects 2 arguments"));
    return Napi::Array::New(env);
  }

  double a[9] = {0};
  double b[9] = {0};
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[0], a, "a")) {
    return Napi::Array::New(env);
  }
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[1], b, "b")) {
    return Napi::Array::New(env);
  }

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  const int code = tspice_mxm(a, b, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling mxm", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 9);
}

static Napi::Array Rotate(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "rotate(angle: number, axis: number) expects (number, number)"));
    return Napi::Array::New(env);
  }

  const double angle = info[0].As<Napi::Number>().DoubleValue();
  const int axis = info[1].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  const int code = tspice_rotate(angle, axis, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling rotate", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 9);
}

static Napi::Array Rotmat(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "rotmat(m: number[9], angle: number, axis: number) expects (number[9], number, number)"));
    return Napi::Array::New(env);
  }

  double m[9] = {0};
  if (!tspice_backend_node::ReadMat33RowMajor(env, info[0], m, "m")) {
    return Napi::Array::New(env);
  }

  const double angle = info[1].As<Napi::Number>().DoubleValue();
  const int axis = info[2].As<Napi::Number>().Int32Value();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  const int code = tspice_rotmat(m, angle, axis, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling rotmat", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 9);
}

static Napi::Array Axisar(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 2 || !info[1].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "axisar(axis: number[3], angle: number) expects (number[3], number)"));
    return Napi::Array::New(env);
  }

  double axisVec[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], axisVec, "axis")) {
    return Napi::Array::New(env);
  }

  const double angle = info[1].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[9] = {0};
  const int code = tspice_axisar(axisVec, angle, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling axisar", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 9);
}

static Napi::Array Georec(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 5 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() ||
      !info[3].IsNumber() || !info[4].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(
        env,
        "georec(lon: number, lat: number, alt: number, re: number, f: number) expects 5 numbers"));
    return Napi::Array::New(env);
  }

  const double lon = info[0].As<Napi::Number>().DoubleValue();
  const double lat = info[1].As<Napi::Number>().DoubleValue();
  const double alt = info[2].As<Napi::Number>().DoubleValue();
  const double re = info[3].As<Napi::Number>().DoubleValue();
  const double f = info[4].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double out[3] = {0};
  const int code = tspice_georec(lon, lat, alt, re, f, out, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling georec", err);
    return Napi::Array::New(env);
  }

  return MakeNumberArray(env, out, 3);
}

static Napi::Object Recgeo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() != 3 || !info[1].IsNumber() || !info[2].IsNumber()) {
    ThrowSpiceError(Napi::TypeError::New(env, "recgeo(rect: number[3], re: number, f: number) expects (number[3], number, number)"));
    return Napi::Object::New(env);
  }

  double rect[3] = {0};
  if (!tspice_backend_node::ReadVec3(env, info[0], rect, "rect")) {
    return Napi::Object::New(env);
  }

  const double re = info[1].As<Napi::Number>().DoubleValue();
  const double f = info[2].As<Napi::Number>().DoubleValue();

  std::lock_guard<std::mutex> lock(tspice_backend_node::g_cspice_mutex);
  char err[tspice_backend_node::kErrMaxBytes];
  double lon = 0.0;
  double lat = 0.0;
  double alt = 0.0;
  const int code = tspice_recgeo(rect, re, f, &lon, &lat, &alt, err, (int)sizeof(err));
  if (code != 0) {
    ThrowSpiceError(env, "CSPICE failed while calling recgeo", err);
    return Napi::Object::New(env);
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("lon", Napi::Number::New(env, lon));
  out.Set("lat", Napi::Number::New(env, lat));
  out.Set("alt", Napi::Number::New(env, alt));
  return out;
}

namespace tspice_backend_node {

void RegisterCoordsVectors(Napi::Env env, Napi::Object exports) {
  if (!SetExportChecked(env,exports,"isordv",Napi::Function::New(env,Isordv),__func__)) return;
  if (!SetExportChecked(env,exports,"orderc",Napi::Function::New(env,Orderc),__func__)) return;
  if (!SetExportChecked(env,exports,"orderd",Napi::Function::New(env,Orderd),__func__)) return;
  if (!SetExportChecked(env,exports,"orderi",Napi::Function::New(env,Orderi),__func__)) return;
  if (!SetExportChecked(env,exports,"reordc",Napi::Function::New(env,Reordc),__func__)) return;
  if (!SetExportChecked(env,exports,"reordd",Napi::Function::New(env,Reordd),__func__)) return;
  if (!SetExportChecked(env,exports,"reordi",Napi::Function::New(env,Reordi),__func__)) return;
  if (!SetExportChecked(env,exports,"reordl",Napi::Function::New(env,Reordl),__func__)) return;
  if (!SetExportChecked(env,exports,"shellc",Napi::Function::New(env,Shellc),__func__)) return;
  if (!SetExportChecked(env,exports,"shelld",Napi::Function::New(env,Shelld),__func__)) return;
  if (!SetExportChecked(env,exports,"shelli",Napi::Function::New(env,Shelli),__func__)) return;
  if (!SetExportChecked(env, exports, "lstlec", Napi::Function::New(env, Lstlec), __func__)) return;
  if (!SetExportChecked(env, exports, "lstled", Napi::Function::New(env, Lstled), __func__)) return;
  if (!SetExportChecked(env, exports, "lstlei", Napi::Function::New(env, Lstlei), __func__)) return;
  if (!SetExportChecked(env, exports, "lstltc", Napi::Function::New(env, Lstltc), __func__)) return;
  if (!SetExportChecked(env, exports, "lstltd", Napi::Function::New(env, Lstltd), __func__)) return;
  if (!SetExportChecked(env, exports, "lstlti", Napi::Function::New(env, Lstlti), __func__)) return;
  if (!SetExportChecked(env, exports, "reclat", Napi::Function::New(env, Reclat), __func__)) return;
  if (!SetExportChecked(env, exports, "latrec", Napi::Function::New(env, Latrec), __func__)) return;
  if (!SetExportChecked(env, exports, "recsph", Napi::Function::New(env, Recsph), __func__)) return;
  if (!SetExportChecked(env, exports, "sphrec", Napi::Function::New(env, Sphrec), __func__)) return;

  if (!SetExportChecked(env, exports, "vnorm", Napi::Function::New(env, Vnorm), __func__)) return;
  if (!SetExportChecked(env, exports, "vhat", Napi::Function::New(env, Vhat), __func__)) return;
  if (!SetExportChecked(env, exports, "vdot", Napi::Function::New(env, Vdot), __func__)) return;
  if (!SetExportChecked(env, exports, "vcrss", Napi::Function::New(env, Vcrss), __func__)) return;
  if (!SetExportChecked(env, exports, "mxv", Napi::Function::New(env, Mxv), __func__)) return;
  if (!SetExportChecked(env, exports, "mtxv", Napi::Function::New(env, Mtxv), __func__)) return;
  if (!SetExportChecked(env, exports, "vadd", Napi::Function::New(env, Vadd), __func__)) return;
  if (!SetExportChecked(env, exports, "vsub", Napi::Function::New(env, Vsub), __func__)) return;
  if (!SetExportChecked(env, exports, "vminus", Napi::Function::New(env, Vminus), __func__)) return;
  if (!SetExportChecked(env, exports, "vscl", Napi::Function::New(env, Vscl), __func__)) return;
  if (!SetExportChecked(env, exports, "mxm", Napi::Function::New(env, Mxm), __func__)) return;
  if (!SetExportChecked(env, exports, "rotate", Napi::Function::New(env, Rotate), __func__)) return;
  if (!SetExportChecked(env, exports, "rotmat", Napi::Function::New(env, Rotmat), __func__)) return;
  if (!SetExportChecked(env, exports, "axisar", Napi::Function::New(env, Axisar), __func__)) return;
  if (!SetExportChecked(env, exports, "georec", Napi::Function::New(env, Georec), __func__)) return;
  if (!SetExportChecked(env, exports, "recgeo", Napi::Function::New(env, Recgeo), __func__)) return;
}

}  // namespace tspice_backend_node
