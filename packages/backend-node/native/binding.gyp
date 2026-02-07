{
  "variables": {
    "tspice_cspice_dir": "<!(node ../../../scripts/print-cspice-dir.mjs)",
    "tspice_native_generated_dir": "<!(node \"<(module_root_dir)/scripts/write-cspice-stamp.mjs\" \"<(tspice_cspice_dir)\")"
  },
  "targets": [
    {
      "target_name": "tspice_backend_node",
      "sources": [
        "src/addon.cc",
        "src/addon_common.cc",
        "src/domains/kernels.cc",
        "src/domains/time.cc",
        "src/domains/ids_names.cc",
        "src/domains/frames.cc",
        "src/domains/ephemeris.cc",
        "src/domains/geometry.cc",
        "src/domains/coords_vectors.cc",
        "src/domains/error.cc",
        "../../backend-shim-c/src/errors.c",
        "../../backend-shim-c/src/domains/kernels.c",
        "../../backend-shim-c/src/domains/time.c",
        "../../backend-shim-c/src/domains/ids_names.c",
        "../../backend-shim-c/src/domains/frames.c",
        "../../backend-shim-c/src/domains/ephemeris.c",
        "../../backend-shim-c/src/domains/geometry.c",
        "../../backend-shim-c/src/domains/coords_vectors.c"
      ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include_dir\")",
        "<(tspice_cspice_dir)/include",
        "../../backend-shim-c/include",
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
    },
    {
      "target_name": "tspice_backend_node_test",
      "sources": [
        "src/test_addon.cc",
        "src/test_exports.cc"
      ],
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "defines": ["NODE_ADDON_API_DISABLE_CPP_EXCEPTIONS"],
      "cflags": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17", "-fno-exceptions"]
    }
  ]
}
