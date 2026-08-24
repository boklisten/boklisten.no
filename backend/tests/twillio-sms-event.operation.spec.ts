import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { TwilioSmsEventOperation } from "#services/legacy/collections/message/operations/twillio-sms-event.operation";
import { StorageService } from "#services/storage_service";
import { Message } from "#shared/message/message";

test.group("TwilioSmsEventOperation", (group) => {
  const twilioSmsEventOperation = new TwilioSmsEventOperation();

  let messageStorageGetIdStub: sinon.SinonStub;
  let messageStorageUpdateStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => {
    sandbox = createSandbox();
    const messagesStub = {
      get: sandbox.stub(),
      update: sandbox.stub(),
    };
    sandbox.stub(StorageService, "Messages").value(messagesStub);
    messageStorageGetIdStub = messagesStub.get;
    messageStorageUpdateStub = messagesStub.update;
    messageStorageUpdateStub.resolves({} as Message);
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should be rejected if blApiRequest.data is empty or undefined", async ({ assert }) => {
    const blApiRequest = {
      data: null,
    };

    return assert.rejects(() => twilioSmsEventOperation.run(blApiRequest));
  });

  test("should be rejected if blApiRequest.query is empty or undefined", async ({ assert }) => {
    const blApiRequest = {
      data: {
        status: "sent",
        price: -0.0075,
        price_unit: "USD",
        body: "some message",
      },
    };

    return assert.rejects(() => twilioSmsEventOperation.run(blApiRequest));
  });

  test("should get correct message based on query parameter", async ({ assert }) => {
    const twilioSmsEvent = {
      status: "sent",
      price: -0.0075,
      price_unit: "USD",
      body: "some message",
    };

    const blApiRequest = {
      data: twilioSmsEvent,
      query: { bl_message_id: "blMessage1" },
    };

    messageStorageUpdateStub.resolves({} as Message);

    messageStorageGetIdStub.withArgs("blMessage1").resolves({ id: "blMessage1" } as Message);

    await twilioSmsEventOperation.run(blApiRequest);
    assert.equal(messageStorageGetIdStub.lastCall.args[0], "blMessage1");
  });

  test("should update correct message with sendgrid event", async ({ assert }) => {
    const twilioSmsEvent = {
      status: "sent",
      price: -0.0075,
      price_unit: "USD",
      body: "some message",
    };

    const blApiRequest = {
      data: [twilioSmsEvent],
      query: { bl_message_id: "blMessage1" },
    };

    messageStorageGetIdStub.withArgs("blMessage1").resolves({ id: "blMessage1" } as Message);

    messageStorageUpdateStub.resolves({} as Message);

    await twilioSmsEventOperation.run(blApiRequest);
    const args = messageStorageUpdateStub.lastCall.args;
    assert.equal(args[0], "blMessage1");
    assert.deepEqual(args[1], { smsEvents: [twilioSmsEvent] });
  });
});
