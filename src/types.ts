export type PrimitiveValue = string | number | boolean | null;

export type Value =
  | { kind: 'primitive'; value: PrimitiveValue }
  | { kind: 'ref'; id: string }
  | { kind: 'none' };

export type HeapObject =
  | { kind: 'list'; id: string; items: Value[] }
  | { kind: 'dict'; id: string; entries: Array<{ key: string; value: Value }> }
  | { kind: 'object'; id: string; type: string; attrs: Record<string, Value> };

export type StackFrame = {
  id: string;
  name: string;
  locals: Record<string, Value>;
  returnValue?: Value;
};

export type Snapshot = {
  step: number;
  line: number;
  stack: StackFrame[];
  heap: Record<string, HeapObject>;
  globals: Record<string, Value>;
  event: 'call' | 'return' | 'line' | 'exception';
  highlight?: { type: 'read' | 'write'; target: string };
  stdout?: string;
};

export type ExampleProgram = {
  id: string;
  name: string;
  hint: string;
  code: string;
};

export type Language = 'python' | 'cpp' | 'java';
