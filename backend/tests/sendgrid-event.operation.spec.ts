import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { SendgridEventOperation } from "#services/legacy/collections/message/operations/sendgrid-event.operation";
import { StorageService } from "#services/storage_service";

test.group("SendgridEventOperation", (group) => {
  const sendgridEventOperation = new SendgridEventOperation();
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
    messageStorageUpdateStub.resolves({});
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should be rejected if blApiRequest.data is empty or undefined", async ({ assert }) => {
    const blApiRequest = {
      data: null,
    };

    return assert.rejects(() => sendgridEventOperation.run(blApiRequest));
  });

  test("should be rejected if blApiRequest.data is not an array", async ({ assert }) => {
    const blApiRequest = {
      data: { something: "else" },
    };

    return assert.rejects(() => sendgridEventOperation.run(blApiRequest));
  });

  test('should return true if sendgridEvent email type is not "reminder"', async ({ assert }) => {
    const blApiRequest = {
      data: [
        {
          unique_args: {
            type: "receipt",
          },
        },
      ],
    };

    return assert.doesNotReject(() => sendgridEventOperation.run(blApiRequest));
  });

  test("should get correct message based on info in sendgrid event", async ({ assert }) => {
    const sendgridEvent = {
      email: "some@email.com",
      timestamp: 1234,
      "smtp-id": "<abc>",
      event: "bounce",
      category: "reminder",
      sg_event_id: "abcde",
      sg_message_id: "1234",
      bl_message_id: "blMessage1",
      bl_message_type: "reminder",
    };

    const blApiRequest = { data: [sendgridEvent] };

    messageStorageUpdateStub.resolves({});

    messageStorageGetIdStub.withArgs("blMessage1").resolves({ id: "blMessage1" });

    await sendgridEventOperation.run(blApiRequest);
    assert.equal(messageStorageGetIdStub.lastCall.args[0], "blMessage1");
  });

  test("should update correct message with sendgrid event", async ({ assert }) => {
    const sendgridEvent = {
      email: "some@email.com",
      timestamp: 1234,
      "smtp-id": "<abc>",
      event: "bounce",
      category: "reminder",
      sg_event_id: "abcde",
      sg_message_id: "1234",
      bl_message_id: "blMessage1",
      bl_message_type: "reminder",
    };

    const blApiRequest = { data: [sendgridEvent] };

    messageStorageGetIdStub.withArgs("blMessage1").resolves({ id: "blMessage1" });

    messageStorageUpdateStub.resolves({});

    await sendgridEventOperation.run(blApiRequest);
    const args = messageStorageUpdateStub.lastCall.args;
    assert.equal(args[0], "blMessage1");
    assert.deepEqual(args[1], { events: [sendgridEvent] });
  });
});
