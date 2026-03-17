export type FunctionRegistryInputArray = string[];

export type FunctionRegistryOutputValueSpec = {
  from: "return" | `out.${string}`;
  type?: string;
};

export type FunctionRegistryOutputPayloadSpec = Record<string, string>;

export type FunctionRegistryOutputSpec =
  | {
      value: FunctionRegistryOutputValueSpec;
    }
  | {
      payload: FunctionRegistryOutputPayloadSpec;
    };

export type FunctionRegistryBufferBytesSpec = {
  min: number;
  max: number;
};

export type FunctionRegistryBufferSpec =
  | {
      bytes: FunctionRegistryBufferBytesSpec;
      elementType?: string;
    }
  | {
      lengthFrom: string;
      elementType?: string;
    };

export type FunctionRegistryBehaviorClass =
  | "input-mapping-scalar-output"
  | "out-params-structured-payload"
  | "integer-return-split"
  | "complex-return-form"
  | "string-buffer-bounds";

export type FunctionRegistryExecutableSpec = {
  ts: {
    method: string;
  };
  native: {
    handler: string;
  };
};

export type FunctionRegistryFunctionShape = {
  key: string;
  input: FunctionRegistryInputArray;
  output?: FunctionRegistryOutputSpec;
  buffers?: Record<string, FunctionRegistryBufferSpec>;
};

export type FunctionRegistryFunctionSpec = FunctionRegistryFunctionShape & {
  behaviorClass?: FunctionRegistryBehaviorClass;
  implemented?: boolean;
  executable?: FunctionRegistryExecutableSpec;
  overrideReason?: string;
};

export type NormalizedFunctionRegistryFunctionSpec = FunctionRegistryFunctionShape & {
  behaviorClass: FunctionRegistryBehaviorClass;
  implemented: boolean;
  executable?: FunctionRegistryExecutableSpec;
  overrideReason?: string;
};

export type FunctionRegistrySource = {
  dslVersion: 1;
  functions: FunctionRegistryFunctionSpec[];
};

export type FunctionRegistryCatalog = {
  dslVersion: 1;
  functions: NormalizedFunctionRegistryFunctionSpec[];
};

export type FunctionRegistryNormalizationDiagnostics = {
  missingKeys: string[];
  extraKeys: string[];
};
