import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { BringService } from "#services/bring/bring_service";

const DAY_MS = 24 * 60 * 60 * 1000;

function registerResponse(cities: Record<string, string>): Response {
  return Response.json({
    postal_codes: Object.entries(cities).map(([postal_code, city]) => ({ postal_code, city })),
  });
}

test.group("BringService.postalCities", (group) => {
  let sandbox: sinon.SinonSandbox;
  let fetchStub: sinon.SinonStub;
  // The register lives as long as the process, so each test starts days after the last one.
  let now = Date.now();

  group.each.setup(() => {
    now += 10 * DAY_MS;
    sandbox = createSandbox();
    sandbox.useFakeTimers({ now, toFake: ["Date"] });
    fetchStub = sandbox.stub(globalThis, "fetch");
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("looks codes up in a register fetched once", async ({ assert }) => {
    fetchStub.resolves(registerResponse({ "0150": "Oslo", "3850": "Kviteseid" }));

    const cityOf = await BringService.postalCities();
    await BringService.postalCities();

    assert.equal(fetchStub.callCount, 1);
    assert.equal(cityOf("0150"), "Oslo");
    assert.equal(cityOf("3850 "), "Kviteseid");
    assert.isNull(cityOf("9999"));
    assert.isNull(cityOf(null));
  });

  test("fetches the register again after a day", async ({ assert }) => {
    fetchStub.onFirstCall().resolves(registerResponse({ "0150": "Oslo" }));
    fetchStub.onSecondCall().resolves(registerResponse({ "0150": "Oslo", "0151": "Oslo" }));
    await BringService.postalCities();
    sandbox.clock.tick(DAY_MS + 1);

    const cityOf = await BringService.postalCities();

    assert.equal(fetchStub.callCount, 2);
    assert.equal(cityOf("0151"), "Oslo");
  });

  test("keeps the old register while Bring is failing", async ({ assert }) => {
    fetchStub.onFirstCall().resolves(registerResponse({ "0150": "Oslo" }));
    fetchStub.onSecondCall().resolves(new Response("", { status: 503 }));
    await BringService.postalCities();
    sandbox.clock.tick(DAY_MS + 1);

    const cityOf = await BringService.postalCities();

    assert.equal(cityOf("0150"), "Oslo");
  });
});
