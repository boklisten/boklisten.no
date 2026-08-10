import BookHandover from "#models/book_handover";
import MatchParticipant from "#models/match_participant";
import { StorageService } from "#services/storage_service";
import { UserService } from "#services/user_service";

export class DeleteUserService {
  public async deleteUser(userDetailId: string): Promise<void> {
    const user = await UserService.getByUserDetailsId(userDetailId);
    if (!user) return;
    await StorageService.Users.remove(user.id);
  }

  async mergeIntoOtherUser(fromUser: string, toUser: string): Promise<void> {
    const [fromUserDetails, toUserDetails] = await Promise.all([
      StorageService.UserDetails.get(fromUser),
      StorageService.UserDetails.get(toUser),
    ]);
    const newOrderRefs = [...(fromUserDetails.orders ?? []), ...(toUserDetails.orders ?? [])];
    const newCustomerItemRefs = [
      ...(fromUserDetails.customerItems ?? []),
      ...(toUserDetails.customerItems ?? []),
    ];
    const newSignatureRefs = [...fromUserDetails.signatures, ...toUserDetails.signatures];

    await Promise.all([
      StorageService.UserDetails.update(toUser, {
        orders: newOrderRefs,
        customerItems: newCustomerItemRefs,
        signatures: newSignatureRefs,
      }),
      StorageService.CustomerItems.updateMany({ customer: fromUser }, { customer: toUser }),
      StorageService.Invoices.updateMany(
        {
          "customerInfo.userDetail": fromUser,
        },
        {
          customerInfo: {
            userDetail: toUser,
          },
        },
      ),
      StorageService.Orders.updateMany(
        {
          placed: true,
          customer: fromUser,
        },
        { customer: toUser },
      ),
      StorageService.Payments.updateMany(
        {
          customer: fromUser,
        },
        { customer: toUser },
      ),
      MatchParticipant.query().where("userDetailId", fromUser).update({ userDetailId: toUser }),
      BookHandover.query().where("fromUserDetailId", fromUser).update({ fromUserDetailId: toUser }),
      BookHandover.query().where("toUserDetailId", fromUser).update({ toUserDetailId: toUser }),
    ]);
  }
}
