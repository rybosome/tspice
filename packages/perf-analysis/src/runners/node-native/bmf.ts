/**
* Helper for emitting a minimal per-benchmark BMF entry.
*
* Bencher Metric Format (BMF) does not encode units; for this runner they are implied as:
* - latency_p50 / latency_p95: ns/op
* - throughput: ops/sec
*/
export function toNodeNativeBmfMeasures(metrics: {
  latency_p50: number;
  latency_p95: number;
  throughput: number;
}): Record<string, { value: number }> {
  return {
    latency_p50: { value: metrics.latency_p50 },
    latency_p95: { value: metrics.latency_p95 },
    throughput: { value: metrics.throughput },
  };
}
