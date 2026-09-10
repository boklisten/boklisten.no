import BadRequestException from "#exceptions/bad_request_exception";
import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { OrderHistoryService } from "#services/order_history_service";
import { RefundRequestService } from "#services/refund_request_service";
import { findSignatureException } from "#services/signature_helper";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import { planCheckout } from "#services/stand_cart/stand_cart_order_builder";
import type { CheckoutLine } from "#services/stand_cart/stand_cart_order_builder";
import {
  StandCartPayment,
  toMsisdn,
  VIPPS_REQUEST_STATE,
} from "#services/stand_cart/stand_cart_payment";
import { StandCartPlacement } from "#services/stand_cart/stand_cart_placement";
import { StandCartRefund } from "#services/stand_cart/stand_cart_refund";
import { StorageService } from "#services/storage_service";
import { UserService } from "#services/user_service";
import { normalizeBankAccount } from "#shared/bank_account";
import type { Delivery } from "#shared/delivery/delivery";
import type { DeliveryInfoBring } from "#shared/delivery/delivery-info/delivery-info-bring";
import type { Order } from "#shared/order/order";
import type {
  StandCartCheckoutPayment,
  StandCartCheckoutState,
  StandCartCheckoutStatus,
  StandCartChoice,
  StandCartConfirmation,
  StandCartRefundPlan,
  StandCartSource,
  StandCartVippsRefund,
} from "#shared/stand_cart";
import {
  BLID_REQUIRED_ACTION_TYPES,
  findOption,
  HANDOUT_ACTION_TYPES,
  needsBlid,
  unlinkedBlidMessage,
} from "#shared/stand_cart";
import type { UserDetail } from "#shared/user-detail";
import { USER_PERMISSION } from "#shared/user-permission";

export interface StandCartCheckoutRequest {
  customerId: string;
  branchId: string;
  lines: {
    source: StandCartSource;
    choice: StandCartChoice;
    blid?: string | undefined;
    /** The price the cart showed the employee; the checkout refuses when the server's differs. */
    expectedPrice: number;
  }[];
  payment: StandCartCheckoutPayment | null;
  /** Set when the books go by mail; only valid when a source order had a Bring delivery. */
  delivery: { trackingNumber: string } | null;
  notifyByEmail: boolean;
  confirmed: StandCartConfirmation[];
}

export const CART_CHANGED_MESSAGE = "Handlekurven har endret seg. Se over den og prøv igjen.";

/** The lines of a checkout, and the customer and branch they belong to. */
export type StandCartLinesRequest = Pick<
  StandCartCheckoutRequest,
  "customerId" | "branchId" | "lines"
>;

/** Every line priced again by the server, so no price or option the browser sent is trusted. */
async function resolveLines(request: StandCartLinesRequest, now: Date): Promise<CheckoutLine[]> {
  const lines: CheckoutLine[] = [];
  for (const submitted of request.lines) {
    const resolution = await StandCartLineResolver.resolveWithContext(
      {
        customerId: request.customerId,
        branchId: request.branchId,
        source: submitted.source,
        blid: submitted.blid,
      },
      now,
    );
    if (resolution.kind === "refused") {
      throw new BadRequestException(resolution.message);
    }
    if (resolution.kind === "unlinked") {
      throw new BadRequestException(unlinkedBlidMessage(resolution.blid));
    }
    const { line, context } = resolution;
    const option = findOption(line, submitted.choice);
    if (!option) {
      throw new BadRequestException(`«${line.title}»: valget er ikke lenger tilgjengelig`);
    }
    if (!option.available) {
      throw new BadRequestException(`«${line.title}»: ${option.reason ?? "ikke tilgjengelig"}`);
    }
    if (option.price !== submitted.expectedPrice) {
      throw new BadRequestException(`«${line.title}» har fått ny pris. ${CART_CHANGED_MESSAGE}`);
    }
    lines.push({ line, context, option });
  }
  return lines;
}

function assertLinesAreSound(lines: CheckoutLine[]): void {
  const keys = new Set<string>();
  const blids = new Set<string>();
  for (const { line, option } of lines) {
    if (keys.has(line.key)) {
      throw new BadRequestException(`«${line.title}» er lagt til to ganger`);
    }
    keys.add(line.key);
    if (line.blid !== null && HANDOUT_ACTION_TYPES.includes(option.type)) {
      if (blids.has(line.blid)) {
        throw new BadRequestException(`Unik ID ${line.blid} er lagt til to ganger`);
      }
      blids.add(line.blid);
    }
    if (needsBlid(line.blid, option.type)) {
      throw new BadRequestException(`«${line.title}» må skannes før den kan deles ut`);
    }
  }
}

async function assertConfirmed(
  lines: CheckoutLine[],
  customer: UserDetail,
  confirmed: StandCartConfirmation[],
): Promise<void> {
  const handouts = lines.filter(({ option }) => HANDOUT_ACTION_TYPES.includes(option.type));
  const peer = handouts
    .flatMap(({ line }) => line.notes)
    .find((note) => note.kind === "peer-match");
  if (peer && !confirmed.includes("peer-match")) {
    throw new BadRequestException(
      `Kunden skal få boka fra ${peer.deliverFromName}. Bekreft at den skal deles ut på stand likevel.`,
    );
  }
  const loans = handouts.filter(({ option }) => BLID_REQUIRED_ACTION_TYPES.includes(option.type));
  if (loans.length > 0 && !confirmed.includes("missing-signature")) {
    const exception = await findSignatureException(customer);
    if (exception !== null) {
      throw new BadRequestException(
        "Kunden mangler gyldig signatur. Bekreft at bøkene skal deles ut likevel.",
      );
    }
  }
}

/** The Bring delivery of the first source order that has one, for the copy onto the new order. */
async function findBringDelivery(lines: CheckoutLine[]): Promise<Delivery | null> {
  for (const { context } of lines) {
    if (context.kind !== "order" || !context.order.delivery) {
      continue;
    }
    const delivery = await StorageService.Deliveries.getOrNull(context.order.delivery);
    if (delivery?.method === "bring") {
      return delivery;
    }
  }
  return null;
}

function isBringInfo(info: Delivery["info"]): info is DeliveryInfoBring {
  return "facilityAddress" in info;
}

/** A zero-amount copy of the original delivery: the customer paid for shipping when ordering. */
async function attachDelivery(
  order: Order,
  original: Delivery,
  trackingNumber: string,
): Promise<Order> {
  const { info } = original;
  if (!isBringInfo(info)) {
    throw new BadRequestException("Leveringen på den opprinnelige bestillingen mangler adresse");
  }
  const delivery = await StorageService.Deliveries.add({
    method: "bring",
    order: order.id,
    amount: 0,
    info: {
      from: info.from,
      ...(info.to === undefined ? {} : { to: info.to }),
      facilityAddress: info.facilityAddress,
      ...(info.shipmentAddress === undefined ? {} : { shipmentAddress: info.shipmentAddress }),
      trackingNumber,
      estimatedDelivery: null,
      amount: 0,
      taxAmount: 0,
    },
  });
  return StorageService.Orders.update(order.id, { delivery: delivery.id, handoutByDelivery: true });
}

function describeForVipps(lines: CheckoutLine[]): string {
  const titles = lines.map(({ line }) => `«${line.title}»`);
  return titles.length === 1 ? `Boklisten: ${titles[0]}` : `Boklisten: ${titles.length} bøker`;
}

/** How the money moves, decided before anything is written so a bad request leaves no order behind. */
type MoneyPlan =
  | { kind: "none" }
  | { kind: "record"; method: "cash" | "card" }
  | { kind: "vipps-push"; msisdn: string }
  | { kind: "vipps-refund"; refunds: StandCartVippsRefund[] }
  | { kind: "bank-transfer"; accountNumber: string; comment: string | null };

export const REFUND_NEEDS_MANUAL_MESSAGE =
  "Refusjonen kan ikke gjøres via Vipps og må registreres manuelt";

async function planRefund(
  payment: StandCartCheckoutPayment | null,
  lines: CheckoutLine[],
  now: Date,
): Promise<MoneyPlan> {
  switch (payment?.method) {
    case "vipps-refund": {
      const plan = await StandCartRefund.plan(lines, now);
      if (plan?.kind !== "vipps") {
        throw new BadRequestException(REFUND_NEEDS_MANUAL_MESSAGE);
      }
      return { kind: "vipps-refund", refunds: plan.refunds };
    }
    case "bank-transfer": {
      const accountNumber = normalizeBankAccount(payment.accountNumber);
      if (accountNumber === null) {
        throw new BadRequestException("Oppgi et gyldig norsk kontonummer");
      }
      return { kind: "bank-transfer", accountNumber, comment: payment.comment };
    }
    default: {
      throw new BadRequestException("Velg hvordan refusjonen skal gjøres");
    }
  }
}

function planPayment(payment: StandCartCheckoutPayment | null): MoneyPlan {
  switch (payment?.method) {
    case "cash":
    case "card": {
      return { kind: "record", method: payment.method };
    }
    case "vipps": {
      if (!payment.phoneNumber) {
        throw new BadRequestException("Oppgi kundens telefonnummer for Vipps");
      }
      return { kind: "vipps-push", msisdn: toMsisdn(payment.phoneNumber) };
    }
    default: {
      throw new BadRequestException("Velg betalingsmåte");
    }
  }
}

async function planMoney(
  request: StandCartCheckoutRequest,
  lines: CheckoutLine[],
  total: number,
  now: Date,
): Promise<MoneyPlan> {
  if (total === 0) {
    return { kind: "none" };
  }
  return total < 0 ? planRefund(request.payment, lines, now) : planPayment(request.payment);
}

async function present(
  order: Order,
  status: StandCartCheckoutStatus,
): Promise<StandCartCheckoutState> {
  const placed = status === "paid" || status === "placed";
  return {
    status,
    orderId: order.id,
    order: placed ? await OrderHistoryService.getOne(order.id, order.customer, "employee") : null,
  };
}

/** The employee who started the checkout, as recorded on the order, with their permission. */
async function employeeOf(order: Order): Promise<MonitoredEmployee> {
  if (!order.employee) {
    throw new Error(`stand order ${order.id} has no employee`);
  }
  const user = await UserService.getByUserDetailsId(order.employee);
  return { detailsId: order.employee, permission: user?.permission ?? USER_PERMISSION.EMPLOYEE };
}

async function settleAuthorizedVipps(order: Order): Promise<StandCartCheckoutState> {
  const withPayment = await StandCartPayment.record(order, "vipps-epayment");
  const placed = await StandCartPlacement.place(withPayment, await employeeOf(order));
  await StorageService.Orders.update(order.id, { checkoutState: VIPPS_REQUEST_STATE.paid });
  await StandCartPayment.captureVipps(order);
  return present(placed, "paid");
}

async function markVippsOutcome(
  order: Order,
  status: Exclude<StandCartCheckoutStatus, "pending" | "paid" | "placed">,
): Promise<StandCartCheckoutState> {
  await StorageService.Orders.update(order.id, { checkoutState: VIPPS_REQUEST_STATE[status] });
  return present(order, status);
}

export const StandCartCheckoutService = {
  /**
   * Turns the employee's cart into one placed order for the customer. Card, cash and refund
   * orders are placed at once on the employee's word; a Vipps push waits for the customer and
   * is settled by `status()`.
   */
  async checkout(
    request: StandCartCheckoutRequest,
    employee: MonitoredEmployee,
    now = new Date(),
  ): Promise<StandCartCheckoutState> {
    if (request.lines.length === 0) {
      throw new BadRequestException("Handlekurven er tom");
    }
    const [customer, branch] = await Promise.all([
      StorageService.UserDetails.getOrNull(request.customerId),
      StorageService.Branches.getOrNull(request.branchId),
    ]);
    if (!customer) {
      throw new BadRequestException("Fant ikke kunden");
    }
    if (!branch) {
      throw new BadRequestException("Fant ikke filialen");
    }

    const lines = await resolveLines(request, now);
    assertLinesAreSound(lines);
    await assertConfirmed(lines, customer, request.confirmed);
    const bringDelivery = request.delivery === null ? null : await findBringDelivery(lines);
    if (request.delivery !== null && bringDelivery === null) {
      throw new BadRequestException("Ingen av bestillingene skal sendes i posten");
    }

    const orderItems = planCheckout(lines, now);
    const total = orderItems.reduce((sum, orderItem) => sum + orderItem.amount, 0);
    const money = await planMoney(request, lines, total, now);

    let order = await StorageService.Orders.add({
      amount: total,
      orderItems,
      branch: branch.id,
      customer: customer.id,
      placed: false,
      byCustomer: false,
      employee: employee.detailsId,
      payments: [],
      handoutByDelivery: false,
      notification: { email: request.notifyByEmail },
    });
    if (bringDelivery && request.delivery) {
      order = await attachDelivery(order, bringDelivery, request.delivery.trackingNumber);
    }

    switch (money.kind) {
      case "vipps-push": {
        await StandCartPayment.requestVipps(order, money.msisdn, describeForVipps(lines));
        return present(order, "pending");
      }
      case "vipps-refund": {
        const refunded = await StandCartPayment.refundVipps(order, money.refunds);
        const placed = await StandCartPlacement.place(refunded.order, employee, now);
        if (refunded.shortfall > 0) {
          await RefundRequestService.send({
            order: placed,
            employeeDetailsId: employee.detailsId,
            amount: refunded.shortfall,
            accountNumber: null,
            comment: null,
          });
        }
        return present(placed, "paid");
      }
      case "bank-transfer": {
        order = await StandCartPayment.record(order, "bank-transfer");
        const placed = await StandCartPlacement.place(order, employee, now);
        await RefundRequestService.send({
          order: placed,
          employeeDetailsId: employee.detailsId,
          amount: -total,
          accountNumber: money.accountNumber,
          comment: money.comment,
        });
        return present(placed, "paid");
      }
      case "record": {
        order = await StandCartPayment.record(order, money.method);
        return present(await StandCartPlacement.place(order, employee, now), "paid");
      }
      default: {
        return present(await StandCartPlacement.place(order, employee, now), "placed");
      }
    }
  },

  /**
   * How a refund would go back to the customer, for the pay step to show before the employee
   * confirms. The lines are priced again the way checkout prices them. Null when nothing is
   * refunded.
   */
  async refundPlan(
    request: StandCartLinesRequest,
    now = new Date(),
  ): Promise<StandCartRefundPlan | null> {
    const lines = await resolveLines(request, now);
    return StandCartRefund.plan(lines, now);
  },

  /**
   * Asks Vipps how the request went and places the order the first time it comes back approved.
   * Safe to call repeatedly: a placed order is reported as paid without touching Vipps again.
   */
  async status(orderId: string): Promise<StandCartCheckoutState> {
    const order = await StorageService.Orders.get(orderId);
    if (order.placed) {
      return present(order, "paid");
    }
    switch (order.checkoutState) {
      case VIPPS_REQUEST_STATE.aborted: {
        return present(order, "aborted");
      }
      case VIPPS_REQUEST_STATE.expired: {
        return present(order, "expired");
      }
      case VIPPS_REQUEST_STATE.cancelled: {
        return present(order, "cancelled");
      }
      case VIPPS_REQUEST_STATE.created:
      case VIPPS_REQUEST_STATE.paid: {
        break;
      }
      default: {
        throw new BadRequestException("Denne ordren venter ikke på en Vipps-betaling");
      }
    }
    const outcome = await StandCartPayment.vippsOutcome(order);
    switch (outcome) {
      case "authorized": {
        return settleAuthorizedVipps(order);
      }
      case "pending": {
        return present(order, "pending");
      }
      default: {
        return markVippsOutcome(order, outcome);
      }
    }
  },

  /** The employee gives up waiting. If the customer approved in the meantime, the order is settled instead. */
  async cancel(orderId: string): Promise<StandCartCheckoutState> {
    const order = await StorageService.Orders.get(orderId);
    if (order.placed) {
      return present(order, "paid");
    }
    if (order.checkoutState !== VIPPS_REQUEST_STATE.created) {
      return StandCartCheckoutService.status(orderId);
    }
    if (!(await StandCartPayment.cancelVipps(order))) {
      // Typically the customer approved just now; the status check settles it
      return StandCartCheckoutService.status(orderId);
    }
    return markVippsOutcome(order, "cancelled");
  },
};
