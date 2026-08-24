import { test } from "@japa/runner";

import { PriceService } from "#services/legacy/price.service";

test.group("PriceService", async () => {
  test("should return 30 when given 33", async ({ assert }) => {
    const priceService = new PriceService({ roundDown: true });
    assert.deepEqual(priceService.round(33), 30);
  });

  test("should return 20 when given 28.4", async ({ assert }) => {
    const priceService = new PriceService({ roundDown: true });
    assert.deepEqual(priceService.round(28.4), 20);
  });

  test("should return 40 when given 33", async ({ assert }) => {
    const priceService = new PriceService({ roundUp: true });
    assert.deepEqual(priceService.round(33), 40);
  });

  test("should return 30 when given 28.4", async ({ assert }) => {
    const priceService = new PriceService({ roundUp: true });
    assert.deepEqual(priceService.round(28.4), 30);
  });

  test("should return 40.50 when input is 40.500000178", async ({ assert }) => {
    const priceService = new PriceService();
    assert.equal(priceService.sanitize(40.500000178), 40.5);
  });

  test("should return 125.01 when input is 125.009", async ({ assert }) => {
    const priceService = new PriceService();
    assert.equal(priceService.sanitize(125.009), 125.01);
  });
});
