{
  "variables": {
    "tspice_cspice_dir": "<!(node ../../../scripts/print-cspice-dir.mjs)",
    "tspice_native_generated_dir": "<!(node scripts/write-cspice-stamp.mjs)"
  },
  "targets": [
    {
      "target_name": "tspice_backend_node",
      "sources": ["src/addon.cc"],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include_dir\")",
        "<(tspice_cspice_dir)/include",
        "<(tspice_native_generated_dir)"
      ],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "defines": ["NODE_ADDON_API_DISABLE_CPP_EXCEPTIONS"],
      "libraries": [
        "<(tspice_cspice_dir)/lib/cspice.a",
        "<(tspice_cspice_dir)/lib/csupport.a"
      ],
      "conditions": [
        ["OS=='linux'", { "libraries": ["-lm"] }]
      ],
      "cflags": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17", "-fno-exceptions"]
    }
  ]
}
