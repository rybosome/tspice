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

export type FunctionRegistryFunctionSpec = {
  key: string;
  input: FunctionRegistryInputArray;
  output?: FunctionRegistryOutputSpec;
  buffers?: Record<string, FunctionRegistryBufferSpec>;
};

export type FunctionRegistrySource = {
  dslVersion: 1;
  functions: FunctionRegistryFunctionSpec[];
};

export type FunctionRegistryCatalog = FunctionRegistrySource;
