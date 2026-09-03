/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'tokens.legacy_token': {
    methods: ["POST"]
    pattern: '/token'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').tokenValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').tokenValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/tokens_controller').default['legacyToken']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/tokens_controller').default['legacyToken']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'tokens.token': {
    methods: ["POST"]
    pattern: '/v2/token'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').tokenValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').tokenValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/tokens_controller').default['token']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/tokens_controller').default['token']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'vipps.redirect': {
    methods: ["GET","HEAD"]
    pattern: '/auth/vipps/redirect'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/vipps_controller').default['redirect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/vipps_controller').default['redirect']>>>
    }
  }
  'vipps.callback': {
    methods: ["GET","HEAD"]
    pattern: '/auth/vipps/callback'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/vipps_controller').default['callback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/vipps_controller').default['callback']>>>
    }
  }
  'local.login': {
    methods: ["POST"]
    pattern: '/auth/local/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').localAuthValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').localAuthValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/local_controller').default['login']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/local_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'local.register': {
    methods: ["POST"]
    pattern: '/auth/local/register'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').registerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').registerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/local_controller').default['register']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/local_controller').default['register']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'password_reset.request_password_reset': {
    methods: ["POST"]
    pattern: '/forgot_password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').forgotPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').forgotPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['requestPasswordReset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['requestPasswordReset']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'password_reset.validate_password_reset': {
    methods: ["GET","HEAD"]
    pattern: '/password_reset/validate/:id/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['validatePasswordReset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['validatePasswordReset']>>>
    }
  }
  'password_reset.reset_password': {
    methods: ["POST"]
    pattern: '/password_reset/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').passwordResetValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').passwordResetValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['resetPassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['resetPassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'waiting_list_customer.get_all': {
    methods: ["GET","HEAD"]
    pattern: '/waiting_list_customer'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/waiting_list_customer_controller').default['getAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/waiting_list_customer_controller').default['getAll']>>>
    }
  }
  'waiting_list_customer.create': {
    methods: ["POST"]
    pattern: '/waiting_list_customer'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/waiting_list_customer').waitingListCustomerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/waiting_list_customer').waitingListCustomerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/waiting_list_customer_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/waiting_list_customer_controller').default['create']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'waiting_list_customer.destroy': {
    methods: ["DELETE"]
    pattern: '/waiting_list_customer/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/waiting_list_customer_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/waiting_list_customer_controller').default['destroy']>>>
    }
  }
  'reminders.count_recipients': {
    methods: ["POST"]
    pattern: '/reminders/count_recipients'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reminder').reminderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reminder').reminderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reminders_controller').default['countRecipients']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reminders_controller').default['countRecipients']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reminders.remind': {
    methods: ["POST"]
    pattern: '/reminders/send'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reminder').reminderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reminder').reminderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reminders_controller').default['remind']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reminders_controller').default['remind']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branches.get_public': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/public'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['getPublic']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['getPublic']>>>
    }
  }
  'branches.get_all': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['getAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['getAll']>>>
    }
  }
  'branches.get_by_id': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/:branchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['getById']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['getById']>>>
    }
  }
  'branches.add': {
    methods: ["POST"]
    pattern: '/v2/branches'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch').branchCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch').branchCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['add']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['add']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branches.update': {
    methods: ["PATCH"]
    pattern: '/v2/branches'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch').branchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch').branchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_upload.evaluate_subject_choices': {
    methods: ["POST"]
    pattern: '/v2/branches/:branchId/subject_choices/evaluate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_upload_controller').default['evaluateSubjectChoices']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_upload_controller').default['evaluateSubjectChoices']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_upload.upload_subject_choices': {
    methods: ["POST"]
    pattern: '/v2/branches/:branchId/subject_choices/upload'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_upload_controller').default['uploadSubjectChoices']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_upload_controller').default['uploadSubjectChoices']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_subjects.get_subjects': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/:branchId/subjects'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['getSubjects']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['getSubjects']>>>
    }
  }
  'branch_subjects.create_subject': {
    methods: ["POST"]
    pattern: '/v2/branches/:branchId/subjects'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_subjects').branchSubjectValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_subjects').branchSubjectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['createSubject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['createSubject']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_subjects.update_subject': {
    methods: ["PUT"]
    pattern: '/v2/branches/:branchId/subjects/:subjectId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_subjects').branchSubjectValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { branchId: ParamValue; subjectId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_subjects').branchSubjectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['updateSubject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['updateSubject']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_subjects.delete_subject': {
    methods: ["DELETE"]
    pattern: '/v2/branches/:branchId/subjects/:subjectId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { branchId: ParamValue; subjectId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['deleteSubject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['deleteSubject']>>>
    }
  }
  'branch_subjects.import_subjects': {
    methods: ["POST"]
    pattern: '/v2/branches/:branchId/subjects/import'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['importSubjects']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['importSubjects']>>>
    }
  }
  'branch_signature_status.get_status': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/:branchId/signature_status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_signature_status_controller').default['getStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_signature_status_controller').default['getStatus']>>>
    }
  }
  'branch_relationship.update': {
    methods: ["PATCH"]
    pattern: '/v2/branches/relationships'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch').branchRelationshipValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch').branchRelationshipValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_relationship_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_relationship_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_membership.get_members': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/memberships/:branchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_membership_controller').default['getMembers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_membership_controller').default['getMembers']>>>
    }
  }
  'branch_membership.update_membership': {
    methods: ["PATCH"]
    pattern: '/branches/memberships'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_membership').updateBranchMembershipValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_membership').updateBranchMembershipValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_membership_controller').default['updateMembership']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_membership_controller').default['updateMembership']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_membership.remove_direct_members': {
    methods: ["DELETE"]
    pattern: '/branches/memberships/direct/:branchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_membership_controller').default['removeDirectMembers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_membership_controller').default['removeDirectMembers']>>>
    }
  }
  'branch_membership.remove_indirect_members': {
    methods: ["DELETE"]
    pattern: '/branches/memberships/indirect/:branchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_membership_controller').default['removeIndirectMembers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_membership_controller').default['removeIndirectMembers']>>>
    }
  }
  'branch_books.get_active_books': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/:branchId/active_books'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['getActiveBooks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['getActiveBooks']>>>
    }
  }
  'branch_books.get_active_book_details': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/:branchId/active_books/details'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/branch_books').branchBooksDetailsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['getActiveBookDetails']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['getActiveBookDetails']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_books.bulk_update_active_books': {
    methods: ["PATCH"]
    pattern: '/v2/branches/:branchId/active_books'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_books').activeBooksBulkUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_books').activeBooksBulkUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['bulkUpdateActiveBooks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['bulkUpdateActiveBooks']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_books.get_ordered_books': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/:branchId/ordered_books'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['getOrderedBooks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['getOrderedBooks']>>>
    }
  }
  'branch_books.get_ordered_book_details': {
    methods: ["GET","HEAD"]
    pattern: '/v2/branches/:branchId/ordered_books/details'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/branch_books').branchBooksDetailsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['getOrderedBookDetails']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['getOrderedBookDetails']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_books.bulk_update_ordered_books': {
    methods: ["PATCH"]
    pattern: '/v2/branches/:branchId/ordered_books'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_books').orderedBooksBulkUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_books').orderedBooksBulkUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['bulkUpdateOrderedBooks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['bulkUpdateOrderedBooks']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_books.cancel_ordered_books': {
    methods: ["POST"]
    pattern: '/v2/branches/:branchId/ordered_books/cancel'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_books').orderedBooksCancelValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_books').orderedBooksCancelValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['cancelOrderedBooks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['cancelOrderedBooks']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.get_open_orders': {
    methods: ["GET","HEAD"]
    pattern: '/v2/orders/open_orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['getOpenOrders']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['getOpenOrders']>>>
    }
  }
  'orders.get_placed_orders': {
    methods: ["GET","HEAD"]
    pattern: '/v2/orders/placed_orders/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['getPlacedOrders']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['getPlacedOrders']>>>
    }
  }
  'orders.cancel_order_item': {
    methods: ["POST"]
    pattern: '/v2/orders/cancel_order_item'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/cancel_order_item_validator').cancelOrderItemValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/cancel_order_item_validator').cancelOrderItemValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancelOrderItem']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancelOrderItem']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.cancel_order_item_as_employee': {
    methods: ["POST"]
    pattern: '/v2/orders/cancel_order_item_as_employee'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/cancel_order_item_validator').cancelOrderItemValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/cancel_order_item_validator').cancelOrderItemValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancelOrderItemAsEmployee']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancelOrderItemAsEmployee']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'editable_texts.get': {
    methods: ["GET","HEAD"]
    pattern: '/editable_texts/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['get']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['get']>>>
    }
  }
  'editable_texts.get_all': {
    methods: ["GET","HEAD"]
    pattern: '/editable_texts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['getAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['getAll']>>>
    }
  }
  'editable_texts.upsert': {
    methods: ["PUT"]
    pattern: '/editable_texts/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/editable_texts_validator').editableTextsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/editable_texts_validator').editableTextsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['upsert']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['upsert']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'editable_texts.destroy': {
    methods: ["DELETE"]
    pattern: '/editable_texts/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['destroy']>>>
    }
  }
  'questions_and_answers.get_all': {
    methods: ["GET","HEAD"]
    pattern: '/questions_and_answers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['getAll']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['getAll']>>>
    }
  }
  'questions_and_answers.store': {
    methods: ["POST"]
    pattern: '/questions_and_answers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/questions_and_answers_validator').questionsAndAnswersValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/questions_and_answers_validator').questionsAndAnswersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'questions_and_answers.update_order': {
    methods: ["PATCH"]
    pattern: '/questions_and_answers/order'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/questions_and_answers_validator').questionsAndAnswersOrderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/questions_and_answers_validator').questionsAndAnswersOrderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['updateOrder']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['updateOrder']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'questions_and_answers.update': {
    methods: ["PATCH"]
    pattern: '/questions_and_answers/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/questions_and_answers_validator').questionsAndAnswersValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/questions_and_answers_validator').questionsAndAnswersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'questions_and_answers.destroy': {
    methods: ["DELETE"]
    pattern: '/questions_and_answers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['destroy']>>>
    }
  }
  'email_verification.send': {
    methods: ["POST"]
    pattern: '/email_verification'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['send']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['send']>>>
    }
  }
  'email_verification.verify': {
    methods: ["GET","HEAD"]
    pattern: '/email_verification/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_verification_controller').default['verify']>>>
    }
  }
  'public_blid_lookup.lookup': {
    methods: ["GET","HEAD"]
    pattern: '/public_blid_lookup/:blid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/public_blid_lookup_controller').default['lookup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/public_blid_lookup_controller').default['lookup']>>>
    }
  }
  'blid_search.search': {
    methods: ["GET","HEAD"]
    pattern: '/v2/admin/blid_search'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/blid_search').blidSearchQueryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blid_search_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blid_search_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'blid_search.lookup': {
    methods: ["GET","HEAD"]
    pattern: '/v2/admin/blid_search/:blid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blid_search_controller').default['lookup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blid_search_controller').default['lookup']>>>
    }
  }
  'blid_search.update_active_item': {
    methods: ["PATCH"]
    pattern: '/v2/admin/blid_search/active_item'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/blid_search').blidActiveItemUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/blid_search').blidActiveItemUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blid_search_controller').default['updateActiveItem']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blid_search_controller').default['updateActiveItem']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'matches.notify': {
    methods: ["POST"]
    pattern: '/matches/notify'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/matches').matchNotifyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/matches').matchNotifyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['notify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['notify']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'matches.get_my_matches': {
    methods: ["GET","HEAD"]
    pattern: '/matches/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getMyMatches']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getMyMatches']>>>
    }
  }
  'matches.get_matches_for_customer': {
    methods: ["GET","HEAD"]
    pattern: '/matches/customer/:customerId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { customerId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getMatchesForCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getMatchesForCustomer']>>>
    }
  }
  'matches.get_all_matches': {
    methods: ["GET","HEAD"]
    pattern: '/matches'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getAllMatches']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getAllMatches']>>>
    }
  }
  'matches.get_matches_for_round': {
    methods: ["GET","HEAD"]
    pattern: '/matches/round/:roundId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { roundId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getMatchesForRound']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getMatchesForRound']>>>
    }
  }
  'matches.get_match_by_id': {
    methods: ["GET","HEAD"]
    pattern: '/matches/id/:matchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { matchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getMatchById']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['getMatchById']>>>
    }
  }
  'matches.transfer_item': {
    methods: ["POST"]
    pattern: '/matches/transfer_item'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/matches').matchTransferValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/matches').matchTransferValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['transferItem']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['transferItem']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'matches.send_to_stand': {
    methods: ["POST"]
    pattern: '/matches/:matchId/send_to_stand'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { matchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['sendToStand']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['sendToStand']>>>
    }
  }
  'match_statistics.get_statistics': {
    methods: ["GET","HEAD"]
    pattern: '/matches/statistics'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_statistics_controller').default['getStatistics']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_statistics_controller').default['getStatistics']>>>
    }
  }
  'match_statistics.get_statistics_for_round': {
    methods: ["GET","HEAD"]
    pattern: '/matches/statistics/round/:roundId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { roundId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_statistics_controller').default['getStatisticsForRound']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_statistics_controller').default['getStatisticsForRound']>>>
    }
  }
  'match_rounds.index': {
    methods: ["GET","HEAD"]
    pattern: '/match_rounds'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['index']>>>
    }
  }
  'match_rounds.store': {
    methods: ["POST"]
    pattern: '/match_rounds'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/matches').matchRoundCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/matches').matchRoundCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'match_rounds.plan_metrics': {
    methods: ["GET","HEAD"]
    pattern: '/match_rounds/:id/plan_metrics'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['planMetrics']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['planMetrics']>>>
    }
  }
  'match_rounds.update': {
    methods: ["PATCH"]
    pattern: '/match_rounds/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/matches').matchRoundPatchValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/matches').matchRoundPatchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'match_rounds.generate': {
    methods: ["POST"]
    pattern: '/match_rounds/:id/generate'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['generate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['generate']>>>
    }
  }
  'match_rounds.destroy_matches': {
    methods: ["DELETE"]
    pattern: '/match_rounds/:id/matches'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['destroyMatches']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['destroyMatches']>>>
    }
  }
  'match_rounds.destroy': {
    methods: ["DELETE"]
    pattern: '/match_rounds/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['destroy']>>>
    }
  }
  'user_detail.get_by_id': {
    methods: ["GET","HEAD"]
    pattern: '/v2/user_details/id/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['getById']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['getById']>>>
    }
  }
  'user_detail.search': {
    methods: ["POST"]
    pattern: '/v2/user_details/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_detail').userDetailSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_detail').userDetailSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_detail.get_my_details': {
    methods: ["GET","HEAD"]
    pattern: '/v2/user_details/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['getMyDetails']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['getMyDetails']>>>
    }
  }
  'user_detail.update_as_customer': {
    methods: ["POST"]
    pattern: '/v2/user_details'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_detail').customerUpdateUserDetailsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_detail').customerUpdateUserDetailsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['updateAsCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['updateAsCustomer']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_detail.update_as_employee': {
    methods: ["POST"]
    pattern: '/v2/employee/user_details/:detailsId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_detail').employeeUpdateUserDetailsValidator)>>
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/user_detail').employeeUpdateUserDetailsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['updateAsEmployee']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['updateAsEmployee']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_detail.confirm_email': {
    methods: ["POST"]
    pattern: '/v2/employee/user_details/:detailsId/confirm_email'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['confirmEmail']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_detail_controller').default['confirmEmail']>>>
    }
  }
  'user_management.metrics': {
    methods: ["GET","HEAD"]
    pattern: '/v2/admin/users/metrics'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['metrics']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['metrics']>>>
    }
  }
  'user_management.duplicates': {
    methods: ["GET","HEAD"]
    pattern: '/v2/admin/users/duplicates'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['duplicates']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['duplicates']>>>
    }
  }
  'user_management.merge_preview': {
    methods: ["GET","HEAD"]
    pattern: '/v2/admin/users/merge-preview/:fromDetailsId/:toDetailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { fromDetailsId: ParamValue; toDetailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['mergePreview']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['mergePreview']>>>
    }
  }
  'user_management.merge': {
    methods: ["POST"]
    pattern: '/v2/admin/users/merge'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_management').mergeUsersValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_management').mergeUsersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['merge']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['merge']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_management.employees': {
    methods: ["GET","HEAD"]
    pattern: '/v2/admin/users/employees'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['employees']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['employees']>>>
    }
  }
  'user_management.set_permission': {
    methods: ["POST"]
    pattern: '/v2/admin/users/permission'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_management').setPermissionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_management').setPermissionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['setPermission']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['setPermission']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_management.destroy': {
    methods: ["DELETE"]
    pattern: '/v2/admin/users/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_management_controller').default['destroy']>>>
    }
  }
  'customer_items.get_customer_items': {
    methods: ["GET","HEAD"]
    pattern: '/v2/customer_items'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer_items_controller').default['getCustomerItems']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer_items_controller').default['getCustomerItems']>>>
    }
  }
  'customer_items.get_active_customer_items_for_customer': {
    methods: ["GET","HEAD"]
    pattern: '/v2/employee/user_details/:detailsId/customer_items'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer_items_controller').default['getActiveCustomerItemsForCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer_items_controller').default['getActiveCustomerItemsForCustomer']>>>
    }
  }
  'signatures.gallery': {
    methods: ["GET","HEAD"]
    pattern: '/signatures/gallery'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['gallery']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['gallery']>>>
    }
  }
  'signatures.send_signature_link': {
    methods: ["POST"]
    pattern: '/signatures/send/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sendSignatureLink']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sendSignatureLink']>>>
    }
  }
  'signatures.send_signature_link_as_customer': {
    methods: ["POST"]
    pattern: '/signatures/me/send'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sendSignatureLinkAsCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sendSignatureLinkAsCustomer']>>>
    }
  }
  'signatures.get_my_signature': {
    methods: ["GET","HEAD"]
    pattern: '/signatures/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['getMySignature']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['getMySignature']>>>
    }
  }
  'signatures.has_valid_signature': {
    methods: ["GET","HEAD"]
    pattern: '/signatures/valid/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['hasValidSignature']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['hasValidSignature']>>>
    }
  }
  'signatures.get_signature': {
    methods: ["GET","HEAD"]
    pattern: '/signatures/get/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['getSignature']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['getSignature']>>>
    }
  }
  'signatures.sign': {
    methods: ["POST"]
    pattern: '/signatures/sign/:detailsId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/signature').signValidator)>>
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/signature').signValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sign']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sign']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'unique_ids.get_token': {
    methods: ["GET","HEAD"]
    pattern: '/unique_ids/token'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['getToken']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['getToken']>>>
    }
  }
  'unique_ids.download_unique_id_pdf': {
    methods: ["GET","HEAD"]
    pattern: '/unique_ids/download_pdf/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['downloadUniqueIdPdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['downloadUniqueIdPdf']>>>
    }
  }
  'user_provisioning.evaluate': {
    methods: ["POST"]
    pattern: '/v2/branches/:branchId/users/evaluate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_provisioning').userProvisioningValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/user_provisioning').userProvisioningValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_provisioning_controller').default['evaluate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_provisioning_controller').default['evaluate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_provisioning.provision': {
    methods: ["POST"]
    pattern: '/v2/branches/:branchId/users/provision'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_provisioning').userProvisioningValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/user_provisioning').userProvisioningValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_provisioning_controller').default['provision']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_provisioning_controller').default['provision']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'unique_items.add': {
    methods: ["POST"]
    pattern: '/unique_items/add'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/unique_item').uniqueItemsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/unique_item').uniqueItemsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/unique_items_controller').default['add']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/unique_items_controller').default['add']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'order_history.get_my_order': {
    methods: ["GET","HEAD"]
    pattern: '/order_history/me/:orderId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/order_history_controller').default['getMyOrder']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/order_history_controller').default['getMyOrder']>>>
    }
  }
  'order_history.get_my_orders': {
    methods: ["GET","HEAD"]
    pattern: '/order_history/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/order_history_controller').default['getMyOrders']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/order_history_controller').default['getMyOrders']>>>
    }
  }
  'order_history.get_for_customer': {
    methods: ["GET","HEAD"]
    pattern: '/v2/employee/user_details/:detailsId/orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/order_history_controller').default['getForCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/order_history_controller').default['getForCustomer']>>>
    }
  }
  'order_history.update_branch': {
    methods: ["PATCH"]
    pattern: '/v2/admin/orders/:orderId/branch'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/order_history').orderBranchUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/order_history').orderBranchUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/order_history_controller').default['updateBranch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/order_history_controller').default['updateBranch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'checkout.initialize_checkout': {
    methods: ["POST"]
    pattern: '/checkout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/checkout_validators').initializeCheckoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/checkout_validators').initializeCheckoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['initializeCheckout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['initializeCheckout']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'checkout.confirm_checkout': {
    methods: ["POST"]
    pattern: '/checkout/confirm/:orderId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['confirmCheckout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['confirmCheckout']>>>
    }
  }
  'checkout.handle_vipps_callback': {
    methods: ["POST"]
    pattern: '/checkout/vipps/callback'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/checkout_validators').vippsCheckoutSessionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/checkout_validators').vippsCheckoutSessionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['handleVippsCallback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['handleVippsCallback']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'checkout.poll_payment': {
    methods: ["GET","HEAD"]
    pattern: '/checkout/poll/:orderId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['pollPayment']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['pollPayment']>>>
    }
  }
  'stand_checkout.start': {
    methods: ["POST"]
    pattern: '/v2/employee/stand_checkout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stand_checkout').startStandCheckoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stand_checkout').startStandCheckoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stand_checkout_controller').default['start']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stand_checkout_controller').default['start']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stand_checkout.status': {
    methods: ["GET","HEAD"]
    pattern: '/v2/employee/stand_checkout/:orderId/status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stand_checkout_controller').default['status']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stand_checkout_controller').default['status']>>>
    }
  }
  'stand_checkout.cancel': {
    methods: ["POST"]
    pattern: '/v2/employee/stand_checkout/:orderId/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stand_checkout_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stand_checkout_controller').default['cancel']>>>
    }
  }
  'subjects.get_branch_subjects': {
    methods: ["GET","HEAD"]
    pattern: '/subjects/:branchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/subjects_controller').default['getBranchSubjects']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/subjects_controller').default['getBranchSubjects']>>>
    }
  }
  'branch_items.get_branch_items': {
    methods: ["GET","HEAD"]
    pattern: '/branch_items/:branchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branch_items_controller').default['getBranchItems']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branch_items_controller').default['getBranchItems']>>>
    }
  }
  'branch_items.set_branch_items': {
    methods: ["POST"]
    pattern: '/branch_items'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_items').branchItemsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_items').branchItemsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branch_items_controller').default['setBranchItems']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branch_items_controller').default['setBranchItems']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'postal.lookup_postal_code': {
    methods: ["GET","HEAD"]
    pattern: '/postal/lookup/postal_code/:postalCode'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { postalCode: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/postal_controller').default['lookupPostalCode']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/postal_controller').default['lookupPostalCode']>>>
    }
  }
  'companies.get_companies': {
    methods: ["GET","HEAD"]
    pattern: '/v2/companies'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['getCompanies']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['getCompanies']>>>
    }
  }
  'companies.add_company': {
    methods: ["POST"]
    pattern: '/v2/companies'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/companies_validators').companyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/companies_validators').companyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['addCompany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['addCompany']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'companies.delete_company': {
    methods: ["DELETE"]
    pattern: '/v2/companies/:companyId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { companyId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['deleteCompany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['deleteCompany']>>>
    }
  }
  'opening_hours.get': {
    methods: ["GET","HEAD"]
    pattern: '/opening_hours/branch/:branchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['get']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['get']>>>
    }
  }
  'opening_hours.add': {
    methods: ["POST"]
    pattern: '/opening_hours'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/opening_hours').openingHoursValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/opening_hours').openingHoursValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['add']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['add']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'opening_hours.delete': {
    methods: ["DELETE"]
    pattern: '/opening_hours/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['delete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['delete']>>>
    }
  }
  'items.get': {
    methods: ["GET","HEAD"]
    pattern: '/v2/items'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['get']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['get']>>>
    }
  }
  'items.get_buyback_items': {
    methods: ["GET","HEAD"]
    pattern: '/v2/items/buyback'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['getBuybackItems']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['getBuybackItems']>>>
    }
  }
  'items.get_by_isbn': {
    methods: ["GET","HEAD"]
    pattern: '/v2/items/by_isbn/:isbn'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { isbn: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['getByIsbn']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['getByIsbn']>>>
    }
  }
  'dispatch.get_email_templates': {
    methods: ["GET","HEAD"]
    pattern: '/dispatch/email_templates'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dispatch_controller').default['getEmailTemplates']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dispatch_controller').default['getEmailTemplates']>>>
    }
  }
  'dispatch.create_dispatch': {
    methods: ["POST"]
    pattern: '/dispatch'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/dispatch').createDispatchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/dispatch').createDispatchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dispatch_controller').default['createDispatch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dispatch_controller').default['createDispatch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'message_logs.customer_log': {
    methods: ["GET","HEAD"]
    pattern: '/v2/message_logs/customer/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['customerLog']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['customerLog']>>>
    }
  }
  'message_logs.feed': {
    methods: ["GET","HEAD"]
    pattern: '/v2/message_logs/feed'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/message_log').messageLogFeedValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['feed']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['feed']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'message_logs.metrics': {
    methods: ["GET","HEAD"]
    pattern: '/v2/message_logs/metrics'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/message_log').messageLogMetricsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['metrics']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['metrics']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'message_logs.sendouts': {
    methods: ["GET","HEAD"]
    pattern: '/v2/message_logs/sendouts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['sendouts']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['sendouts']>>>
    }
  }
  'webhooks.sendgrid_events': {
    methods: ["POST"]
    pattern: '/webhooks/sendgrid'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/webhooks_controller').default['sendgridEvents']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/webhooks_controller').default['sendgridEvents']>>>
    }
  }
  'webhooks.twilio_sms_event': {
    methods: ["POST"]
    pattern: '/webhooks/twilio/:messageId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { messageId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/webhooks_controller').default['twilioSmsEvent']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/webhooks_controller').default['twilioSmsEvent']>>>
    }
  }
  'handout.handout': {
    methods: ["POST"]
    pattern: '/handout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/handout_validator').handoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/handout_validator').handoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/handout_controller').default['handout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/handout_controller').default['handout']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'bulk_collection.lookup': {
    methods: ["GET","HEAD"]
    pattern: '/bulk-collection/lookup/:blid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/bulk_collection_controller').default['lookup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/bulk_collection_controller').default['lookup']>>>
    }
  }
  'bulk_collection.collect': {
    methods: ["POST"]
    pattern: '/bulk-collection/collect'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/bulk_collection_validator').bulkCollectionCollectValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/bulk_collection_validator').bulkCollectionCollectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/bulk_collection_controller').default['collect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/bulk_collection_controller').default['collect']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.get_customer_items_report': {
    methods: ["GET","HEAD"]
    pattern: '/reports/customer_items'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/report').customerItemsReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['getCustomerItemsReport']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['getCustomerItemsReport']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.get_orders_report': {
    methods: ["GET","HEAD"]
    pattern: '/reports/orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/report').ordersReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['getOrdersReport']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['getOrdersReport']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.get_payments_report': {
    methods: ["GET","HEAD"]
    pattern: '/reports/payments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/report').paymentsReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['getPaymentsReport']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['getPaymentsReport']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.get_user_details_report': {
    methods: ["GET","HEAD"]
    pattern: '/reports/user_details'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/report').userDetailsReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['getUserDetailsReport']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['getUserDetailsReport']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'collection.branches.getId': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.branches.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/branches'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.branches.post': {
    methods: ["POST"]
    pattern: '/branches'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.branches.patch': {
    methods: ["PATCH"]
    pattern: '/branches/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.branchitems.getId': {
    methods: ["GET","HEAD"]
    pattern: '/branchitems/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.branchitems.post': {
    methods: ["POST"]
    pattern: '/branchitems'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.branchitems.patch': {
    methods: ["PATCH"]
    pattern: '/branchitems/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.branchitems.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/branchitems'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.branchitems.delete': {
    methods: ["DELETE"]
    pattern: '/branchitems/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.customeritems.getId': {
    methods: ["GET","HEAD"]
    pattern: '/customeritems/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.customeritems.patch': {
    methods: ["PATCH"]
    pattern: '/customeritems/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.customeritems.post': {
    methods: ["POST"]
    pattern: '/customeritems'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.customeritems.operation.generate-report.post': {
    methods: ["POST"]
    pattern: '/customeritems/generate-report'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.customeritems.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/customeritems'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.deliveries.post': {
    methods: ["POST"]
    pattern: '/deliveries'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.deliveries.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/deliveries'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.deliveries.getId': {
    methods: ["GET","HEAD"]
    pattern: '/deliveries/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.deliveries.patch': {
    methods: ["PATCH"]
    pattern: '/deliveries/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.deliveries.delete': {
    methods: ["DELETE"]
    pattern: '/deliveries/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.items.getId': {
    methods: ["GET","HEAD"]
    pattern: '/items/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.items.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/items'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.items.post': {
    methods: ["POST"]
    pattern: '/items'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.items.patch': {
    methods: ["PATCH"]
    pattern: '/items/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.orders.post': {
    methods: ["POST"]
    pattern: '/orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.orders.delete': {
    methods: ["DELETE"]
    pattern: '/orders/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.orders.patch': {
    methods: ["PATCH"]
    pattern: '/orders/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.orders.operation.place.patch': {
    methods: ["PATCH"]
    pattern: '/orders/:id/place'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.orders.operation.confirm.patch': {
    methods: ["PATCH"]
    pattern: '/orders/:id/confirm'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.orders.getId': {
    methods: ["GET","HEAD"]
    pattern: '/orders/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.orders.operation.get_customer_orders.getId': {
    methods: ["GET","HEAD"]
    pattern: '/orders/:id/get_customer_orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.orders.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.payments.post': {
    methods: ["POST"]
    pattern: '/payments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.payments.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/payments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.payments.getId': {
    methods: ["GET","HEAD"]
    pattern: '/payments/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.payments.delete': {
    methods: ["DELETE"]
    pattern: '/payments/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.userdetails.getId': {
    methods: ["GET","HEAD"]
    pattern: '/userdetails/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.userdetails.operation.valid.getId': {
    methods: ["GET","HEAD"]
    pattern: '/userdetails/:id/valid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.userdetails.operation.permission.getId': {
    methods: ["GET","HEAD"]
    pattern: '/userdetails/:id/permission'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.userdetails.patch': {
    methods: ["PATCH"]
    pattern: '/userdetails/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.userdetails.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/userdetails'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.invoices.getId': {
    methods: ["GET","HEAD"]
    pattern: '/invoices/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.invoices.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/invoices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.invoices.post': {
    methods: ["POST"]
    pattern: '/invoices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.invoices.patch': {
    methods: ["PATCH"]
    pattern: '/invoices/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.companies.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/companies'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.companies.getId': {
    methods: ["GET","HEAD"]
    pattern: '/companies/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.companies.post': {
    methods: ["POST"]
    pattern: '/companies'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.companies.patch': {
    methods: ["PATCH"]
    pattern: '/companies/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.companies.delete': {
    methods: ["DELETE"]
    pattern: '/companies/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.uniqueitems.post': {
    methods: ["POST"]
    pattern: '/uniqueitems'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.uniqueitems.getId': {
    methods: ["GET","HEAD"]
    pattern: '/uniqueitems/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.uniqueitems.operation.active.getId': {
    methods: ["GET","HEAD"]
    pattern: '/uniqueitems/:id/active'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.uniqueitems.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/uniqueitems'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
}
