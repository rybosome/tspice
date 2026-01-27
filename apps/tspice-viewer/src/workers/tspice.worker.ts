import { exposeTspiceWorker } from '@rybosome/tspice-web/worker'

// Worker entrypoint used by the viewer. Runs the WASM backend off the main thread.
exposeTspiceWorker()
