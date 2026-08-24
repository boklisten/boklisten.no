import { test } from "@japa/runner";
import { ObjectId } from "mongodb";

import { MongooseModelCreator } from "#models/mongoose/storage/mongoose-schema-creator";

test.group("MongooseModelCreator", async () => {
  test("should convert objectIDs in objects to strings", async ({ assert }) => {
    const input = {
      _id: new ObjectId(),
      user: new ObjectId(),
      items: [new ObjectId(), new ObjectId()],
    };
    const expectedOutput = {
      id: input._id.toString(),
      user: input.user.toString(),
      items: input.items.map((item) => item.toString()),
    };
    MongooseModelCreator.transformObject(input, undefined);
    assert.deepEqual(input, expectedOutput);
  });

  test("should convert objectIDs in an array to strings", async ({ assert }) => {
    const input = [new ObjectId(), new ObjectId()];
    const expectedOutput = input.map((item) => item.toString());
    MongooseModelCreator.transformObject(input, undefined);
    assert.deepEqual(input, expectedOutput);
  });

  test("should convert objectIDs not named 'id' in nested objects to string", async ({
    assert,
  }) => {
    const input = { orderItems: [{ item: new ObjectId() }] };
    const expectedOutput = {
      orderItems: [{ item: input.orderItems[0]?.item.toString() }],
    };
    MongooseModelCreator.transformObject(input, undefined);
    assert.deepEqual(input, expectedOutput);
  });

  test("should rename '_id'-keys to 'id'", async ({ assert }) => {
    const input = { orderItems: [{ _id: "hello" }] };
    const expectedOutput = { orderItems: [{ id: "hello" }] };
    MongooseModelCreator.transformObject(input, undefined);
    assert.deepEqual(input, expectedOutput);
  });

  test("should not replace existing 'id'-values with '_id'-values", async ({ assert }) => {
    const input = { orderItems: [{ _id: "hello", id: "you" }] };
    const expectedOutput = { orderItems: [{ id: "you" }] };
    MongooseModelCreator.transformObject(input, undefined);
    assert.deepEqual(input, expectedOutput);
  });
});
