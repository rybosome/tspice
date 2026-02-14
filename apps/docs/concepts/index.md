# Concepts

This section is a set of **mental models** for using SPICE through tspice.

If you’re new here, read these in order:

- [tspice mental model](/concepts/tspice-mental-model)
- [Time systems](/concepts/time-systems)
- [Frames](/concepts/frames)
- [Aberration corrections](/concepts/aberration-corrections)
- [Kernel taxonomy](/concepts/kernel-taxonomy)

For hands-on setup and usage, see the [Guide](/guide/).

## Big picture

```mermaid
flowchart LR
  Kernels[SPICE kernels] -->|loaded into| Pool[Kernel pool + loaded-kernel table]
  Pool --> Backend[Backend (node addon / wasm)]
  Backend --> Raw[raw: CSPICE-shaped API]
  Raw --> Kit[kit: ergonomic helpers]
  Kit --> Apps[Apps / scripts]

  subgraph tspice
    Backend
    Raw
    Kit
  end
```

A recurring theme in these pages: **SPICE is stateful**. Loaded kernels, time conversion defaults, and some other settings live in global (or effectively-global) state. tspice tries to make this easy to manage, but you still need to be aware of it.
