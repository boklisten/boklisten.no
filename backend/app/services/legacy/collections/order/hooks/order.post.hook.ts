import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { OrderHookBefore } from "#services/legacy/collections/order/hooks/order-hook-before";
import { UserDetailHelper } from "#services/legacy/collections/user-detail/helpers/user-detail.helper";
import { Hook } from "#services/legacy/hook";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import { Order } from "#shared/order/order";

export class OrderPostHook extends Hook {
  private orderValidator: OrderValidator;
  private orderHookBefore: OrderHookBefore;

  private userDetailHelper: UserDetailHelper;

  constructor(
    orderValidator?: OrderValidator,
    orderHookBefore?: OrderHookBefore,

    userDetailHelper?: UserDetailHelper,
  ) {
    super();
    this.orderValidator = orderValidator ?? new OrderValidator();
    this.orderHookBefore = orderHookBefore ?? new OrderHookBefore();

    this.userDetailHelper = userDetailHelper ?? new UserDetailHelper();
  }

  public override async before(requestBody: unknown, accessToken: AccessToken): Promise<boolean> {
    const [validUserDetails, validRequestBody] = await Promise.all([
      StorageService.UserDetails.get(accessToken.details).then((userDetail) =>
        this.userDetailHelper.isValid(userDetail),
      ),
      this.orderHookBefore.validate(requestBody),
    ]);
    if (!validUserDetails) {
      throw new BlError("UserDetail not set for user: " + accessToken.username).code(902);
    }
    if (!validRequestBody) {
      throw new BlError("Invalid order").code(701);
    }

    return true;
  }

  public override after(orders: Order[], accessToken?: AccessToken): Promise<Order[]> {
    if (!accessToken || accessToken.sub.length <= 0) {
      return Promise.reject(
        new BlError("accessToken was not specified when trying to process order"),
      );
    }

    if (!orders || orders.length <= 0) {
      return Promise.reject(new BlError("no orders provided").code(701));
    }

    if (orders.length > 1) {
      return Promise.reject(new BlError("orderIds included more than one id"));
    }

    const order = orders[0];
    const isAdmin = PermissionService.isPermissionEqualOrOver(accessToken.permission, "admin");

    // @ts-expect-error fixme: auto ignored
    return this.validateOrder(order, isAdmin).then(() => {
      return [order];
    });
  }

  private validateOrder(order: Order, isAdmin: boolean): Promise<Order> {
    return new Promise((resolve, reject) => {
      this.orderValidator
        .validate(order, isAdmin)
        .then(() => {
          if (order.placed) {
            return reject(new BlError("order.placed is set to true on post of order"));
          }

          return resolve(order);
        })
        .catch((blError: BlError) => {
          return reject(blError);
        });
    });
  }
}
