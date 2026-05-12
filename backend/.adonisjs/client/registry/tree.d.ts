/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  tokens: {
    legacyToken: typeof routes['tokens.legacy_token']
    token: typeof routes['tokens.token']
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
    requestPasswordReset: typeof routes['password_reset.request_password_reset']
    validatePasswordReset: typeof routes['password_reset.validate_password_reset']
    resetPassword: typeof routes['password_reset.reset_password']
  }
  waitingListCustomer: {
    getAll: typeof routes['waiting_list_customer.get_all']
    create: typeof routes['waiting_list_customer.create']
    destroy: typeof routes['waiting_list_customer.destroy']
  }
  reminders: {
    countRecipients: typeof routes['reminders.count_recipients']
    remind: typeof routes['reminders.remind']
  }
  branches: {
    getPublic: typeof routes['branches.get_public']
    getAll: typeof routes['branches.get_all']
    getById: typeof routes['branches.get_by_id']
    add: typeof routes['branches.add']
    update: typeof routes['branches.update']
  }
  branchUpload: {
    uploadMemberships: typeof routes['branch_upload.upload_memberships']
    uploadSubjectChoices: typeof routes['branch_upload.upload_subject_choices']
  }
  branchRelationship: {
    update: typeof routes['branch_relationship.update']
  }
  branchMembership: {
    getMembers: typeof routes['branch_membership.get_members']
    updateMembership: typeof routes['branch_membership.update_membership']
    removeDirectMembers: typeof routes['branch_membership.remove_direct_members']
    removeIndirectMembers: typeof routes['branch_membership.remove_indirect_members']
  }
  orders: {
    getOpenOrders: typeof routes['orders.get_open_orders']
    getPlacedOrders: typeof routes['orders.get_placed_orders']
    cancelOrderItem: typeof routes['orders.cancel_order_item']
  }
  editableTexts: {
    get: typeof routes['editable_texts.get']
    getAll: typeof routes['editable_texts.get_all']
    upsert: typeof routes['editable_texts.upsert']
    destroy: typeof routes['editable_texts.destroy']
  }
  questionsAndAnswers: {
    getAll: typeof routes['questions_and_answers.get_all']
    store: typeof routes['questions_and_answers.store']
    update: typeof routes['questions_and_answers.update']
    destroy: typeof routes['questions_and_answers.destroy']
  }
  emailVerification: {
    send: typeof routes['email_verification.send']
    verify: typeof routes['email_verification.verify']
  }
  publicBlidLookup: {
    lookup: typeof routes['public_blid_lookup.lookup']
  }
  matches: {
    generate: typeof routes['matches.generate']
    notify: typeof routes['matches.notify']
    lock: typeof routes['matches.lock']
    getMyMatches: typeof routes['matches.get_my_matches']
    transferItem: typeof routes['matches.transfer_item']
  }
  userDetail: {
    getById: typeof routes['user_detail.get_by_id']
    search: typeof routes['user_detail.search']
    getMyDetails: typeof routes['user_detail.get_my_details']
    updateAsCustomer: typeof routes['user_detail.update_as_customer']
    updateAsEmployee: typeof routes['user_detail.update_as_employee']
  }
  customerItems: {
    getCustomerItems: typeof routes['customer_items.get_customer_items']
  }
  signatures: {
    sendSignatureLink: typeof routes['signatures.send_signature_link']
    sendSignatureLinkAsCustomer: typeof routes['signatures.send_signature_link_as_customer']
    hasValidSignature: typeof routes['signatures.has_valid_signature']
    getSignature: typeof routes['signatures.get_signature']
    sign: typeof routes['signatures.sign']
  }
  uniqueIds: {
    getToken: typeof routes['unique_ids.get_token']
    downloadUniqueIdPdf: typeof routes['unique_ids.download_unique_id_pdf']
  }
  userProvisioning: {
    createUsers: typeof routes['user_provisioning.create_users']
  }
  uniqueItems: {
    add: typeof routes['unique_items.add']
  }
  orderHistory: {
    getMyOrder: typeof routes['order_history.get_my_order']
    getMyOrders: typeof routes['order_history.get_my_orders']
  }
  checkout: {
    initializeCheckout: typeof routes['checkout.initialize_checkout']
    confirmCheckout: typeof routes['checkout.confirm_checkout']
    handleVippsCallback: typeof routes['checkout.handle_vipps_callback']
    pollPayment: typeof routes['checkout.poll_payment']
  }
  kustomCheckout: {
    initializeCheckout: typeof routes['kustom_checkout.initialize_checkout']
    getSnippet: typeof routes['kustom_checkout.get_snippet']
    receivePush: typeof routes['kustom_checkout.receive_push']
  }
  subjects: {
    getBranchSubjects: typeof routes['subjects.get_branch_subjects']
  }
  branchItems: {
    getBranchItems: typeof routes['branch_items.get_branch_items']
    setBranchItems: typeof routes['branch_items.set_branch_items']
  }
  postal: {
    lookupPostalCode: typeof routes['postal.lookup_postal_code']
  }
  companies: {
    getCompanies: typeof routes['companies.get_companies']
    addCompany: typeof routes['companies.add_company']
    deleteCompany: typeof routes['companies.delete_company']
  }
  openingHours: {
    get: typeof routes['opening_hours.get']
    add: typeof routes['opening_hours.add']
    delete: typeof routes['opening_hours.delete']
  }
  items: {
    get: typeof routes['items.get']
    getBuybackItems: typeof routes['items.get_buyback_items']
  }
  dispatch: {
    getEmailTemplates: typeof routes['dispatch.get_email_templates']
    createDispatch: typeof routes['dispatch.create_dispatch']
  }
  rapidHandout: {
    handout: typeof routes['rapid_handout.handout']
  }
  reports: {
    getCustomerItemsReport: typeof routes['reports.get_customer_items_report']
    getOrdersReport: typeof routes['reports.get_orders_report']
    getPaymentsReport: typeof routes['reports.get_payments_report']
    getUserDetailsReport: typeof routes['reports.get_user_details_report']
  }
  collection: {
    branches: {
      getId: typeof routes['collection.branches.getId']
      getAll: typeof routes['collection.branches.getAll']
      post: typeof routes['collection.branches.post']
      patch: typeof routes['collection.branches.patch']
    }
    branchitems: {
      getId: typeof routes['collection.branchitems.getId']
      post: typeof routes['collection.branchitems.post']
      patch: typeof routes['collection.branchitems.patch']
      getAll: typeof routes['collection.branchitems.getAll']
      delete: typeof routes['collection.branchitems.delete']
    }
    customeritems: {
      getId: typeof routes['collection.customeritems.getId']
      patch: typeof routes['collection.customeritems.patch']
      post: typeof routes['collection.customeritems.post']
      operation: {
        generateReport: {
          post: typeof routes['collection.customeritems.operation.generate-report.post']
        }
      }
      getAll: typeof routes['collection.customeritems.getAll']
    }
    deliveries: {
      post: typeof routes['collection.deliveries.post']
      getAll: typeof routes['collection.deliveries.getAll']
      getId: typeof routes['collection.deliveries.getId']
      patch: typeof routes['collection.deliveries.patch']
      delete: typeof routes['collection.deliveries.delete']
    }
    items: {
      getId: typeof routes['collection.items.getId']
      getAll: typeof routes['collection.items.getAll']
      post: typeof routes['collection.items.post']
      patch: typeof routes['collection.items.patch']
    }
    orders: {
      post: typeof routes['collection.orders.post']
      delete: typeof routes['collection.orders.delete']
      patch: typeof routes['collection.orders.patch']
      operation: {
        place: {
          patch: typeof routes['collection.orders.operation.place.patch']
        }
        confirm: {
          patch: typeof routes['collection.orders.operation.confirm.patch']
        }
        getCustomerOrders: {
          getId: typeof routes['collection.orders.operation.get_customer_orders.getId']
        }
      }
      getId: typeof routes['collection.orders.getId']
      getAll: typeof routes['collection.orders.getAll']
    }
    payments: {
      post: typeof routes['collection.payments.post']
      getAll: typeof routes['collection.payments.getAll']
      getId: typeof routes['collection.payments.getId']
      delete: typeof routes['collection.payments.delete']
    }
    userdetails: {
      getId: typeof routes['collection.userdetails.getId']
      operation: {
        valid: {
          getId: typeof routes['collection.userdetails.operation.valid.getId']
        }
        permission: {
          getId: typeof routes['collection.userdetails.operation.permission.getId']
        }
      }
      patch: typeof routes['collection.userdetails.patch']
      delete: typeof routes['collection.userdetails.delete']
      getAll: typeof routes['collection.userdetails.getAll']
    }
    messages: {
      post: typeof routes['collection.messages.post']
      operation: {
        sendgridEvents: {
          post: typeof routes['collection.messages.operation.sendgrid-events.post']
        }
        twilioSmsEvents: {
          post: typeof routes['collection.messages.operation.twilio-sms-events.post']
        }
      }
      getAll: typeof routes['collection.messages.getAll']
      getId: typeof routes['collection.messages.getId']
      delete: typeof routes['collection.messages.delete']
    }
    invoices: {
      getId: typeof routes['collection.invoices.getId']
      getAll: typeof routes['collection.invoices.getAll']
      post: typeof routes['collection.invoices.post']
      patch: typeof routes['collection.invoices.patch']
    }
    companies: {
      getAll: typeof routes['collection.companies.getAll']
      getId: typeof routes['collection.companies.getId']
      post: typeof routes['collection.companies.post']
      patch: typeof routes['collection.companies.patch']
      delete: typeof routes['collection.companies.delete']
    }
    uniqueitems: {
      post: typeof routes['collection.uniqueitems.post']
      getId: typeof routes['collection.uniqueitems.getId']
      operation: {
        active: {
          getId: typeof routes['collection.uniqueitems.operation.active.getId']
        }
      }
      getAll: typeof routes['collection.uniqueitems.getAll']
    }
  }
}
