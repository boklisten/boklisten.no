export class BlError extends Error {
  public override name = "BlError";
  private _code: number;
  private _className: string | undefined;
  private _methodName: string | undefined;
  private readonly _errorStack: BlError[];
  private readonly _data: unknown;
  private readonly _store: { key: string; value: unknown }[];

  constructor(message: string) {
    super(message);
    this._errorStack = [];
    this._store = [];
    this._code = 0;
  }

  add(blError: BlError): this {
    this._errorStack.push(blError);
    return this;
  }

  store(key: string, value: unknown) {
    this._store.push({ key, value });
    return this;
  }

  getStore(): { key: string; value: unknown }[] {
    return this._store;
  }

  data(data: unknown): this {
    // @ts-expect-error fixme: auto ignored  bad typing
    this.data = data;
    return this;
  }

  getData() {
    return this._data;
  }

  get errorStack(): BlError[] {
    return this._errorStack;
  }

  className(className: string): this {
    this._className = className;
    return this;
  }

  getClassName(): string | undefined {
    return this._className;
  }

  methodName(methodName: string): this {
    this._methodName = methodName;
    return this;
  }

  getMethodName(): string | undefined {
    return this._methodName;
  }

  msg(message: string): this {
    this.message = message;
    return this;
  }

  getMsg(): string {
    return this.message;
  }

  code(code: number) {
    this._code = code;
    return this;
  }

  getCode(): number {
    if (!this._code) {
      return 0;
    }
    return this._code;
  }
}
