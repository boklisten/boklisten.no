export class BlError extends Error {
  public override name = "BlError";
  private codeValue: number;
  private readonly stackedErrors: BlError[];
  private readonly storeEntries: { key: string; value: unknown }[];

  constructor(message: string) {
    super(message);
    this.stackedErrors = [];
    this.storeEntries = [];
    this.codeValue = 0;
  }

  add(blError: BlError): this {
    this.stackedErrors.push(blError);
    return this;
  }

  store(key: string, value: unknown) {
    this.storeEntries.push({ key, value });
    return this;
  }

  getStore(): { key: string; value: unknown }[] {
    return this.storeEntries;
  }

  get errorStack(): BlError[] {
    return this.stackedErrors;
  }

  msg(message: string): this {
    this.message = message;
    return this;
  }

  getMsg(): string {
    return this.message;
  }

  code(code: number) {
    this.codeValue = code;
    return this;
  }

  getCode(): number {
    if (!this.codeValue) {
      return 0;
    }
    return this.codeValue;
  }
}
