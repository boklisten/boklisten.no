import router from "@adonisjs/core/services/router";

import { controllers } from "#generated/controllers";
import { middleware } from "#start/kernel";
import { emailValidationThrottle, publicBlidLookupThrottle, throttle } from "#start/limiter";

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Routes are grouped by the permission they require, and the groups are declared from the least
| to the most privileged, except that admin routes come before employee routes. That order keeps
| static paths ahead of the dynamic ones that would otherwise shadow them: `/orders/me` (customer)
| is declared before `/orders/:orderId` (employee), and `/signatures/gallery` (admin) before
| `/signatures/:detailsId` (employee). Within a group, keep static paths above dynamic ones too.
|
| Route names are derived from `<controller>.<method>`; the frontend addresses endpoints by that
| name through Tuyau, never by path.
|
| Paths registered with third parties, and therefore not free to change: `/health` (Railway),
| `/auth/vipps/callback` (Vipps portal) and `/webhooks/sendgrid` (SendGrid dashboard).
|
*/

router.get("/", () => ({}));
router.get("/health", () => ({ status: "ok" }));

/**
 * Authentication
 */
router
  .group(() => {
    router.post("/token", [controllers.auth.Tokens, "refresh"]);

    router.get("/vipps/redirect", [controllers.auth.Vipps, "redirect"]);
    router.get("/vipps/callback", [controllers.auth.Vipps, "callback"]);

    router.post("/local/login", [controllers.auth.Local, "login"]).use(throttle);
    router.post("/local/register", [controllers.auth.Local, "register"]).use(throttle);

    router.post("/password_reset", [controllers.auth.PasswordReset, "request"]).use(throttle);
    router.get("/password_reset/:id/:token", [controllers.auth.PasswordReset, "validate"]);
    router.post("/password_reset/:id", [controllers.auth.PasswordReset, "reset"]);
  })
  .prefix("/auth");

/**
 * Public
 */
router.get("/email_verification/:id", [controllers.EmailVerification, "verify"]);
router
  .post("/email_validation", [controllers.EmailValidation, "validate"])
  .use(emailValidationThrottle);
router.get("/postal_codes/:postalCode", [controllers.PostalCodes, "show"]);
router.post("/bokflyt/contact", [controllers.Bokflyt, "contact"]).use(throttle);

router.get("/branches", [controllers.branches.Branches, "index"]);
router.get("/branches/public", [controllers.branches.Branches, "indexPublic"]);
router.get("/branches/:branchId", [controllers.branches.Branches, "show"]);
router.get("/branches/:branchId/catalog", [controllers.branches.BranchCatalog, "show"]);
router.get("/branches/:branchId/opening_hours", [controllers.OpeningHours, "index"]);

router.get("/items/buyback", [controllers.Items, "buyback"]);
router.get("/editable_texts/:id", [controllers.EditableTexts, "show"]);
router.get("/questions_and_answers", [controllers.QuestionsAndAnswers, "index"]);

router.get("/signatures/:detailsId/valid", [controllers.Signatures, "valid"]);
router.post("/signatures/:detailsId/sign", [controllers.Signatures, "sign"]);

router.get("/unique_ids/pdf/:token", [controllers.UniqueIds, "pdf"]);

/** Called by Vipps with the per-payment token issued when the session was created. */
router.post("/checkout/vipps/callback", [controllers.Checkout, "vippsCallback"]);

/** Provider webhooks, verified with provider signatures. */
router.post("/webhooks/sendgrid", [controllers.Webhooks, "sendgridEvents"]);
router.post("/webhooks/twilio/:messageId", [controllers.Webhooks, "twilioSmsEvent"]);

/**
 * Any logged-in user
 */
router
  .group(() => {
    router.post("/email_verification", [controllers.EmailVerification, "send"]);
    router
      .get("/public_blid_lookup/:blid", [controllers.PublicBlidLookup, "show"])
      .use(publicBlidLookupThrottle);

    router.get("/user_details/me", [controllers.UserDetails, "me"]);
    router.patch("/user_details/me", [controllers.UserDetails, "updateMe"]);
    router.get("/customer_items/me", [controllers.CustomerItems, "me"]);

    router.get("/signatures/me", [controllers.Signatures, "me"]);
    router.post("/signatures/me/send", [controllers.Signatures, "sendLinkMe"]);

    router.get("/orders/me", [controllers.Orders, "indexMe"]);
    router.get("/orders/me/open_items", [controllers.Orders, "openItemsMe"]);
    router.post("/orders/me/cancel_item", [controllers.Orders, "cancelItemMe"]);
    router.get("/orders/me/:orderId", [controllers.Orders, "showMe"]);

    router.post("/checkout", [controllers.Checkout, "initialize"]);
    router.post("/checkout/:orderId/confirm", [controllers.Checkout, "confirm"]);
    router.get("/checkout/:orderId/status", [controllers.Checkout, "status"]);

    router.get("/matches/me", [controllers.Matches, "me"]);
    router.post("/matches/transfer_item", [controllers.Matches, "transferItem"]);
  })
  .use(middleware.auth());

/**
 * Admins
 */
router
  .group(() => {
    // branches
    router.post("/branches", [controllers.branches.Branches, "store"]);
    router.patch("/branches/relationships", [controllers.branches.BranchRelationships, "update"]);
    router.patch("/branches/members", [controllers.branches.BranchMembers, "update"]);
    router.patch("/branches/:branchId", [controllers.branches.Branches, "update"]);

    router.get("/branches/:branchId/items", [controllers.branches.BranchItems, "index"]);
    router.put("/branches/:branchId/items", [controllers.branches.BranchItems, "update"]);
    router.post("/opening_hours", [controllers.OpeningHours, "store"]);
    router.delete("/opening_hours/:id", [controllers.OpeningHours, "destroy"]);

    router.get("/branches/:branchId/members", [controllers.branches.BranchMembers, "index"]);
    router.delete("/branches/:branchId/members/direct", [
      controllers.branches.BranchMembers,
      "destroyDirect",
    ]);
    router.delete("/branches/:branchId/members/indirect", [
      controllers.branches.BranchMembers,
      "destroyIndirect",
    ]);

    router.get("/branches/:branchId/subjects", [controllers.branches.BranchSubjects, "index"]);
    router.post("/branches/:branchId/subjects", [controllers.branches.BranchSubjects, "store"]);
    router.post("/branches/:branchId/subjects/import", [
      controllers.branches.BranchSubjects,
      "import",
    ]);
    router.put("/branches/:branchId/subjects/:subjectId", [
      controllers.branches.BranchSubjects,
      "update",
    ]);
    router.delete("/branches/:branchId/subjects/:subjectId", [
      controllers.branches.BranchSubjects,
      "destroy",
    ]);
    router.post("/branches/:branchId/subject_choices/evaluate", [
      controllers.branches.BranchSubjectChoices,
      "evaluate",
    ]);
    router.post("/branches/:branchId/subject_choices/upload", [
      controllers.branches.BranchSubjectChoices,
      "upload",
    ]);

    router.get("/branches/:branchId/signature_status", [
      controllers.branches.BranchSignatureStatus,
      "show",
    ]);
    router.get("/branches/:branchId/insights/book_movements", [
      controllers.branches.BranchInsights,
      "getBookMovements",
    ]);

    router.get("/branches/:branchId/active_books", [
      controllers.branches.BranchBooks,
      "getActiveBooks",
    ]);
    router.get("/branches/:branchId/active_books/details", [
      controllers.branches.BranchBooks,
      "getActiveBookDetails",
    ]);
    router.patch("/branches/:branchId/active_books", [
      controllers.branches.BranchBooks,
      "bulkUpdateActiveBooks",
    ]);
    router.get("/branches/:branchId/ordered_books", [
      controllers.branches.BranchBooks,
      "getOrderedBooks",
    ]);
    router.get("/branches/:branchId/ordered_books/details", [
      controllers.branches.BranchBooks,
      "getOrderedBookDetails",
    ]);
    router.patch("/branches/:branchId/ordered_books", [
      controllers.branches.BranchBooks,
      "bulkUpdateOrderedBooks",
    ]);
    router.post("/branches/:branchId/ordered_books/cancel", [
      controllers.branches.BranchBooks,
      "cancelOrderedBooks",
    ]);

    router.post("/branches/:branchId/users/evaluate", [controllers.UserProvisioning, "evaluate"]);
    router.post("/branches/:branchId/users/provision", [controllers.UserProvisioning, "provision"]);

    // users
    router.get("/users/metrics", [controllers.Users, "metrics"]);
    router.get("/users/duplicates", [controllers.Users, "duplicates"]);
    router.get("/users/employees", [controllers.Users, "employees"]);
    router.get("/users/merge_preview/:fromDetailsId/:toDetailsId", [
      controllers.Users,
      "mergePreview",
    ]);
    router.post("/users/merge", [controllers.Users, "merge"]);
    router.put("/users/permission", [controllers.Users, "setPermission"]);
    router.delete("/users/:detailsId", [controllers.Users, "destroy"]);

    router.get("/signatures/gallery", [controllers.Signatures, "gallery"]);

    // matches
    router.post("/matches/notify", [controllers.Matches, "notify"]);
    router.post("/matches/:matchId/send_to_stand", [controllers.Matches, "sendToStand"]);
    router.post("/match_rounds", [controllers.MatchRounds, "store"]);
    router.patch("/match_rounds/:id", [controllers.MatchRounds, "update"]);
    router.post("/match_rounds/:id/generate", [controllers.MatchRounds, "generate"]);
    router.delete("/match_rounds/:id/matches", [controllers.MatchRounds, "destroyMatches"]);
    router.delete("/match_rounds/:id", [controllers.MatchRounds, "destroy"]);

    // items
    router.get("/items/all", [controllers.Items, "all"]);
    router.post("/items", [controllers.Items, "store"]);
    router.post("/items/bulk", [controllers.Items, "bulkUpsert"]);
    router.patch("/items/:id", [controllers.Items, "update"]);

    // invoices
    router.get("/invoices", [controllers.Invoices, "index"]);
    router.get("/invoices/generation_defaults", [controllers.Invoices, "generationDefaults"]);
    router.post("/invoices/generate", [controllers.Invoices, "generate"]);
    router.post("/invoices/company", [controllers.Invoices, "createCompanyInvoice"]);
    router.post("/invoices/export", [controllers.Invoices, "export"]);
    router.patch("/invoices/status", [controllers.Invoices, "setStatuses"]);
    router.get("/invoices/:invoiceId", [controllers.Invoices, "show"]);
    router.delete("/invoices/:invoiceId", [controllers.Invoices, "destroy"]);
    router.patch("/invoices/:invoiceId/status", [controllers.Invoices, "setStatus"]);
    router.patch("/invoices/:invoiceId/lines/:lineIndex", [
      controllers.Invoices,
      "setLineCancelled",
    ]);

    // site content
    router.get("/editable_texts", [controllers.EditableTexts, "index"]);
    router.put("/editable_texts/:id", [controllers.EditableTexts, "upsert"]);
    router.delete("/editable_texts/:id", [controllers.EditableTexts, "destroy"]);
    router.post("/questions_and_answers", [controllers.QuestionsAndAnswers, "store"]);
    router.patch("/questions_and_answers/order", [controllers.QuestionsAndAnswers, "updateOrder"]);
    router.patch("/questions_and_answers/:id", [controllers.QuestionsAndAnswers, "update"]);
    router.delete("/questions_and_answers/:id", [controllers.QuestionsAndAnswers, "destroy"]);
    router.get("/companies", [controllers.Companies, "index"]);
    router.post("/companies", [controllers.Companies, "store"]);
    router.delete("/companies/:companyId", [controllers.Companies, "destroy"]);

    // messaging
    router.post("/reminders/count_recipients", [controllers.Reminders, "countRecipients"]);
    router.post("/reminders/send", [controllers.Reminders, "send"]);
    router.get("/dispatch/email_templates", [controllers.Dispatch, "emailTemplates"]);
    router.post("/dispatch", [controllers.Dispatch, "store"]);

    // reports and stickers
    router.get("/reports/customer_items", [controllers.Reports, "customerItems"]);
    router.get("/reports/orders", [controllers.Reports, "orders"]);
    router.get("/reports/payments", [controllers.Reports, "payments"]);
    router.get("/reports/user_details", [controllers.Reports, "userDetails"]);
    router.get("/unique_ids/token", [controllers.UniqueIds, "token"]);
  })
  .use(middleware.auth({ permission: "admin" }));

/**
 * Employees
 */
router
  .group(() => {
    // customers
    router.post("/user_details/search", [controllers.UserDetails, "search"]);
    router.get("/user_details/:detailsId", [controllers.UserDetails, "show"]);
    router.patch("/user_details/:detailsId", [controllers.UserDetails, "update"]);
    router.post("/user_details/:detailsId/confirm_email", [
      controllers.UserDetails,
      "confirmEmail",
    ]);
    router.get("/user_details/:detailsId/customer_items", [
      controllers.CustomerItems,
      "forCustomer",
    ]);
    router.get("/user_details/:detailsId/orders", [controllers.Orders, "forCustomer"]);
    router.get("/user_details/:detailsId/placed_orders", [controllers.Orders, "placedForCustomer"]);
    router.get("/user_details/:detailsId/matches", [controllers.Matches, "forCustomer"]);
    router.get("/user_details/:detailsId/message_logs", [controllers.MessageLogs, "forCustomer"]);

    router.get("/signatures/:detailsId", [controllers.Signatures, "show"]);
    router.post("/signatures/:detailsId/send", [controllers.Signatures, "sendLink"]);

    // orders
    router.get("/orders", [controllers.Orders, "index"]);
    router.get("/orders/export", [controllers.Orders, "export"]);
    router.get("/orders/export/bring", [controllers.Orders, "exportBring"]);
    router.get("/orders/:orderId", [controllers.Orders, "show"]);
    router.patch("/orders/:orderId/branch", [controllers.Orders, "updateBranch"]);
    router.patch("/orders/:orderId/item_deadline", [controllers.Orders, "updateItemDeadline"]);
    router.delete("/orders/:orderId", [controllers.Orders, "destroy"]);

    // the stand
    router.post("/stand_cart/lines", [controllers.StandCart, "resolveLine"]);
    router.post("/stand_cart/refund_plan", [controllers.StandCart, "refundPlan"]);
    router.post("/stand_cart/checkout", [controllers.StandCart, "checkout"]);
    router.get("/stand_cart/:orderId/status", [controllers.StandCart, "status"]);
    router.post("/stand_cart/:orderId/cancel", [controllers.StandCart, "cancel"]);
    router.post("/bulk_collection", [controllers.BulkCollection, "collect"]);
    router.get("/bulk_collection/:blid", [controllers.BulkCollection, "show"]);

    // unique ids
    router.get("/blids", [controllers.Blids, "index"]);
    router.post("/blids/register", [controllers.Blids, "register"]);
    router.post("/blids/register_one", [controllers.Blids, "registerOne"]);
    router.patch("/blids/active_item", [controllers.Blids, "updateActiveItem"]);
    router.get("/blids/:blid", [controllers.Blids, "show"]);
    router.get("/blids/:blid/link", [controllers.Blids, "showLink"]);
    router.patch("/blids/:blid/item", [controllers.Blids, "relink"]);
    router.delete("/blids/:blid", [controllers.Blids, "destroy"]);
    router.get("/unique_ids/:blid/label", [controllers.UniqueIds, "label"]);

    // matches
    router.get("/matches/:matchId", [controllers.Matches, "show"]);
    router.get("/match_rounds", [controllers.MatchRounds, "index"]);
    router.get("/match_rounds/:id/matches", [controllers.MatchRounds, "matches"]);
    router.get("/match_rounds/:id/statistics", [controllers.MatchRounds, "statistics"]);
    router.get("/match_rounds/:id/plan_metrics", [controllers.MatchRounds, "planMetrics"]);

    // items and misc
    router.get("/items", [controllers.Items, "index"]);
    router.get("/items/by_isbn/:isbn", [controllers.Items, "showByIsbn"]);
    router.get("/waiting_list_customers", [controllers.WaitingListCustomers, "index"]);
    router.post("/waiting_list_customers", [controllers.WaitingListCustomers, "store"]);
    router.delete("/waiting_list_customers/:id", [controllers.WaitingListCustomers, "destroy"]);
    router.get("/message_logs/feed", [controllers.MessageLogs, "feed"]);
    router.get("/message_logs/metrics", [controllers.MessageLogs, "metrics"]);
    router.get("/message_logs/sendouts", [controllers.MessageLogs, "sendouts"]);
  })
  .use(middleware.auth({ permission: "employee" }));
