#pragma once

#include <napi.h>

namespace tspice_backend_node {

void RegisterEk(Napi::Env env, Napi::Object exports);

}  // namespace tspice_backend_node
