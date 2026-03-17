import type {
  FunctionRegistryBehaviorClass,
  FunctionRegistryBufferSpec,
  FunctionRegistryFunctionShape,
} from "./functionRegistryTypes.js";

export const FUNCTION_REGISTRY_BEHAVIOR_CLASSES: readonly FunctionRegistryBehaviorClass[] = [
  "input-mapping-scalar-output",
  "out-params-structured-payload",
  "integer-return-split",
  "complex-return-form",
  "string-buffer-bounds",
] as const;

/** Runtime guard for behavior-class strings in DSL/catalog validation paths. */
export function isFunctionRegistryBehaviorClass(value: string): value is FunctionRegistryBehaviorClass {
  return FUNCTION_REGISTRY_BEHAVIOR_CLASSES.includes(value as FunctionRegistryBehaviorClass);
}

function isStringBufferSpec(bufferSpec: FunctionRegistryBufferSpec): boolean {
  if (bufferSpec.elementType !== undefined) {
    return bufferSpec.elementType === "char";
  }

  return "bytes" in bufferSpec;
}

function hasStringBuffer(spec: FunctionRegistryFunctionShape): boolean {
  return Boolean(
    spec.buffers && Object.values(spec.buffers).some((bufferSpec) => isStringBufferSpec(bufferSpec)),
  );
}

function payloadHasFoundField(spec: FunctionRegistryFunctionShape): boolean {
  if (!spec.output || !("payload" in spec.output)) {
    return false;
  }

  return Object.keys(spec.output.payload).some((field) => field.toLowerCase() === "found");
}

/**
 * Apply code-owned behavior-class conventions for entries that do not explicitly
 * request an override.
 */
export function classifyFunctionRegistryBehaviorClass(
  spec: FunctionRegistryFunctionShape,
): FunctionRegistryBehaviorClass {
  if (hasStringBuffer(spec)) {
    return "string-buffer-bounds";
  }

  if (spec.output && "payload" in spec.output) {
    if (payloadHasFoundField(spec)) {
      return "complex-return-form";
    }

    return "out-params-structured-payload";
  }

  if (
    spec.output &&
    "value" in spec.output &&
    spec.output.value.from.startsWith("out.") &&
    spec.output.value.type === "spiceInt"
  ) {
    return "integer-return-split";
  }

  return "input-mapping-scalar-output";
}

/**
 * Validate that an explicit behavior-class assignment is shape-compatible.
 */
export function isBehaviorClassCompatibleWithShape(
  behaviorClass: FunctionRegistryBehaviorClass,
  spec: FunctionRegistryFunctionShape,
): boolean {
  if (behaviorClass === "string-buffer-bounds") {
    return hasStringBuffer(spec);
  }

  if (behaviorClass === "complex-return-form") {
    return payloadHasFoundField(spec);
  }

  if (behaviorClass === "out-params-structured-payload") {
    return Boolean(spec.output && "payload" in spec.output && !payloadHasFoundField(spec));
  }

  if (behaviorClass === "integer-return-split") {
    return Boolean(
      spec.output &&
        "value" in spec.output &&
        spec.output.value.from.startsWith("out.") &&
        spec.output.value.type === "spiceInt",
    );
  }

  // input-mapping-scalar-output
  return spec.output === undefined || "value" in spec.output;
}
