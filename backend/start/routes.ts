import router from "@adonisjs/core/services/router";

import { controllers } from "#generated/controllers";
import CollectionEndpoint from "#services/legacy/collection-endpoint/collection-endpoint";
import BlCollections from "#services/legacy/collections/bl-collections";
import { throttle } from "#start/limiter";

/**
 * static
 */

router.get("/", () => {
  return {};
});

router.get("/health", () => {
  return { status: "ok" };
});

/**
 * auth token
 */
router.post("/token", [controllers.auth.Tokens, "legacyToken"]);
router.post("/v2/token", [controllers.auth.Tokens, "token"]);

/**
 * auth vipps
 */
router.get("/auth/vipps/redirect", [controllers.auth.Vipps, "redirect"]);
router.get("/auth/vipps/callback", [controllers.auth.Vipps, "callback"]);

/**
 * auth local
 */
router.post("/auth/local/login", [controllers.auth.Local, "login"]).use(throttle);
router.post("/auth/local/register", [controllers.auth.Local, "register"]).use(throttle);

/**
 * password reset
 */
router
  .post("/forgot_password", [controllers.auth.PasswordReset, "requestPasswordReset"])
  .use(throttle);
router.get("/password_reset/validate/:id/:token", [
  controllers.auth.PasswordReset,
  "validatePasswordReset",
]);
router.post("/password_reset/:id", [controllers.auth.PasswordReset, "resetPassword"]);

/**
 * waiting list customers
 */
router.get("/waiting_list_customer", [controllers.WaitingListCustomer, "getAll"]);
router.post("/waiting_list_customer", [controllers.WaitingListCustomer, "create"]);
router.delete("/waiting_list_customer/:id", [controllers.WaitingListCustomer, "destroy"]);

/**
 * reminders
 */
router.post("/reminders/count_recipients", [controllers.Reminders, "countRecipients"]);

router.post("/reminders/send", [controllers.Reminders, "remind"]);

/**
 * branches
 */
router.get("/v2/branches/public", [controllers.branches.Branches, "getPublic"]);
router.get("/v2/branches", [controllers.branches.Branches, "getAll"]);
router.get("/v2/branches/:branchId", [controllers.branches.Branches, "getById"]);
router.post("/v2/branches", [controllers.branches.Branches, "add"]);
router.patch("/v2/branches", [controllers.branches.Branches, "update"]);

/**
 * branch upload
 */
router.post("/v2/branches/memberships", [controllers.branches.BranchUpload, "uploadMemberships"]);

router.post("/v2/branches/subject_choices", [
  controllers.branches.BranchUpload,
  "uploadSubjectChoices",
]);

/**
 * branch relationships
 */
router.patch("/v2/branches/relationships", [controllers.branches.BranchRelationship, "update"]);

/**
 * branch memberships
 */
router.get("/v2/branches/memberships/:branchId", [
  controllers.branches.BranchMembership,
  "getMembers",
]);

router.patch("/branches/memberships", [controllers.branches.BranchMembership, "updateMembership"]);

router.delete("/branches/memberships/direct/:branchId", [
  controllers.branches.BranchMembership,
  "removeDirectMembers",
]);

router.delete("/branches/memberships/indirect/:branchId", [
  controllers.branches.BranchMembership,
  "removeIndirectMembers",
]);

/**
 * orders
 */
router.get("/v2/orders/open_orders", [controllers.Orders, "getOpenOrders"]);
router.get("/v2/orders/placed_orders/:detailsId", [controllers.Orders, "getPlacedOrders"]);
router.post("/v2/orders/cancel_order_item", [controllers.Orders, "cancelOrderItem"]);

/**
 * editable texts
 */
router.get("/editable_texts/:id", [controllers.EditableTexts, "get"]);
router.get("/editable_texts", [controllers.EditableTexts, "getAll"]);
router.put("/editable_texts/:id", [controllers.EditableTexts, "upsert"]);
router.delete("/editable_texts/:id", [controllers.EditableTexts, "destroy"]);

/**
 * questions and answers
 */
router.get("/questions_and_answers", [controllers.QuestionsAndAnswers, "getAll"]);

router.post("/questions_and_answers", [controllers.QuestionsAndAnswers, "store"]);

router.patch("/questions_and_answers/:id", [controllers.QuestionsAndAnswers, "update"]);

router.delete("/questions_and_answers/:id", [controllers.QuestionsAndAnswers, "destroy"]);

/**
 * email verification
 */
router.post("/email_verification", [controllers.EmailVerification, "send"]);

router.get("/email_verification/:id", [controllers.EmailVerification, "verify"]);

/**
 * public blid lookup
 */
router.get("/public_blid_lookup/:blid", [controllers.PublicBlidLookup, "lookup"]);

/**
 * matches
 */
router.post("/matches/generate", [controllers.Matches, "generate"]);
router.post("/matches/notify", [controllers.Matches, "notify"]);
router.post("/user_matches/lock", [controllers.Matches, "lock"]);
router.get("/matches/me", [controllers.Matches, "getMyMatches"]);
router.post("/matches/transfer_item", [controllers.Matches, "transferItem"]);

/**
 * user detail
 */
router.get("/v2/user_details/id/:detailsId", [controllers.UserDetail, "getById"]);
router.post("/v2/user_details/search", [controllers.UserDetail, "search"]);

router.get("/v2/user_details/me", [controllers.UserDetail, "getMyDetails"]);

router.post("/v2/user_details", [controllers.UserDetail, "updateAsCustomer"]);

router.post("/v2/employee/user_details/:detailsId", [controllers.UserDetail, "updateAsEmployee"]);

/**
 * customer items
 */
router.get("/v2/customer_items", [controllers.CustomerItems, "getCustomerItems"]);

/**
 * signatures
 */
router.post("/signatures/send/:detailsId", [controllers.Signatures, "sendSignatureLink"]);

router.post("/signatures/me/send", [controllers.Signatures, "sendSignatureLinkAsCustomer"]);

router.get("/signatures/valid/:detailsId", [controllers.Signatures, "hasValidSignature"]);

router.get("/signatures/get/:detailsId", [controllers.Signatures, "getSignature"]);

router.post("/signatures/sign/:detailsId", [controllers.Signatures, "sign"]);

/**
 * Unique Ids
 */
router.get("/unique_ids/token", [controllers.UniqueIds, "getToken"]);
router.get("/unique_ids/download_pdf/:token", [controllers.UniqueIds, "downloadUniqueIdPdf"]);

/**
 * User Provisioning
 */
router.post("/users/create", [controllers.UserProvisioning, "createUsers"]);

/**
 * Unique Items
 */
router.post("/unique_items/add", [controllers.UniqueItems, "add"]);

/**
 * Order History
 */

router.get("/order_history/me/:orderId", [controllers.OrderHistory, "getMyOrder"]);

router.get("/order_history/me", [controllers.OrderHistory, "getMyOrders"]);

/**
 * Checkout
 */
router.post("/checkout", [controllers.Checkout, "initializeCheckout"]);
router.post("/v2/checkout", [controllers.KustomCheckout, "initializeCheckout"]);
router.get("/v2/checkout/snippet/:orderId", [controllers.KustomCheckout, "getSnippet"]);
router.post("/v2/checkout/push", [controllers.KustomCheckout, "receivePush"]);
router.post("/checkout/confirm/:orderId", [controllers.Checkout, "confirmCheckout"]);

router.post("/checkout/vipps/callback", [controllers.Checkout, "handleVippsCallback"]);

router.get("/checkout/poll/:orderId", [controllers.Checkout, "pollPayment"]);

/**
 * Subjects
 */
router.get("/subjects/:branchId", [controllers.Subjects, "getBranchSubjects"]);

router.get("/branch_items/:branchId", [controllers.BranchItems, "getBranchItems"]);

router.post("/branch_items", [controllers.BranchItems, "setBranchItems"]);

/**
 * Postal
 */
router.get("/postal/lookup/postal_code/:postalCode", [controllers.Postal, "lookupPostalCode"]);

/**
 * Companies
 */
router.get("/v2/companies", [controllers.Companies, "getCompanies"]);
router.post("/v2/companies", [controllers.Companies, "addCompany"]);
router.delete("/v2/companies/:companyId", [controllers.Companies, "deleteCompany"]);

/**
 * Opening Hours
 */
router.get("/opening_hours/branch/:branchId", [controllers.OpeningHours, "get"]);
router.post("/opening_hours", [controllers.OpeningHours, "add"]);
router.delete("/opening_hours/:id", [controllers.OpeningHours, "delete"]);

/**
 * Items
 */
router.get("/v2/items", [controllers.Items, "get"]);
router.get("/v2/items/buyback", [controllers.Items, "getBuybackItems"]);

/**
 * Dispatch
 */
router.get("/dispatch/email_templates", [controllers.Dispatch, "getEmailTemplates"]);
router.post("/dispatch", [controllers.Dispatch, "createDispatch"]);

/**
 * Rapid handout
 */
router.post("/rapid-handout", [controllers.RapidHandout, "handout"]);

/**
 * Reports
 */
router.get("/reports/customer_items", [controllers.Reports, "getCustomerItemsReport"]);
router.get("/reports/orders", [controllers.Reports, "getOrdersReport"]);
router.get("/reports/payments", [controllers.Reports, "getPaymentsReport"]);
router.get("/reports/user_details", [controllers.Reports, "getUserDetailsReport"]);

/**
 * Generate legacy bl-collection endpoints
 */
for (const collection of BlCollections) {
  for (const endpoint of collection.endpoints) {
    CollectionEndpoint.create(endpoint, collection);
  }
}
