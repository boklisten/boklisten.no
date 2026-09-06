export class BlError extends Error {
  public override name = "BlError";
  private _code: number;
  private readonly _errorStack: BlError[];
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

  get errorStack(): BlError[] {
    return this._errorStack;
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
