// oxlint-disable typescript/no-unsafe-type-assertion -- test doubles are intentionally
// incomplete; the unavoidable assertions live here instead of at every call site
import type sinon from "sinon";

type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends (infer E)[]
    ? DeepPartial<E>[]
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/** Typed, intentionally partial test double: property names and types are checked, completeness is not. */
export function mock<T>(value: DeepPartial<T> = {} as DeepPartial<T>): T {
  return value as T;
}

/** A stubbed method, viewed as the SinonStub that replaced it. */
export function asStub(method: unknown): sinon.SinonStub {
  return method as sinon.SinonStub;
}

/**
 * Bypasses type checking entirely: for stub arguments whose type infers as `never`
 * (sinon cannot infer generic or overloaded methods) and for deliberately
 * out-of-contract test data.
 */
export function unchecked(value: unknown): never {
  return value as never;
}
