# Concepts

High-level concepts and mental models for tspice.

(Placeholder.)

## Mermaid example

```mermaid
flowchart LR
  Kernels[SPICE kernels] -->|loaded by| Tspice[tspice]
  Tspice --> API[Typed API surface]
  API --> Apps[Apps / scripts]
```
