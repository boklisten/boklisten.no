import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'tokens.legacy_token': { paramsTuple?: []; params?: {} }
    'tokens.token': { paramsTuple?: []; params?: {} }
    'vipps.redirect': { paramsTuple?: []; params?: {} }
    'vipps.callback': { paramsTuple?: []; params?: {} }
    'local.login': { paramsTuple?: []; params?: {} }
    'local.register': { paramsTuple?: []; params?: {} }
    'password_reset.request_password_reset': { paramsTuple?: []; params?: {} }
    'password_reset.validate_password_reset': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'token': ParamValue} }
    'password_reset.reset_password': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'waiting_list_customer.get_all': { paramsTuple?: []; params?: {} }
    'waiting_list_customer.create': { paramsTuple?: []; params?: {} }
    'waiting_list_customer.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'reminders.count_recipients': { paramsTuple?: []; params?: {} }
    'reminders.remind': { paramsTuple?: []; params?: {} }
    'branches.get_public': { paramsTuple?: []; params?: {} }
    'branches.get_all': { paramsTuple?: []; params?: {} }
    'branches.get_by_id': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branches.add': { paramsTuple?: []; params?: {} }
    'branches.update': { paramsTuple?: []; params?: {} }
    'branch_upload.evaluate_subject_choices': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_upload.upload_subject_choices': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.get_subjects': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.create_subject': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.update_subject': { paramsTuple: [ParamValue,ParamValue]; params: {'branchId': ParamValue,'subjectId': ParamValue} }
    'branch_subjects.delete_subject': { paramsTuple: [ParamValue,ParamValue]; params: {'branchId': ParamValue,'subjectId': ParamValue} }
    'branch_subjects.import_subjects': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_signature_status.get_status': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_relationship.update': { paramsTuple?: []; params?: {} }
    'branch_membership.get_members': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_membership.update_membership': { paramsTuple?: []; params?: {} }
    'branch_membership.remove_direct_members': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_membership.remove_indirect_members': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.bulk_update_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.bulk_update_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.cancel_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'orders.get_open_orders': { paramsTuple?: []; params?: {} }
    'orders.get_placed_orders': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.cancel_order_item': { paramsTuple?: []; params?: {} }
    'orders.cancel_order_item_as_employee': { paramsTuple?: []; params?: {} }
    'editable_texts.get': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'editable_texts.get_all': { paramsTuple?: []; params?: {} }
    'editable_texts.upsert': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'editable_texts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.get_all': { paramsTuple?: []; params?: {} }
    'questions_and_answers.store': { paramsTuple?: []; params?: {} }
    'questions_and_answers.update_order': { paramsTuple?: []; params?: {} }
    'questions_and_answers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'email_verification.send': { paramsTuple?: []; params?: {} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'public_blid_lookup.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blid_search.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blid_search.update_active_item': { paramsTuple?: []; params?: {} }
    'matches.notify': { paramsTuple?: []; params?: {} }
    'matches.get_my_matches': { paramsTuple?: []; params?: {} }
    'matches.get_matches_for_customer': { paramsTuple: [ParamValue]; params: {'customerId': ParamValue} }
    'matches.get_all_matches': { paramsTuple?: []; params?: {} }
    'matches.get_matches_for_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'matches.get_match_by_id': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'matches.transfer_item': { paramsTuple?: []; params?: {} }
    'matches.send_to_stand': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_statistics.get_statistics': { paramsTuple?: []; params?: {} }
    'match_statistics.get_statistics_for_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'match_rounds.index': { paramsTuple?: []; params?: {} }
    'match_rounds.store': { paramsTuple?: []; params?: {} }
    'match_rounds.plan_metrics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.generate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.destroy_matches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_detail.get_by_id': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_detail.search': { paramsTuple?: []; params?: {} }
    'user_detail.get_my_details': { paramsTuple?: []; params?: {} }
    'user_detail.update_as_customer': { paramsTuple?: []; params?: {} }
    'user_detail.update_as_employee': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_detail.confirm_email': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_management.metrics': { paramsTuple?: []; params?: {} }
    'user_management.duplicates': { paramsTuple?: []; params?: {} }
    'user_management.merge': { paramsTuple?: []; params?: {} }
    'user_management.employees': { paramsTuple?: []; params?: {} }
    'user_management.set_permission': { paramsTuple?: []; params?: {} }
    'user_management.destroy': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'customer_items.get_customer_items': { paramsTuple?: []; params?: {} }
    'customer_items.get_active_customer_items_for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.gallery': { paramsTuple?: []; params?: {} }
    'signatures.send_signature_link': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.send_signature_link_as_customer': { paramsTuple?: []; params?: {} }
    'signatures.get_my_signature': { paramsTuple?: []; params?: {} }
    'signatures.has_valid_signature': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.get_signature': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.sign': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'unique_ids.get_token': { paramsTuple?: []; params?: {} }
    'unique_ids.download_unique_id_pdf': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'user_provisioning.evaluate': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'user_provisioning.provision': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'unique_items.add': { paramsTuple?: []; params?: {} }
    'order_history.get_my_order': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'order_history.get_my_orders': { paramsTuple?: []; params?: {} }
    'checkout.initialize_checkout': { paramsTuple?: []; params?: {} }
    'checkout.confirm_checkout': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'checkout.handle_vipps_callback': { paramsTuple?: []; params?: {} }
    'checkout.poll_payment': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'subjects.get_branch_subjects': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_items.get_branch_items': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_items.set_branch_items': { paramsTuple?: []; params?: {} }
    'postal.lookup_postal_code': { paramsTuple: [ParamValue]; params: {'postalCode': ParamValue} }
    'companies.get_companies': { paramsTuple?: []; params?: {} }
    'companies.add_company': { paramsTuple?: []; params?: {} }
    'companies.delete_company': { paramsTuple: [ParamValue]; params: {'companyId': ParamValue} }
    'opening_hours.get': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'opening_hours.add': { paramsTuple?: []; params?: {} }
    'opening_hours.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'items.get': { paramsTuple?: []; params?: {} }
    'items.get_buyback_items': { paramsTuple?: []; params?: {} }
    'items.get_by_isbn': { paramsTuple: [ParamValue]; params: {'isbn': ParamValue} }
    'dispatch.get_email_templates': { paramsTuple?: []; params?: {} }
    'dispatch.create_dispatch': { paramsTuple?: []; params?: {} }
    'message_logs.customer_log': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'message_logs.feed': { paramsTuple?: []; params?: {} }
    'message_logs.metrics': { paramsTuple?: []; params?: {} }
    'message_logs.sendouts': { paramsTuple?: []; params?: {} }
    'webhooks.sendgrid_events': { paramsTuple?: []; params?: {} }
    'webhooks.twilio_sms_event': { paramsTuple: [ParamValue]; params: {'messageId': ParamValue} }
    'handout.handout': { paramsTuple?: []; params?: {} }
    'bulk_collection.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'bulk_collection.collect': { paramsTuple?: []; params?: {} }
    'reports.get_customer_items_report': { paramsTuple?: []; params?: {} }
    'reports.get_orders_report': { paramsTuple?: []; params?: {} }
    'reports.get_payments_report': { paramsTuple?: []; params?: {} }
    'reports.get_user_details_report': { paramsTuple?: []; params?: {} }
    'collection.branches.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branches.getAll': { paramsTuple?: []; params?: {} }
    'collection.branches.post': { paramsTuple?: []; params?: {} }
    'collection.branches.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branchitems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branchitems.post': { paramsTuple?: []; params?: {} }
    'collection.branchitems.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branchitems.getAll': { paramsTuple?: []; params?: {} }
    'collection.branchitems.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.customeritems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.customeritems.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.customeritems.post': { paramsTuple?: []; params?: {} }
    'collection.customeritems.operation.generate-report.post': { paramsTuple?: []; params?: {} }
    'collection.customeritems.getAll': { paramsTuple?: []; params?: {} }
    'collection.deliveries.post': { paramsTuple?: []; params?: {} }
    'collection.deliveries.getAll': { paramsTuple?: []; params?: {} }
    'collection.deliveries.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.deliveries.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.deliveries.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.items.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.items.getAll': { paramsTuple?: []; params?: {} }
    'collection.items.post': { paramsTuple?: []; params?: {} }
    'collection.items.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.post': { paramsTuple?: []; params?: {} }
    'collection.orders.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.operation.place.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.operation.confirm.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.operation.get_customer_orders.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.getAll': { paramsTuple?: []; params?: {} }
    'collection.payments.post': { paramsTuple?: []; params?: {} }
    'collection.payments.getAll': { paramsTuple?: []; params?: {} }
    'collection.payments.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.payments.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.operation.valid.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.operation.permission.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.getAll': { paramsTuple?: []; params?: {} }
    'collection.invoices.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.invoices.getAll': { paramsTuple?: []; params?: {} }
    'collection.invoices.post': { paramsTuple?: []; params?: {} }
    'collection.invoices.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.companies.getAll': { paramsTuple?: []; params?: {} }
    'collection.companies.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.companies.post': { paramsTuple?: []; params?: {} }
    'collection.companies.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.companies.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.post': { paramsTuple?: []; params?: {} }
    'collection.uniqueitems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.operation.active.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.getAll': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'vipps.redirect': { paramsTuple?: []; params?: {} }
    'vipps.callback': { paramsTuple?: []; params?: {} }
    'password_reset.validate_password_reset': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'token': ParamValue} }
    'waiting_list_customer.get_all': { paramsTuple?: []; params?: {} }
    'branches.get_public': { paramsTuple?: []; params?: {} }
    'branches.get_all': { paramsTuple?: []; params?: {} }
    'branches.get_by_id': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.get_subjects': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_signature_status.get_status': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_membership.get_members': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'orders.get_open_orders': { paramsTuple?: []; params?: {} }
    'orders.get_placed_orders': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'editable_texts.get': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'editable_texts.get_all': { paramsTuple?: []; params?: {} }
    'questions_and_answers.get_all': { paramsTuple?: []; params?: {} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'public_blid_lookup.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blid_search.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'matches.get_my_matches': { paramsTuple?: []; params?: {} }
    'matches.get_matches_for_customer': { paramsTuple: [ParamValue]; params: {'customerId': ParamValue} }
    'matches.get_all_matches': { paramsTuple?: []; params?: {} }
    'matches.get_matches_for_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'matches.get_match_by_id': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_statistics.get_statistics': { paramsTuple?: []; params?: {} }
    'match_statistics.get_statistics_for_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'match_rounds.index': { paramsTuple?: []; params?: {} }
    'match_rounds.plan_metrics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_detail.get_by_id': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_detail.get_my_details': { paramsTuple?: []; params?: {} }
    'user_management.metrics': { paramsTuple?: []; params?: {} }
    'user_management.duplicates': { paramsTuple?: []; params?: {} }
    'user_management.employees': { paramsTuple?: []; params?: {} }
    'customer_items.get_customer_items': { paramsTuple?: []; params?: {} }
    'customer_items.get_active_customer_items_for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.gallery': { paramsTuple?: []; params?: {} }
    'signatures.get_my_signature': { paramsTuple?: []; params?: {} }
    'signatures.has_valid_signature': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.get_signature': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'unique_ids.get_token': { paramsTuple?: []; params?: {} }
    'unique_ids.download_unique_id_pdf': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'order_history.get_my_order': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'order_history.get_my_orders': { paramsTuple?: []; params?: {} }
    'checkout.poll_payment': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'subjects.get_branch_subjects': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_items.get_branch_items': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'postal.lookup_postal_code': { paramsTuple: [ParamValue]; params: {'postalCode': ParamValue} }
    'companies.get_companies': { paramsTuple?: []; params?: {} }
    'opening_hours.get': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'items.get': { paramsTuple?: []; params?: {} }
    'items.get_buyback_items': { paramsTuple?: []; params?: {} }
    'items.get_by_isbn': { paramsTuple: [ParamValue]; params: {'isbn': ParamValue} }
    'dispatch.get_email_templates': { paramsTuple?: []; params?: {} }
    'message_logs.customer_log': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'message_logs.feed': { paramsTuple?: []; params?: {} }
    'message_logs.metrics': { paramsTuple?: []; params?: {} }
    'message_logs.sendouts': { paramsTuple?: []; params?: {} }
    'bulk_collection.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'reports.get_customer_items_report': { paramsTuple?: []; params?: {} }
    'reports.get_orders_report': { paramsTuple?: []; params?: {} }
    'reports.get_payments_report': { paramsTuple?: []; params?: {} }
    'reports.get_user_details_report': { paramsTuple?: []; params?: {} }
    'collection.branches.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branches.getAll': { paramsTuple?: []; params?: {} }
    'collection.branchitems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branchitems.getAll': { paramsTuple?: []; params?: {} }
    'collection.customeritems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.customeritems.getAll': { paramsTuple?: []; params?: {} }
    'collection.deliveries.getAll': { paramsTuple?: []; params?: {} }
    'collection.deliveries.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.items.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.items.getAll': { paramsTuple?: []; params?: {} }
    'collection.orders.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.operation.get_customer_orders.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.getAll': { paramsTuple?: []; params?: {} }
    'collection.payments.getAll': { paramsTuple?: []; params?: {} }
    'collection.payments.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.operation.valid.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.operation.permission.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.getAll': { paramsTuple?: []; params?: {} }
    'collection.invoices.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.invoices.getAll': { paramsTuple?: []; params?: {} }
    'collection.companies.getAll': { paramsTuple?: []; params?: {} }
    'collection.companies.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.operation.active.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.getAll': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'vipps.redirect': { paramsTuple?: []; params?: {} }
    'vipps.callback': { paramsTuple?: []; params?: {} }
    'password_reset.validate_password_reset': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'token': ParamValue} }
    'waiting_list_customer.get_all': { paramsTuple?: []; params?: {} }
    'branches.get_public': { paramsTuple?: []; params?: {} }
    'branches.get_all': { paramsTuple?: []; params?: {} }
    'branches.get_by_id': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.get_subjects': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_signature_status.get_status': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_membership.get_members': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'orders.get_open_orders': { paramsTuple?: []; params?: {} }
    'orders.get_placed_orders': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'editable_texts.get': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'editable_texts.get_all': { paramsTuple?: []; params?: {} }
    'questions_and_answers.get_all': { paramsTuple?: []; params?: {} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'public_blid_lookup.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blid_search.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'matches.get_my_matches': { paramsTuple?: []; params?: {} }
    'matches.get_matches_for_customer': { paramsTuple: [ParamValue]; params: {'customerId': ParamValue} }
    'matches.get_all_matches': { paramsTuple?: []; params?: {} }
    'matches.get_matches_for_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'matches.get_match_by_id': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_statistics.get_statistics': { paramsTuple?: []; params?: {} }
    'match_statistics.get_statistics_for_round': { paramsTuple: [ParamValue]; params: {'roundId': ParamValue} }
    'match_rounds.index': { paramsTuple?: []; params?: {} }
    'match_rounds.plan_metrics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_detail.get_by_id': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_detail.get_my_details': { paramsTuple?: []; params?: {} }
    'user_management.metrics': { paramsTuple?: []; params?: {} }
    'user_management.duplicates': { paramsTuple?: []; params?: {} }
    'user_management.employees': { paramsTuple?: []; params?: {} }
    'customer_items.get_customer_items': { paramsTuple?: []; params?: {} }
    'customer_items.get_active_customer_items_for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.gallery': { paramsTuple?: []; params?: {} }
    'signatures.get_my_signature': { paramsTuple?: []; params?: {} }
    'signatures.has_valid_signature': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.get_signature': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'unique_ids.get_token': { paramsTuple?: []; params?: {} }
    'unique_ids.download_unique_id_pdf': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'order_history.get_my_order': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'order_history.get_my_orders': { paramsTuple?: []; params?: {} }
    'checkout.poll_payment': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'subjects.get_branch_subjects': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_items.get_branch_items': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'postal.lookup_postal_code': { paramsTuple: [ParamValue]; params: {'postalCode': ParamValue} }
    'companies.get_companies': { paramsTuple?: []; params?: {} }
    'opening_hours.get': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'items.get': { paramsTuple?: []; params?: {} }
    'items.get_buyback_items': { paramsTuple?: []; params?: {} }
    'items.get_by_isbn': { paramsTuple: [ParamValue]; params: {'isbn': ParamValue} }
    'dispatch.get_email_templates': { paramsTuple?: []; params?: {} }
    'message_logs.customer_log': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'message_logs.feed': { paramsTuple?: []; params?: {} }
    'message_logs.metrics': { paramsTuple?: []; params?: {} }
    'message_logs.sendouts': { paramsTuple?: []; params?: {} }
    'bulk_collection.lookup': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'reports.get_customer_items_report': { paramsTuple?: []; params?: {} }
    'reports.get_orders_report': { paramsTuple?: []; params?: {} }
    'reports.get_payments_report': { paramsTuple?: []; params?: {} }
    'reports.get_user_details_report': { paramsTuple?: []; params?: {} }
    'collection.branches.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branches.getAll': { paramsTuple?: []; params?: {} }
    'collection.branchitems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branchitems.getAll': { paramsTuple?: []; params?: {} }
    'collection.customeritems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.customeritems.getAll': { paramsTuple?: []; params?: {} }
    'collection.deliveries.getAll': { paramsTuple?: []; params?: {} }
    'collection.deliveries.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.items.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.items.getAll': { paramsTuple?: []; params?: {} }
    'collection.orders.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.operation.get_customer_orders.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.getAll': { paramsTuple?: []; params?: {} }
    'collection.payments.getAll': { paramsTuple?: []; params?: {} }
    'collection.payments.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.operation.valid.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.operation.permission.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.getAll': { paramsTuple?: []; params?: {} }
    'collection.invoices.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.invoices.getAll': { paramsTuple?: []; params?: {} }
    'collection.companies.getAll': { paramsTuple?: []; params?: {} }
    'collection.companies.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.operation.active.getId': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.uniqueitems.getAll': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'tokens.legacy_token': { paramsTuple?: []; params?: {} }
    'tokens.token': { paramsTuple?: []; params?: {} }
    'local.login': { paramsTuple?: []; params?: {} }
    'local.register': { paramsTuple?: []; params?: {} }
    'password_reset.request_password_reset': { paramsTuple?: []; params?: {} }
    'password_reset.reset_password': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'waiting_list_customer.create': { paramsTuple?: []; params?: {} }
    'reminders.count_recipients': { paramsTuple?: []; params?: {} }
    'reminders.remind': { paramsTuple?: []; params?: {} }
    'branches.add': { paramsTuple?: []; params?: {} }
    'branch_upload.evaluate_subject_choices': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_upload.upload_subject_choices': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.create_subject': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.import_subjects': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.cancel_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'orders.cancel_order_item': { paramsTuple?: []; params?: {} }
    'orders.cancel_order_item_as_employee': { paramsTuple?: []; params?: {} }
    'questions_and_answers.store': { paramsTuple?: []; params?: {} }
    'email_verification.send': { paramsTuple?: []; params?: {} }
    'matches.notify': { paramsTuple?: []; params?: {} }
    'matches.transfer_item': { paramsTuple?: []; params?: {} }
    'matches.send_to_stand': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_rounds.store': { paramsTuple?: []; params?: {} }
    'match_rounds.generate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_detail.search': { paramsTuple?: []; params?: {} }
    'user_detail.update_as_customer': { paramsTuple?: []; params?: {} }
    'user_detail.update_as_employee': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_detail.confirm_email': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_management.merge': { paramsTuple?: []; params?: {} }
    'user_management.set_permission': { paramsTuple?: []; params?: {} }
    'signatures.send_signature_link': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.send_signature_link_as_customer': { paramsTuple?: []; params?: {} }
    'signatures.sign': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_provisioning.evaluate': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'user_provisioning.provision': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'unique_items.add': { paramsTuple?: []; params?: {} }
    'checkout.initialize_checkout': { paramsTuple?: []; params?: {} }
    'checkout.confirm_checkout': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'checkout.handle_vipps_callback': { paramsTuple?: []; params?: {} }
    'branch_items.set_branch_items': { paramsTuple?: []; params?: {} }
    'companies.add_company': { paramsTuple?: []; params?: {} }
    'opening_hours.add': { paramsTuple?: []; params?: {} }
    'dispatch.create_dispatch': { paramsTuple?: []; params?: {} }
    'webhooks.sendgrid_events': { paramsTuple?: []; params?: {} }
    'webhooks.twilio_sms_event': { paramsTuple: [ParamValue]; params: {'messageId': ParamValue} }
    'handout.handout': { paramsTuple?: []; params?: {} }
    'bulk_collection.collect': { paramsTuple?: []; params?: {} }
    'collection.branches.post': { paramsTuple?: []; params?: {} }
    'collection.branchitems.post': { paramsTuple?: []; params?: {} }
    'collection.customeritems.post': { paramsTuple?: []; params?: {} }
    'collection.customeritems.operation.generate-report.post': { paramsTuple?: []; params?: {} }
    'collection.deliveries.post': { paramsTuple?: []; params?: {} }
    'collection.items.post': { paramsTuple?: []; params?: {} }
    'collection.orders.post': { paramsTuple?: []; params?: {} }
    'collection.payments.post': { paramsTuple?: []; params?: {} }
    'collection.invoices.post': { paramsTuple?: []; params?: {} }
    'collection.companies.post': { paramsTuple?: []; params?: {} }
    'collection.uniqueitems.post': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'waiting_list_customer.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'branch_subjects.delete_subject': { paramsTuple: [ParamValue,ParamValue]; params: {'branchId': ParamValue,'subjectId': ParamValue} }
    'branch_membership.remove_direct_members': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_membership.remove_indirect_members': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'editable_texts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.destroy_matches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_management.destroy': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'companies.delete_company': { paramsTuple: [ParamValue]; params: {'companyId': ParamValue} }
    'opening_hours.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branchitems.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.deliveries.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.payments.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.companies.delete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'branches.update': { paramsTuple?: []; params?: {} }
    'branch_relationship.update': { paramsTuple?: []; params?: {} }
    'branch_membership.update_membership': { paramsTuple?: []; params?: {} }
    'branch_books.bulk_update_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.bulk_update_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'questions_and_answers.update_order': { paramsTuple?: []; params?: {} }
    'questions_and_answers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'blid_search.update_active_item': { paramsTuple?: []; params?: {} }
    'match_rounds.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branches.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.branchitems.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.customeritems.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.deliveries.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.items.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.operation.place.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.orders.operation.confirm.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.userdetails.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.invoices.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'collection.companies.patch': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'branch_subjects.update_subject': { paramsTuple: [ParamValue,ParamValue]; params: {'branchId': ParamValue,'subjectId': ParamValue} }
    'editable_texts.upsert': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}