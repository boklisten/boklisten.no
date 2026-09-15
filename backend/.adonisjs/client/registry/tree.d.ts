/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  tokens: {
    refresh: typeof routes['tokens.refresh']
  }
  vipps: {
    redirect: typeof routes['vipps.redirect']
    callback: typeof routes['vipps.callback']
  }
  local: {
    login: typeof routes['local.login']
    register: typeof routes['local.register']
  }
  passwordReset: {
    request: typeof routes['password_reset.request']
    validate: typeof routes['password_reset.validate']
    reset: typeof routes['password_reset.reset']
  }
  emailVerification: {
    verify: typeof routes['email_verification.verify']
    send: typeof routes['email_verification.send']
  }
  emailValidation: {
    validate: typeof routes['email_validation.validate']
  }
  postalCodes: {
    show: typeof routes['postal_codes.show']
  }
  bokflyt: {
    contact: typeof routes['bokflyt.contact']
  }
  branches: {
    index: typeof routes['branches.index']
    indexPublic: typeof routes['branches.index_public']
    show: typeof routes['branches.show']
    store: typeof routes['branches.store']
    update: typeof routes['branches.update']
  }
  branchCatalog: {
    show: typeof routes['branch_catalog.show']
  }
  openingHours: {
    index: typeof routes['opening_hours.index']
    store: typeof routes['opening_hours.store']
    destroy: typeof routes['opening_hours.destroy']
  }
  items: {
    buyback: typeof routes['items.buyback']
    all: typeof routes['items.all']
    store: typeof routes['items.store']
    bulkUpsert: typeof routes['items.bulk_upsert']
    update: typeof routes['items.update']
    index: typeof routes['items.index']
    showByIsbn: typeof routes['items.show_by_isbn']
  }
  editableTexts: {
    show: typeof routes['editable_texts.show']
    index: typeof routes['editable_texts.index']
    upsert: typeof routes['editable_texts.upsert']
    destroy: typeof routes['editable_texts.destroy']
  }
  questionsAndAnswers: {
    index: typeof routes['questions_and_answers.index']
    store: typeof routes['questions_and_answers.store']
    updateOrder: typeof routes['questions_and_answers.update_order']
    update: typeof routes['questions_and_answers.update']
    destroy: typeof routes['questions_and_answers.destroy']
  }
  signatures: {
    valid: typeof routes['signatures.valid']
    sign: typeof routes['signatures.sign']
    me: typeof routes['signatures.me']
    sendLinkMe: typeof routes['signatures.send_link_me']
    gallery: typeof routes['signatures.gallery']
    show: typeof routes['signatures.show']
    sendLink: typeof routes['signatures.send_link']
  }
  uniqueIds: {
    pdf: typeof routes['unique_ids.pdf']
    token: typeof routes['unique_ids.token']
    label: typeof routes['unique_ids.label']
  }
  checkout: {
    vippsCallback: typeof routes['checkout.vipps_callback']
    initialize: typeof routes['checkout.initialize']
    confirm: typeof routes['checkout.confirm']
    status: typeof routes['checkout.status']
  }
  webhooks: {
    sendgridEvents: typeof routes['webhooks.sendgrid_events']
    twilioSmsEvent: typeof routes['webhooks.twilio_sms_event']
  }
  publicBlidLookup: {
    show: typeof routes['public_blid_lookup.show']
  }
  userDetails: {
    me: typeof routes['user_details.me']
    updateMe: typeof routes['user_details.update_me']
    search: typeof routes['user_details.search']
    show: typeof routes['user_details.show']
    update: typeof routes['user_details.update']
    confirmEmail: typeof routes['user_details.confirm_email']
  }
  customerItems: {
    me: typeof routes['customer_items.me']
    forCustomer: typeof routes['customer_items.for_customer']
  }
  orders: {
    indexMe: typeof routes['orders.index_me']
    openItemsMe: typeof routes['orders.open_items_me']
    cancelItemMe: typeof routes['orders.cancel_item_me']
    showMe: typeof routes['orders.show_me']
    forCustomer: typeof routes['orders.for_customer']
    placedForCustomer: typeof routes['orders.placed_for_customer']
    index: typeof routes['orders.index']
    export: typeof routes['orders.export']
    exportBring: typeof routes['orders.export_bring']
    show: typeof routes['orders.show']
    updateBranch: typeof routes['orders.update_branch']
    updateItemDeadline: typeof routes['orders.update_item_deadline']
    destroy: typeof routes['orders.destroy']
  }
  matches: {
    me: typeof routes['matches.me']
    transferItem: typeof routes['matches.transfer_item']
    notify: typeof routes['matches.notify']
    sendToStand: typeof routes['matches.send_to_stand']
    forCustomer: typeof routes['matches.for_customer']
    show: typeof routes['matches.show']
  }
  branchRelationships: {
    update: typeof routes['branch_relationships.update']
  }
  branchMembers: {
    update: typeof routes['branch_members.update']
    index: typeof routes['branch_members.index']
    destroyDirect: typeof routes['branch_members.destroy_direct']
    destroyIndirect: typeof routes['branch_members.destroy_indirect']
  }
  branchItems: {
    index: typeof routes['branch_items.index']
    update: typeof routes['branch_items.update']
  }
  branchSubjects: {
    index: typeof routes['branch_subjects.index']
    store: typeof routes['branch_subjects.store']
    import: typeof routes['branch_subjects.import']
    update: typeof routes['branch_subjects.update']
    destroy: typeof routes['branch_subjects.destroy']
  }
  branchSubjectChoices: {
    evaluate: typeof routes['branch_subject_choices.evaluate']
    upload: typeof routes['branch_subject_choices.upload']
  }
  branchSignatureStatus: {
    show: typeof routes['branch_signature_status.show']
  }
  branchInsights: {
    getBookMovements: typeof routes['branch_insights.get_book_movements']
  }
  branchBooks: {
    getActiveBooks: typeof routes['branch_books.get_active_books']
    getActiveBookDetails: typeof routes['branch_books.get_active_book_details']
    bulkUpdateActiveBooks: typeof routes['branch_books.bulk_update_active_books']
    getOrderedBooks: typeof routes['branch_books.get_ordered_books']
    getOrderedBookDetails: typeof routes['branch_books.get_ordered_book_details']
    bulkUpdateOrderedBooks: typeof routes['branch_books.bulk_update_ordered_books']
    cancelOrderedBooks: typeof routes['branch_books.cancel_ordered_books']
  }
  userProvisioning: {
    evaluate: typeof routes['user_provisioning.evaluate']
    provision: typeof routes['user_provisioning.provision']
  }
  users: {
    metrics: typeof routes['users.metrics']
    duplicates: typeof routes['users.duplicates']
    employees: typeof routes['users.employees']
    mergePreview: typeof routes['users.merge_preview']
    merge: typeof routes['users.merge']
    setPermission: typeof routes['users.set_permission']
    destroy: typeof routes['users.destroy']
  }
  matchRounds: {
    store: typeof routes['match_rounds.store']
    update: typeof routes['match_rounds.update']
    generate: typeof routes['match_rounds.generate']
    destroyMatches: typeof routes['match_rounds.destroy_matches']
    destroy: typeof routes['match_rounds.destroy']
    index: typeof routes['match_rounds.index']
    matches: typeof routes['match_rounds.matches']
    statistics: typeof routes['match_rounds.statistics']
    planMetrics: typeof routes['match_rounds.plan_metrics']
  }
  invoices: {
    index: typeof routes['invoices.index']
    generationDefaults: typeof routes['invoices.generation_defaults']
    generate: typeof routes['invoices.generate']
    createCompanyInvoice: typeof routes['invoices.create_company_invoice']
    export: typeof routes['invoices.export']
    setStatuses: typeof routes['invoices.set_statuses']
    show: typeof routes['invoices.show']
    setStatus: typeof routes['invoices.set_status']
    setLineCancelled: typeof routes['invoices.set_line_cancelled']
  }
  companies: {
    index: typeof routes['companies.index']
    store: typeof routes['companies.store']
    destroy: typeof routes['companies.destroy']
  }
  reminders: {
    countRecipients: typeof routes['reminders.count_recipients']
    send: typeof routes['reminders.send']
  }
  dispatch: {
    emailTemplates: typeof routes['dispatch.email_templates']
    store: typeof routes['dispatch.store']
  }
  reports: {
    customerItems: typeof routes['reports.customer_items']
    orders: typeof routes['reports.orders']
    payments: typeof routes['reports.payments']
    userDetails: typeof routes['reports.user_details']
  }
  messageLogs: {
    forCustomer: typeof routes['message_logs.for_customer']
    feed: typeof routes['message_logs.feed']
    metrics: typeof routes['message_logs.metrics']
    sendouts: typeof routes['message_logs.sendouts']
  }
  standCart: {
    resolveLine: typeof routes['stand_cart.resolve_line']
    refundPlan: typeof routes['stand_cart.refund_plan']
    checkout: typeof routes['stand_cart.checkout']
    status: typeof routes['stand_cart.status']
    cancel: typeof routes['stand_cart.cancel']
  }
  bulkCollection: {
    collect: typeof routes['bulk_collection.collect']
    show: typeof routes['bulk_collection.show']
  }
  blids: {
    index: typeof routes['blids.index']
    register: typeof routes['blids.register']
    registerOne: typeof routes['blids.register_one']
    updateActiveItem: typeof routes['blids.update_active_item']
    show: typeof routes['blids.show']
    showLink: typeof routes['blids.show_link']
    relink: typeof routes['blids.relink']
    destroy: typeof routes['blids.destroy']
  }
  waitingListCustomers: {
    index: typeof routes['waiting_list_customers.index']
    store: typeof routes['waiting_list_customers.store']
    destroy: typeof routes['waiting_list_customers.destroy']
  }
}
