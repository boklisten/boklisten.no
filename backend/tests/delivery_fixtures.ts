import Delivery from "#models/delivery";
import type { Delivery as DeliveryDto } from "#shared/delivery/delivery";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

type DeliveryColumns = Pick<Delivery, (typeof Delivery.$columns)[number]>;

/** A complete Bring shipment to a mailbox; override `method` and `branchId` for a pickup. */
const BRING_COLUMNS = {
  method: "bring",
  amount: 0,
  bringAmount: 149,
  estimatedDelivery: null,
  facilityAddress: "Martin Lingesvei 25",
  facilityPostalCode: "1364",
  facilityPostalCity: "FORNEBU",
  shipmentName: "Ola Nordmann",
  shipmentAddress: "Storgata 1",
  shipmentPostalCode: "0155",
  shipmentPostalCity: "OSLO",
  fromPostalCode: "1364",
  toPostalCode: "0155",
  product: "3584",
  trackingNumber: null,
} as const satisfies Partial<DeliveryColumns>;

const NO_SHIPMENT = Object.fromEntries(
  Object.keys(BRING_COLUMNS)
    .filter((column) => column !== "method" && column !== "amount")
    .map((column) => [column, null]),
);

function withDefaults(overrides: Partial<DeliveryColumns>): Partial<DeliveryColumns> {
  return overrides.method === "branch"
    ? { ...NO_SHIPMENT, amount: 0, ...overrides }
    : { ...BRING_COLUMNS, branchId: null, ...overrides };
}

/**
 * Inserts the delivery of an order (Bring unless `method: "branch"`) into the test Postgres and
 * reads it back. The order, and the branch of a pickup, must exist already.
 */
export async function createDelivery(
  overrides: Partial<DeliveryColumns> & Pick<DeliveryColumns, "orderId">,
): Promise<Delivery> {
  sequence++;
  const delivery = await Delivery.create({
    id: fixtureId(`de${sequence.toString(16)}`),
    ...withDefaults(overrides),
  });
  return Delivery.findOrFail(delivery.id);
}

/** A complete plain `Delivery` (Bring unless `method: "branch"`) for pure functions. */
export function deliveryDto(overrides: Partial<DeliveryDto> = {}): DeliveryDto {
  const base: DeliveryDto = {
    id: fixtureId("d0"),
    orderId: fixtureId("f0"),
    ...BRING_COLUMNS,
    branchId: null,
    createdAt: new Date("2026-08-15T10:00:00Z"),
    updatedAt: new Date("2026-08-15T10:00:00Z"),
  };
  return overrides.method === "branch"
    ? { ...base, ...NO_SHIPMENT, ...overrides }
    : { ...base, ...overrides };
}
