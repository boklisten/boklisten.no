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
  'branch_upload.upload_memberships': {
    methods: ["POST"]
    pattern: '/v2/branches/memberships'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_membership').branchMembershipValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_membership').branchMembershipValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_upload_controller').default['uploadMemberships']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_upload_controller').default['uploadMemberships']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_upload.upload_subject_choices': {
    methods: ["POST"]
    pattern: '/v2/branches/subject_choices'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_upload_controller').default['uploadSubjectChoices']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_upload_controller').default['uploadSubjectChoices']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'matches.generate': {
    methods: ["POST"]
    pattern: '/matches/generate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/matches').matchGenerateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/matches').matchGenerateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['generate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['generate']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'matches.lock': {
    methods: ["POST"]
    pattern: '/user_matches/lock'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/matches').matchLockValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/matches').matchLockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['lock']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['lock']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'user_provisioning.create_users': {
    methods: ["POST"]
    pattern: '/users/create'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_provisioning').userProvisioningValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_provisioning').userProvisioningValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_provisioning_controller').default['createUsers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_provisioning_controller').default['createUsers']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'kustom_checkout.initialize_checkout': {
    methods: ["POST"]
    pattern: '/v2/checkout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/checkout_validators').initializeCheckoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/checkout_validators').initializeCheckoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/kustom_checkout_controller').default['initializeCheckout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/kustom_checkout_controller').default['initializeCheckout']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'kustom_checkout.get_snippet': {
    methods: ["GET","HEAD"]
    pattern: '/v2/checkout/snippet/:orderId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/kustom_checkout_controller').default['getSnippet']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/kustom_checkout_controller').default['getSnippet']>>>
    }
  }
  'kustom_checkout.receive_push': {
    methods: ["POST"]
    pattern: '/v2/checkout/push'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/kustom_checkout_controller').default['receivePush']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/kustom_checkout_controller').default['receivePush']>>>
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
  'rapid_handout.handout': {
    methods: ["POST"]
    pattern: '/rapid-handout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/rapid_handout_validator').rapidHandoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/rapid_handout_validator').rapidHandoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rapid_handout_controller').default['handout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rapid_handout_controller').default['handout']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'collection.userdetails.delete': {
    methods: ["DELETE"]
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
  'collection.messages.post': {
    methods: ["POST"]
    pattern: '/messages'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.messages.operation.sendgrid-events.post': {
    methods: ["POST"]
    pattern: '/messages/sendgrid-events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.messages.operation.twilio-sms-events.post': {
    methods: ["POST"]
    pattern: '/messages/twilio-sms-events'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.messages.getAll': {
    methods: ["GET","HEAD"]
    pattern: '/messages'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.messages.getId': {
    methods: ["GET","HEAD"]
    pattern: '/messages/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'collection.messages.delete': {
    methods: ["DELETE"]
    pattern: '/messages/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
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
