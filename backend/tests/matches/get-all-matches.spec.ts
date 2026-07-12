import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { getAllMatches } from "#services/match_helpers/get_all_matches";
import { StorageService } from "#services/storage_service";

chaiUse(chaiAsPromised);
should();

test.group("getAllMatches", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  const custA = "5d765db5fc8c47001c408d81";
  const custB = "5d765db5fc8c47001c408d82";
  const custC = "5d765db5fc8c47001c408d83";

  test("returns all user and stand matches with hydrated name/phone/email and item details", async () => {
    const userMatch = {
      id: "um1",
      customerA: custA,
      customerB: custB,
      expectedAToBItems: ["itemA"],
      expectedBToAItems: ["itemB"],
      receivedBlIdsCustomerA: [],
      deliveredBlIdsCustomerA: [],
      receivedBlIdsCustomerB: [],
      deliveredBlIdsCustomerB: [],
      itemsLockedToMatch: true,
      meetingInfo: { location: "Skolen" },
    };
    const standMatch = {
      id: "sm1",
      customer: custC,
      expectedHandoffItems: ["itemC"],
      expectedPickupItems: [],
      receivedItems: [],
      deliveredItems: [],
      meetingInfo: { location: "Stand" },
    };

    sandbox.stub(StorageService.UserMatches, "aggregate").resolves([userMatch] as any);
    sandbox.stub(StorageService.StandMatches, "aggregate").resolves([standMatch] as any);

    sandbox.stub(StorageService.UserDetails, "aggregate").resolves([
      { id: custA, name: "Ola", phone: "111", email: "ola@x.no" },
      { id: custB, name: "Kari", phone: "222", email: "kari@x.no" },
      { id: custC, name: "Per", phone: "333", email: "per@x.no" },
    ] as any);

    sandbox.stub(StorageService.UniqueItems, "aggregate").resolves([] as any);
    sandbox.stub(StorageService.Items, "getMany").resolves([
      { id: "itemA", title: "Bok A" },
      { id: "itemB", title: "Bok B" },
      { id: "itemC", title: "Bok C" },
    ] as any);

    const result = await getAllMatches();

    expect(result.userMatches).to.have.length(1);
    expect(result.userMatches[0]!.customerADetails).to.deep.equal({
      name: "Ola",
      phone: "111",
      email: "ola@x.no",
    });
    expect(result.userMatches[0]!.customerBDetails.email).to.equal("kari@x.no");
    expect(result.userMatches[0]!.itemDetails["itemA"]).to.deep.equal({
      id: "itemA",
      title: "Bok A",
    });

    expect(result.standMatches).to.have.length(1);
    expect(result.standMatches[0]!.customerDetails).to.deep.equal({
      name: "Per",
      phone: "333",
      email: "per@x.no",
    });
    expect(result.standMatches[0]!.itemDetails["itemC"]).to.deep.equal({
      id: "itemC",
      title: "Bok C",
    });
  });
});
