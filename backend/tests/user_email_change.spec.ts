import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import EmailVerification from "#models/email_verification";
import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { userFieldsFrom, UserService } from "#services/user_service";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

/** The user's current details as `updateOwnDetails` takes them, with another email if given. */
function ownDetails(user: User, email = user.email) {
  return {
    ...userFieldsFrom({
      name: user.name ?? "",
      phone: user.phone ?? "",
      address: user.address ?? "",
      postalCode: user.postalCode ?? "",
      dob: user.dob?.toJSDate() ?? new Date(),
      branchMembershipId: user.branchMembershipId,
      guardianName: user.guardianName,
      guardianEmail: user.guardianEmail,
      guardianPhone: user.guardianPhone,
    }),
    email,
  };
}

test.group("Changing a user's email", (group) => {
  const sandbox = createSandbox();
  let sendEmailVerification: sinon.SinonStub;
  group.each.setup(async () => {
    const truncate = await testUtils.db().truncate();
    sendEmailVerification = sandbox.stub(DispatchService, "sendEmailVerification").resolves();
    return async () => {
      sandbox.restore();
      await truncate();
    };
  });

  test("their own new email starts unconfirmed and gets a fresh link", async ({ assert }) => {
    const user = await createUser({ id: CUSTOMER_ID, emailConfirmed: true });

    await UserService.updateOwnDetails(user, ownDetails(user, "ny@example.com"));

    const stored = await User.findOrFail(CUSTOMER_ID);
    assert.equal(stored.email, "ny@example.com");
    assert.isFalse(stored.emailConfirmed);
    const links = await EmailVerification.query().where("userId", CUSTOMER_ID);
    assert.lengthOf(links, 1);
    assert.isTrue(sendEmailVerification.calledOnceWith("ny@example.com", links[0]!.id));
  });

  test("a link sent to the old address no longer confirms the new one", async ({ assert }) => {
    const user = await createUser({ id: CUSTOMER_ID, emailConfirmed: false });
    const oldLink = await EmailVerification.create({ userId: CUSTOMER_ID });

    await UserService.updateOwnDetails(user, ownDetails(user, "ny@example.com"));

    assert.isNull(await EmailVerification.find(oldLink.id));
  });

  test("saving the same email, in any case, keeps it confirmed and sends nothing", async ({
    assert,
  }) => {
    const user = await createUser({
      id: CUSTOMER_ID,
      email: "Kari.Nordmann@Example.com",
      emailConfirmed: true,
    });
    const pendingLink = await EmailVerification.create({ userId: CUSTOMER_ID });

    await UserService.updateOwnDetails(user, ownDetails(user, "kari.nordmann@example.com"));

    const stored = await User.findOrFail(CUSTOMER_ID);
    assert.isTrue(stored.emailConfirmed);
    assert.equal(stored.email, "Kari.Nordmann@Example.com");
    assert.isNotNull(await EmailVerification.find(pendingLink.id));
    assert.isTrue(sendEmailVerification.notCalled);
  });

  test("an employee vouching for the new email confirms it without a link", async ({ assert }) => {
    const user = await createUser({ id: CUSTOMER_ID, emailConfirmed: false });
    const oldLink = await EmailVerification.create({ userId: CUSTOMER_ID });

    await UserService.updateAsEmployee(user, { email: "ny@example.com", emailConfirmed: true });

    const stored = await User.findOrFail(CUSTOMER_ID);
    assert.isTrue(stored.emailConfirmed);
    assert.isNull(await EmailVerification.find(oldLink.id));
    assert.isTrue(sendEmailVerification.notCalled);
  });

  test("an employee's unconfirmed new email gets a fresh link", async ({ assert }) => {
    const user = await createUser({ id: CUSTOMER_ID, emailConfirmed: true });

    await UserService.updateAsEmployee(user, { email: "ny@example.com", emailConfirmed: false });

    assert.isTrue(sendEmailVerification.calledOnce);
    assert.equal(sendEmailVerification.firstCall.args[0], "ny@example.com");
  });
});
