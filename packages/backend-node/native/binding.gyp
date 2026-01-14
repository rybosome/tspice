{
  "targets": [
    {
      "target_name": "tspice_backend_node",
      "sources": ["src/addon.cc"],
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "defines": ["NODE_ADDON_API_DISABLE_CPP_EXCEPTIONS"],
      "cflags": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17", "-fno-exceptions"]
    }
  ]
}
