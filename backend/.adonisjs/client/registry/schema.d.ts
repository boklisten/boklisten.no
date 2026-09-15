/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'tokens.refresh': {
    methods: ["POST"]
    pattern: '/auth/token'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').tokenValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').tokenValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/tokens_controller').default['refresh']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/tokens_controller').default['refresh']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'password_reset.request': {
    methods: ["POST"]
    pattern: '/auth/password_reset'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').forgotPasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').forgotPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['request']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['request']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'password_reset.validate': {
    methods: ["GET","HEAD"]
    pattern: '/auth/password_reset/:id/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['validate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['validate']>>>
    }
  }
  'password_reset.reset': {
    methods: ["POST"]
    pattern: '/auth/password_reset/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_validators').passwordResetValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_validators').passwordResetValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['reset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth/password_reset_controller').default['reset']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'email_validation.validate': {
    methods: ["POST"]
    pattern: '/email_validation'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/email_validation').emailValidationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/email_validation').emailValidationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/email_validation_controller').default['validate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/email_validation_controller').default['validate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'postal_codes.show': {
    methods: ["GET","HEAD"]
    pattern: '/postal_codes/:postalCode'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { postalCode: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/postal_codes_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/postal_codes_controller').default['show']>>>
    }
  }
  'bokflyt.contact': {
    methods: ["POST"]
    pattern: '/bokflyt/contact'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/bokflyt').bokflytContactValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/bokflyt').bokflytContactValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/bokflyt_controller').default['contact']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/bokflyt_controller').default['contact']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branches.index': {
    methods: ["GET","HEAD"]
    pattern: '/branches'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['index']>>>
    }
  }
  'branches.index_public': {
    methods: ["GET","HEAD"]
    pattern: '/branches/public'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['indexPublic']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['indexPublic']>>>
    }
  }
  'branches.show': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['show']>>>
    }
  }
  'branch_catalog.show': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId/catalog'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_catalog_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_catalog_controller').default['show']>>>
    }
  }
  'opening_hours.index': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId/opening_hours'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['index']>>>
    }
  }
  'items.buyback': {
    methods: ["GET","HEAD"]
    pattern: '/items/buyback'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['buyback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['buyback']>>>
    }
  }
  'editable_texts.show': {
    methods: ["GET","HEAD"]
    pattern: '/editable_texts/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['show']>>>
    }
  }
  'questions_and_answers.index': {
    methods: ["GET","HEAD"]
    pattern: '/questions_and_answers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/questions_and_answers_controller').default['index']>>>
    }
  }
  'signatures.valid': {
    methods: ["GET","HEAD"]
    pattern: '/signatures/:detailsId/valid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['valid']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['valid']>>>
    }
  }
  'signatures.sign': {
    methods: ["POST"]
    pattern: '/signatures/:detailsId/sign'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/signature').signValidator)>>
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/signature').signValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sign']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sign']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'unique_ids.pdf': {
    methods: ["GET","HEAD"]
    pattern: '/unique_ids/pdf/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['pdf']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['pdf']>>>
    }
  }
  'checkout.vipps_callback': {
    methods: ["POST"]
    pattern: '/checkout/vipps/callback'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/checkout_validators').vippsCheckoutSessionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/checkout_validators').vippsCheckoutSessionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['vippsCallback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['vippsCallback']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'public_blid_lookup.show': {
    methods: ["GET","HEAD"]
    pattern: '/public_blid_lookup/:blid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/public_blid_lookup_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/public_blid_lookup_controller').default['show']>>>
    }
  }
  'user_details.me': {
    methods: ["GET","HEAD"]
    pattern: '/user_details/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['me']>>>
    }
  }
  'user_details.update_me': {
    methods: ["PATCH"]
    pattern: '/user_details/me'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_detail').customerUpdateUserDetailsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_detail').customerUpdateUserDetailsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['updateMe']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['updateMe']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'customer_items.me': {
    methods: ["GET","HEAD"]
    pattern: '/customer_items/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer_items_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer_items_controller').default['me']>>>
    }
  }
  'signatures.me': {
    methods: ["GET","HEAD"]
    pattern: '/signatures/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['me']>>>
    }
  }
  'signatures.send_link_me': {
    methods: ["POST"]
    pattern: '/signatures/me/send'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sendLinkMe']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sendLinkMe']>>>
    }
  }
  'orders.index_me': {
    methods: ["GET","HEAD"]
    pattern: '/orders/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['indexMe']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['indexMe']>>>
    }
  }
  'orders.open_items_me': {
    methods: ["GET","HEAD"]
    pattern: '/orders/me/open_items'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['openItemsMe']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['openItemsMe']>>>
    }
  }
  'orders.cancel_item_me': {
    methods: ["POST"]
    pattern: '/orders/me/cancel_item'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/cancel_order_item_validator').cancelOrderItemValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/cancel_order_item_validator').cancelOrderItemValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancelItemMe']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['cancelItemMe']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.show_me': {
    methods: ["GET","HEAD"]
    pattern: '/orders/me/:orderId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['showMe']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['showMe']>>>
    }
  }
  'checkout.initialize': {
    methods: ["POST"]
    pattern: '/checkout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/checkout_validators').initializeCheckoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/checkout_validators').initializeCheckoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['initialize']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['initialize']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'checkout.confirm': {
    methods: ["POST"]
    pattern: '/checkout/:orderId/confirm'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['confirm']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['confirm']>>>
    }
  }
  'checkout.status': {
    methods: ["GET","HEAD"]
    pattern: '/checkout/:orderId/status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['status']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/checkout_controller').default['status']>>>
    }
  }
  'matches.me': {
    methods: ["GET","HEAD"]
    pattern: '/matches/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['me']>>>
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
  'branches.store': {
    methods: ["POST"]
    pattern: '/branches'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch').branchCreateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch').branchCreateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_relationships.update': {
    methods: ["PATCH"]
    pattern: '/branches/relationships'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch').branchRelationshipValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch').branchRelationshipValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_relationships_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_relationships_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_members.update': {
    methods: ["PATCH"]
    pattern: '/branches/members'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_membership').updateBranchMembershipValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_membership').updateBranchMembershipValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_members_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_members_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branches.update': {
    methods: ["PATCH"]
    pattern: '/branches/:branchId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch').branchValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch').branchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branches_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_items.index': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId/items'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_items_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_items_controller').default['index']>>>
    }
  }
  'branch_items.update': {
    methods: ["PUT"]
    pattern: '/branches/:branchId/items'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_items').branchItemsValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_items').branchItemsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_items_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_items_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'opening_hours.store': {
    methods: ["POST"]
    pattern: '/opening_hours'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/opening_hours').openingHoursValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/opening_hours').openingHoursValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'opening_hours.destroy': {
    methods: ["DELETE"]
    pattern: '/opening_hours/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/opening_hours_controller').default['destroy']>>>
    }
  }
  'branch_members.index': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId/members'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_members_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_members_controller').default['index']>>>
    }
  }
  'branch_members.destroy_direct': {
    methods: ["DELETE"]
    pattern: '/branches/:branchId/members/direct'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_members_controller').default['destroyDirect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_members_controller').default['destroyDirect']>>>
    }
  }
  'branch_members.destroy_indirect': {
    methods: ["DELETE"]
    pattern: '/branches/:branchId/members/indirect'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_members_controller').default['destroyIndirect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_members_controller').default['destroyIndirect']>>>
    }
  }
  'branch_subjects.index': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId/subjects'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['index']>>>
    }
  }
  'branch_subjects.store': {
    methods: ["POST"]
    pattern: '/branches/:branchId/subjects'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_subjects').branchSubjectValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_subjects').branchSubjectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_subjects.import': {
    methods: ["POST"]
    pattern: '/branches/:branchId/subjects/import'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['import']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['import']>>>
    }
  }
  'branch_subjects.update': {
    methods: ["PUT"]
    pattern: '/branches/:branchId/subjects/:subjectId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_subjects').branchSubjectValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { branchId: ParamValue; subjectId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_subjects').branchSubjectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_subjects.destroy': {
    methods: ["DELETE"]
    pattern: '/branches/:branchId/subjects/:subjectId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { branchId: ParamValue; subjectId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subjects_controller').default['destroy']>>>
    }
  }
  'branch_subject_choices.evaluate': {
    methods: ["POST"]
    pattern: '/branches/:branchId/subject_choices/evaluate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subject_choices_controller').default['evaluate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subject_choices_controller').default['evaluate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_subject_choices.upload': {
    methods: ["POST"]
    pattern: '/branches/:branchId/subject_choices/upload'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/subject_choices').subjectChoicesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_subject_choices_controller').default['upload']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_subject_choices_controller').default['upload']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'branch_signature_status.show': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId/signature_status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_signature_status_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_signature_status_controller').default['show']>>>
    }
  }
  'branch_insights.get_book_movements': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId/insights/book_movements'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_insights_controller').default['getBookMovements']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_insights_controller').default['getBookMovements']>>>
    }
  }
  'branch_books.get_active_books': {
    methods: ["GET","HEAD"]
    pattern: '/branches/:branchId/active_books'
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
    pattern: '/branches/:branchId/active_books/details'
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
    pattern: '/branches/:branchId/active_books'
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
    pattern: '/branches/:branchId/ordered_books'
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
    pattern: '/branches/:branchId/ordered_books/details'
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
    pattern: '/branches/:branchId/ordered_books'
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
    pattern: '/branches/:branchId/ordered_books/cancel'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/branch_books').orderedBooksCancelValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/branch_books').orderedBooksCancelValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['cancelOrderedBooks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/branches/branch_books_controller').default['cancelOrderedBooks']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_provisioning.evaluate': {
    methods: ["POST"]
    pattern: '/branches/:branchId/users/evaluate'
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
    pattern: '/branches/:branchId/users/provision'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_provisioning').userProvisioningValidator)>>
      paramsTuple: [ParamValue]
      params: { branchId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/user_provisioning').userProvisioningValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_provisioning_controller').default['provision']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_provisioning_controller').default['provision']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.metrics': {
    methods: ["GET","HEAD"]
    pattern: '/users/metrics'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['metrics']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['metrics']>>>
    }
  }
  'users.duplicates': {
    methods: ["GET","HEAD"]
    pattern: '/users/duplicates'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['duplicates']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['duplicates']>>>
    }
  }
  'users.employees': {
    methods: ["GET","HEAD"]
    pattern: '/users/employees'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['employees']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['employees']>>>
    }
  }
  'users.merge_preview': {
    methods: ["GET","HEAD"]
    pattern: '/users/merge_preview/:fromDetailsId/:toDetailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { fromDetailsId: ParamValue; toDetailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['mergePreview']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['mergePreview']>>>
    }
  }
  'users.merge': {
    methods: ["POST"]
    pattern: '/users/merge'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_management').mergeUsersValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_management').mergeUsersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['merge']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['merge']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.set_permission': {
    methods: ["PUT"]
    pattern: '/users/permission'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_management').setPermissionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_management').setPermissionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['setPermission']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['setPermission']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'users.destroy': {
    methods: ["DELETE"]
    pattern: '/users/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['destroy']>>>
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
  'items.all': {
    methods: ["GET","HEAD"]
    pattern: '/items/all'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['all']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['all']>>>
    }
  }
  'items.store': {
    methods: ["POST"]
    pattern: '/items'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/items').createItemValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/items').createItemValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'items.bulk_upsert': {
    methods: ["POST"]
    pattern: '/items/bulk'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/items').bulkUpsertItemsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/items').bulkUpsertItemsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['bulkUpsert']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['bulkUpsert']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'items.update': {
    methods: ["PATCH"]
    pattern: '/items/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/items').updateItemValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/items').updateItemValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.index': {
    methods: ["GET","HEAD"]
    pattern: '/invoices'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['index']>>>
    }
  }
  'invoices.generation_defaults': {
    methods: ["GET","HEAD"]
    pattern: '/invoices/generation_defaults'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/invoices').invoiceGenerationDefaultsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['generationDefaults']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['generationDefaults']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.generate': {
    methods: ["POST"]
    pattern: '/invoices/generate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/invoices').invoiceGenerationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/invoices').invoiceGenerationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['generate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['generate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.create_company_invoice': {
    methods: ["POST"]
    pattern: '/invoices/company'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/invoices').companyInvoiceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/invoices').companyInvoiceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['createCompanyInvoice']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['createCompanyInvoice']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.export': {
    methods: ["POST"]
    pattern: '/invoices/export'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/invoices').invoiceExportValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/invoices').invoiceExportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['export']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.set_statuses': {
    methods: ["PATCH"]
    pattern: '/invoices/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/invoices').invoiceBulkStatusValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/invoices').invoiceBulkStatusValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['setStatuses']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['setStatuses']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.show': {
    methods: ["GET","HEAD"]
    pattern: '/invoices/:invoiceId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { invoiceId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['show']>>>
    }
  }
  'invoices.set_status': {
    methods: ["PATCH"]
    pattern: '/invoices/:invoiceId/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/invoices').invoiceStatusValidator)>>
      paramsTuple: [ParamValue]
      params: { invoiceId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/invoices').invoiceStatusValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['setStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['setStatus']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invoices.set_line_cancelled': {
    methods: ["PATCH"]
    pattern: '/invoices/:invoiceId/lines/:lineIndex'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/invoices').invoiceLineCancelValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { invoiceId: ParamValue; lineIndex: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/invoices').invoiceLineCancelValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['setLineCancelled']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invoices_controller').default['setLineCancelled']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'editable_texts.index': {
    methods: ["GET","HEAD"]
    pattern: '/editable_texts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/editable_texts_controller').default['index']>>>
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
  'companies.index': {
    methods: ["GET","HEAD"]
    pattern: '/companies'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['index']>>>
    }
  }
  'companies.store': {
    methods: ["POST"]
    pattern: '/companies'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/companies_validators').companyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/companies_validators').companyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'companies.destroy': {
    methods: ["DELETE"]
    pattern: '/companies/:companyId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { companyId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/companies_controller').default['destroy']>>>
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
  'reminders.send': {
    methods: ["POST"]
    pattern: '/reminders/send'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/reminder').reminderValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/reminder').reminderValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reminders_controller').default['send']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reminders_controller').default['send']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'dispatch.email_templates': {
    methods: ["GET","HEAD"]
    pattern: '/dispatch/email_templates'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dispatch_controller').default['emailTemplates']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dispatch_controller').default['emailTemplates']>>>
    }
  }
  'dispatch.store': {
    methods: ["POST"]
    pattern: '/dispatch'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/dispatch').createDispatchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/dispatch').createDispatchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dispatch_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dispatch_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.customer_items': {
    methods: ["GET","HEAD"]
    pattern: '/reports/customer_items'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/report').customerItemsReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['customerItems']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['customerItems']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.orders': {
    methods: ["GET","HEAD"]
    pattern: '/reports/orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/report').ordersReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['orders']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['orders']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.payments': {
    methods: ["GET","HEAD"]
    pattern: '/reports/payments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/report').paymentsReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['payments']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['payments']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'reports.user_details': {
    methods: ["GET","HEAD"]
    pattern: '/reports/user_details'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/report').userDetailsReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['userDetails']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/reports_controller').default['userDetails']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'unique_ids.token': {
    methods: ["GET","HEAD"]
    pattern: '/unique_ids/token'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['token']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['token']>>>
    }
  }
  'user_details.search': {
    methods: ["POST"]
    pattern: '/user_details/search'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_detail').userDetailSearchValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user_detail').userDetailSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_details.show': {
    methods: ["GET","HEAD"]
    pattern: '/user_details/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['show']>>>
    }
  }
  'user_details.update': {
    methods: ["PATCH"]
    pattern: '/user_details/:detailsId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user_detail').employeeUpdateUserDetailsValidator)>>
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/user_detail').employeeUpdateUserDetailsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'user_details.confirm_email': {
    methods: ["POST"]
    pattern: '/user_details/:detailsId/confirm_email'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['confirmEmail']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/user_details_controller').default['confirmEmail']>>>
    }
  }
  'customer_items.for_customer': {
    methods: ["GET","HEAD"]
    pattern: '/user_details/:detailsId/customer_items'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customer_items_controller').default['forCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customer_items_controller').default['forCustomer']>>>
    }
  }
  'orders.for_customer': {
    methods: ["GET","HEAD"]
    pattern: '/user_details/:detailsId/orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['forCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['forCustomer']>>>
    }
  }
  'orders.placed_for_customer': {
    methods: ["GET","HEAD"]
    pattern: '/user_details/:detailsId/placed_orders'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['placedForCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['placedForCustomer']>>>
    }
  }
  'matches.for_customer': {
    methods: ["GET","HEAD"]
    pattern: '/user_details/:detailsId/matches'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['forCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['forCustomer']>>>
    }
  }
  'message_logs.for_customer': {
    methods: ["GET","HEAD"]
    pattern: '/user_details/:detailsId/message_logs'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['forCustomer']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['forCustomer']>>>
    }
  }
  'signatures.show': {
    methods: ["GET","HEAD"]
    pattern: '/signatures/:detailsId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['show']>>>
    }
  }
  'signatures.send_link': {
    methods: ["POST"]
    pattern: '/signatures/:detailsId/send'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { detailsId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sendLink']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/signatures_controller').default['sendLink']>>>
    }
  }
  'orders.index': {
    methods: ["GET","HEAD"]
    pattern: '/orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/order_manager').orderManagerListValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.export': {
    methods: ["GET","HEAD"]
    pattern: '/orders/export'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/order_manager').orderManagerReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['export']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.export_bring': {
    methods: ["GET","HEAD"]
    pattern: '/orders/export/bring'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/order_manager').orderManagerBringReportValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['exportBring']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['exportBring']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.show': {
    methods: ["GET","HEAD"]
    pattern: '/orders/:orderId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['show']>>>
    }
  }
  'orders.update_branch': {
    methods: ["PATCH"]
    pattern: '/orders/:orderId/branch'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/order_history').orderBranchUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/order_history').orderBranchUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['updateBranch']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['updateBranch']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.update_item_deadline': {
    methods: ["PATCH"]
    pattern: '/orders/:orderId/item_deadline'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/order_history').orderItemDeadlineUpdateValidator)>>
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/order_history').orderItemDeadlineUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['updateItemDeadline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['updateItemDeadline']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'orders.destroy': {
    methods: ["DELETE"]
    pattern: '/orders/:orderId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/orders_controller').default['destroy']>>>
    }
  }
  'stand_cart.resolve_line': {
    methods: ["POST"]
    pattern: '/stand_cart/lines'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stand_cart').standCartResolveValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stand_cart').standCartResolveValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['resolveLine']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['resolveLine']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stand_cart.refund_plan': {
    methods: ["POST"]
    pattern: '/stand_cart/refund_plan'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stand_cart').standCartRefundPlanValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stand_cart').standCartRefundPlanValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['refundPlan']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['refundPlan']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stand_cart.checkout': {
    methods: ["POST"]
    pattern: '/stand_cart/checkout'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/stand_cart').standCartCheckoutValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/stand_cart').standCartCheckoutValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['checkout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['checkout']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'stand_cart.status': {
    methods: ["GET","HEAD"]
    pattern: '/stand_cart/:orderId/status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['status']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['status']>>>
    }
  }
  'stand_cart.cancel': {
    methods: ["POST"]
    pattern: '/stand_cart/:orderId/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['cancel']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stand_cart_controller').default['cancel']>>>
    }
  }
  'bulk_collection.collect': {
    methods: ["POST"]
    pattern: '/bulk_collection'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/bulk_collection_validator').bulkCollectionCollectValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/bulk_collection_validator').bulkCollectionCollectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/bulk_collection_controller').default['collect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/bulk_collection_controller').default['collect']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'bulk_collection.show': {
    methods: ["GET","HEAD"]
    pattern: '/bulk_collection/:blid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/bulk_collection_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/bulk_collection_controller').default['show']>>>
    }
  }
  'blids.index': {
    methods: ["GET","HEAD"]
    pattern: '/blids'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/blid_search').blidSearchQueryValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'blids.register': {
    methods: ["POST"]
    pattern: '/blids/register'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/blid_registration').blidRegistrationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/blid_registration').blidRegistrationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['register']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['register']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'blids.register_one': {
    methods: ["POST"]
    pattern: '/blids/register_one'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/unique_item').uniqueItemsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/unique_item').uniqueItemsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['registerOne']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['registerOne']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'blids.update_active_item': {
    methods: ["PATCH"]
    pattern: '/blids/active_item'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/blid_search').blidActiveItemUpdateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/blid_search').blidActiveItemUpdateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['updateActiveItem']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['updateActiveItem']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'blids.show': {
    methods: ["GET","HEAD"]
    pattern: '/blids/:blid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['show']>>>
    }
  }
  'blids.show_link': {
    methods: ["GET","HEAD"]
    pattern: '/blids/:blid/link'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['showLink']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['showLink']>>>
    }
  }
  'blids.relink': {
    methods: ["PATCH"]
    pattern: '/blids/:blid/item'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/blid_search').blidRelinkValidator)>>
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/blid_search').blidRelinkValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['relink']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['relink']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'blids.destroy': {
    methods: ["DELETE"]
    pattern: '/blids/:blid'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/blids_controller').default['destroy']>>>
    }
  }
  'unique_ids.label': {
    methods: ["GET","HEAD"]
    pattern: '/unique_ids/:blid/label'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { blid: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['label']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/unique_ids_controller').default['label']>>>
    }
  }
  'matches.show': {
    methods: ["GET","HEAD"]
    pattern: '/matches/:matchId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { matchId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/matches_controller').default['show']>>>
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
  'match_rounds.matches': {
    methods: ["GET","HEAD"]
    pattern: '/match_rounds/:id/matches'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['matches']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['matches']>>>
    }
  }
  'match_rounds.statistics': {
    methods: ["GET","HEAD"]
    pattern: '/match_rounds/:id/statistics'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['statistics']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/match_rounds_controller').default['statistics']>>>
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
  'items.index': {
    methods: ["GET","HEAD"]
    pattern: '/items'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['index']>>>
    }
  }
  'items.show_by_isbn': {
    methods: ["GET","HEAD"]
    pattern: '/items/by_isbn/:isbn'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { isbn: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/items_controller').default['showByIsbn']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/items_controller').default['showByIsbn']>>>
    }
  }
  'waiting_list_customers.index': {
    methods: ["GET","HEAD"]
    pattern: '/waiting_list_customers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/waiting_list_customers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/waiting_list_customers_controller').default['index']>>>
    }
  }
  'waiting_list_customers.store': {
    methods: ["POST"]
    pattern: '/waiting_list_customers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/waiting_list_customer').waitingListCustomerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/waiting_list_customer').waitingListCustomerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/waiting_list_customers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/waiting_list_customers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'waiting_list_customers.destroy': {
    methods: ["DELETE"]
    pattern: '/waiting_list_customers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/waiting_list_customers_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/waiting_list_customers_controller').default['destroy']>>>
    }
  }
  'message_logs.feed': {
    methods: ["GET","HEAD"]
    pattern: '/message_logs/feed'
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
    pattern: '/message_logs/metrics'
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
    pattern: '/message_logs/sendouts'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['sendouts']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/message_logs_controller').default['sendouts']>>>
    }
  }
}
