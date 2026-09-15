import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'tokens.refresh': { paramsTuple?: []; params?: {} }
    'vipps.redirect': { paramsTuple?: []; params?: {} }
    'vipps.callback': { paramsTuple?: []; params?: {} }
    'local.login': { paramsTuple?: []; params?: {} }
    'local.register': { paramsTuple?: []; params?: {} }
    'password_reset.request': { paramsTuple?: []; params?: {} }
    'password_reset.validate': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'token': ParamValue} }
    'password_reset.reset': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'email_validation.validate': { paramsTuple?: []; params?: {} }
    'postal_codes.show': { paramsTuple: [ParamValue]; params: {'postalCode': ParamValue} }
    'bokflyt.contact': { paramsTuple?: []; params?: {} }
    'branches.index': { paramsTuple?: []; params?: {} }
    'branches.index_public': { paramsTuple?: []; params?: {} }
    'branches.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_catalog.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'opening_hours.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'items.buyback': { paramsTuple?: []; params?: {} }
    'editable_texts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.index': { paramsTuple?: []; params?: {} }
    'signatures.valid': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.sign': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'unique_ids.pdf': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'checkout.vipps_callback': { paramsTuple?: []; params?: {} }
    'webhooks.sendgrid_events': { paramsTuple?: []; params?: {} }
    'webhooks.twilio_sms_event': { paramsTuple: [ParamValue]; params: {'messageId': ParamValue} }
    'email_verification.send': { paramsTuple?: []; params?: {} }
    'public_blid_lookup.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'user_details.me': { paramsTuple?: []; params?: {} }
    'user_details.update_me': { paramsTuple?: []; params?: {} }
    'customer_items.me': { paramsTuple?: []; params?: {} }
    'signatures.me': { paramsTuple?: []; params?: {} }
    'signatures.send_link_me': { paramsTuple?: []; params?: {} }
    'orders.index_me': { paramsTuple?: []; params?: {} }
    'orders.open_items_me': { paramsTuple?: []; params?: {} }
    'orders.cancel_item_me': { paramsTuple?: []; params?: {} }
    'orders.show_me': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'checkout.initialize': { paramsTuple?: []; params?: {} }
    'checkout.confirm': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'checkout.status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'matches.me': { paramsTuple?: []; params?: {} }
    'matches.transfer_item': { paramsTuple?: []; params?: {} }
    'branches.store': { paramsTuple?: []; params?: {} }
    'branch_relationships.update': { paramsTuple?: []; params?: {} }
    'branch_members.update': { paramsTuple?: []; params?: {} }
    'branches.update': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_items.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_items.update': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'opening_hours.store': { paramsTuple?: []; params?: {} }
    'opening_hours.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'branch_members.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_members.destroy_direct': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_members.destroy_indirect': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.store': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.import': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.update': { paramsTuple: [ParamValue,ParamValue]; params: {'branchId': ParamValue,'subjectId': ParamValue} }
    'branch_subjects.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'branchId': ParamValue,'subjectId': ParamValue} }
    'branch_subject_choices.evaluate': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subject_choices.upload': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_signature_status.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_insights.get_book_movements': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.bulk_update_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.bulk_update_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.cancel_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'user_provisioning.evaluate': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'user_provisioning.provision': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'users.metrics': { paramsTuple?: []; params?: {} }
    'users.duplicates': { paramsTuple?: []; params?: {} }
    'users.employees': { paramsTuple?: []; params?: {} }
    'users.merge_preview': { paramsTuple: [ParamValue,ParamValue]; params: {'fromDetailsId': ParamValue,'toDetailsId': ParamValue} }
    'users.merge': { paramsTuple?: []; params?: {} }
    'users.set_permission': { paramsTuple?: []; params?: {} }
    'users.destroy': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.gallery': { paramsTuple?: []; params?: {} }
    'matches.notify': { paramsTuple?: []; params?: {} }
    'matches.send_to_stand': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_rounds.store': { paramsTuple?: []; params?: {} }
    'match_rounds.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.generate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.destroy_matches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'items.all': { paramsTuple?: []; params?: {} }
    'items.store': { paramsTuple?: []; params?: {} }
    'items.bulk_upsert': { paramsTuple?: []; params?: {} }
    'items.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.generation_defaults': { paramsTuple?: []; params?: {} }
    'invoices.generate': { paramsTuple?: []; params?: {} }
    'invoices.create_company_invoice': { paramsTuple?: []; params?: {} }
    'invoices.export': { paramsTuple?: []; params?: {} }
    'invoices.set_statuses': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'invoiceId': ParamValue} }
    'invoices.set_status': { paramsTuple: [ParamValue]; params: {'invoiceId': ParamValue} }
    'invoices.set_line_cancelled': { paramsTuple: [ParamValue,ParamValue]; params: {'invoiceId': ParamValue,'lineIndex': ParamValue} }
    'editable_texts.index': { paramsTuple?: []; params?: {} }
    'editable_texts.upsert': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'editable_texts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.store': { paramsTuple?: []; params?: {} }
    'questions_and_answers.update_order': { paramsTuple?: []; params?: {} }
    'questions_and_answers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'companies.store': { paramsTuple?: []; params?: {} }
    'companies.destroy': { paramsTuple: [ParamValue]; params: {'companyId': ParamValue} }
    'reminders.count_recipients': { paramsTuple?: []; params?: {} }
    'reminders.send': { paramsTuple?: []; params?: {} }
    'dispatch.email_templates': { paramsTuple?: []; params?: {} }
    'dispatch.store': { paramsTuple?: []; params?: {} }
    'reports.customer_items': { paramsTuple?: []; params?: {} }
    'reports.orders': { paramsTuple?: []; params?: {} }
    'reports.payments': { paramsTuple?: []; params?: {} }
    'reports.user_details': { paramsTuple?: []; params?: {} }
    'unique_ids.token': { paramsTuple?: []; params?: {} }
    'user_details.search': { paramsTuple?: []; params?: {} }
    'user_details.show': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_details.update': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'user_details.confirm_email': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'customer_items.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.placed_for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'matches.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'message_logs.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.show': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.send_link': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.index': { paramsTuple?: []; params?: {} }
    'orders.export': { paramsTuple?: []; params?: {} }
    'orders.export_bring': { paramsTuple?: []; params?: {} }
    'orders.show': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.update_branch': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.update_item_deadline': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.destroy': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'stand_cart.resolve_line': { paramsTuple?: []; params?: {} }
    'stand_cart.refund_plan': { paramsTuple?: []; params?: {} }
    'stand_cart.checkout': { paramsTuple?: []; params?: {} }
    'stand_cart.status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'stand_cart.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'bulk_collection.collect': { paramsTuple?: []; params?: {} }
    'bulk_collection.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blids.index': { paramsTuple?: []; params?: {} }
    'blids.register': { paramsTuple?: []; params?: {} }
    'blids.register_one': { paramsTuple?: []; params?: {} }
    'blids.update_active_item': { paramsTuple?: []; params?: {} }
    'blids.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blids.show_link': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blids.relink': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blids.destroy': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'unique_ids.label': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'matches.show': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_rounds.index': { paramsTuple?: []; params?: {} }
    'match_rounds.matches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.statistics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.plan_metrics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'items.index': { paramsTuple?: []; params?: {} }
    'items.show_by_isbn': { paramsTuple: [ParamValue]; params: {'isbn': ParamValue} }
    'waiting_list_customers.index': { paramsTuple?: []; params?: {} }
    'waiting_list_customers.store': { paramsTuple?: []; params?: {} }
    'waiting_list_customers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'message_logs.feed': { paramsTuple?: []; params?: {} }
    'message_logs.metrics': { paramsTuple?: []; params?: {} }
    'message_logs.sendouts': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'vipps.redirect': { paramsTuple?: []; params?: {} }
    'vipps.callback': { paramsTuple?: []; params?: {} }
    'password_reset.validate': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'token': ParamValue} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'postal_codes.show': { paramsTuple: [ParamValue]; params: {'postalCode': ParamValue} }
    'branches.index': { paramsTuple?: []; params?: {} }
    'branches.index_public': { paramsTuple?: []; params?: {} }
    'branches.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_catalog.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'opening_hours.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'items.buyback': { paramsTuple?: []; params?: {} }
    'editable_texts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.index': { paramsTuple?: []; params?: {} }
    'signatures.valid': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'unique_ids.pdf': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'public_blid_lookup.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'user_details.me': { paramsTuple?: []; params?: {} }
    'customer_items.me': { paramsTuple?: []; params?: {} }
    'signatures.me': { paramsTuple?: []; params?: {} }
    'orders.index_me': { paramsTuple?: []; params?: {} }
    'orders.open_items_me': { paramsTuple?: []; params?: {} }
    'orders.show_me': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'checkout.status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'matches.me': { paramsTuple?: []; params?: {} }
    'branch_items.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_members.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_signature_status.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_insights.get_book_movements': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'users.metrics': { paramsTuple?: []; params?: {} }
    'users.duplicates': { paramsTuple?: []; params?: {} }
    'users.employees': { paramsTuple?: []; params?: {} }
    'users.merge_preview': { paramsTuple: [ParamValue,ParamValue]; params: {'fromDetailsId': ParamValue,'toDetailsId': ParamValue} }
    'signatures.gallery': { paramsTuple?: []; params?: {} }
    'items.all': { paramsTuple?: []; params?: {} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.generation_defaults': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'invoiceId': ParamValue} }
    'editable_texts.index': { paramsTuple?: []; params?: {} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'dispatch.email_templates': { paramsTuple?: []; params?: {} }
    'reports.customer_items': { paramsTuple?: []; params?: {} }
    'reports.orders': { paramsTuple?: []; params?: {} }
    'reports.payments': { paramsTuple?: []; params?: {} }
    'reports.user_details': { paramsTuple?: []; params?: {} }
    'unique_ids.token': { paramsTuple?: []; params?: {} }
    'user_details.show': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'customer_items.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.placed_for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'matches.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'message_logs.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.show': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.index': { paramsTuple?: []; params?: {} }
    'orders.export': { paramsTuple?: []; params?: {} }
    'orders.export_bring': { paramsTuple?: []; params?: {} }
    'orders.show': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'stand_cart.status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'bulk_collection.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blids.index': { paramsTuple?: []; params?: {} }
    'blids.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blids.show_link': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'unique_ids.label': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'matches.show': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_rounds.index': { paramsTuple?: []; params?: {} }
    'match_rounds.matches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.statistics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.plan_metrics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'items.index': { paramsTuple?: []; params?: {} }
    'items.show_by_isbn': { paramsTuple: [ParamValue]; params: {'isbn': ParamValue} }
    'waiting_list_customers.index': { paramsTuple?: []; params?: {} }
    'message_logs.feed': { paramsTuple?: []; params?: {} }
    'message_logs.metrics': { paramsTuple?: []; params?: {} }
    'message_logs.sendouts': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'vipps.redirect': { paramsTuple?: []; params?: {} }
    'vipps.callback': { paramsTuple?: []; params?: {} }
    'password_reset.validate': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'token': ParamValue} }
    'email_verification.verify': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'postal_codes.show': { paramsTuple: [ParamValue]; params: {'postalCode': ParamValue} }
    'branches.index': { paramsTuple?: []; params?: {} }
    'branches.index_public': { paramsTuple?: []; params?: {} }
    'branches.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_catalog.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'opening_hours.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'items.buyback': { paramsTuple?: []; params?: {} }
    'editable_texts.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.index': { paramsTuple?: []; params?: {} }
    'signatures.valid': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'unique_ids.pdf': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'public_blid_lookup.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'user_details.me': { paramsTuple?: []; params?: {} }
    'customer_items.me': { paramsTuple?: []; params?: {} }
    'signatures.me': { paramsTuple?: []; params?: {} }
    'orders.index_me': { paramsTuple?: []; params?: {} }
    'orders.open_items_me': { paramsTuple?: []; params?: {} }
    'orders.show_me': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'checkout.status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'matches.me': { paramsTuple?: []; params?: {} }
    'branch_items.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_members.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.index': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_signature_status.show': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_insights.get_book_movements': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_active_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.get_ordered_book_details': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'users.metrics': { paramsTuple?: []; params?: {} }
    'users.duplicates': { paramsTuple?: []; params?: {} }
    'users.employees': { paramsTuple?: []; params?: {} }
    'users.merge_preview': { paramsTuple: [ParamValue,ParamValue]; params: {'fromDetailsId': ParamValue,'toDetailsId': ParamValue} }
    'signatures.gallery': { paramsTuple?: []; params?: {} }
    'items.all': { paramsTuple?: []; params?: {} }
    'invoices.index': { paramsTuple?: []; params?: {} }
    'invoices.generation_defaults': { paramsTuple?: []; params?: {} }
    'invoices.show': { paramsTuple: [ParamValue]; params: {'invoiceId': ParamValue} }
    'editable_texts.index': { paramsTuple?: []; params?: {} }
    'companies.index': { paramsTuple?: []; params?: {} }
    'dispatch.email_templates': { paramsTuple?: []; params?: {} }
    'reports.customer_items': { paramsTuple?: []; params?: {} }
    'reports.orders': { paramsTuple?: []; params?: {} }
    'reports.payments': { paramsTuple?: []; params?: {} }
    'reports.user_details': { paramsTuple?: []; params?: {} }
    'unique_ids.token': { paramsTuple?: []; params?: {} }
    'user_details.show': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'customer_items.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.placed_for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'matches.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'message_logs.for_customer': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.show': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.index': { paramsTuple?: []; params?: {} }
    'orders.export': { paramsTuple?: []; params?: {} }
    'orders.export_bring': { paramsTuple?: []; params?: {} }
    'orders.show': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'stand_cart.status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'bulk_collection.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blids.index': { paramsTuple?: []; params?: {} }
    'blids.show': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'blids.show_link': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'unique_ids.label': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'matches.show': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_rounds.index': { paramsTuple?: []; params?: {} }
    'match_rounds.matches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.statistics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.plan_metrics': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'items.index': { paramsTuple?: []; params?: {} }
    'items.show_by_isbn': { paramsTuple: [ParamValue]; params: {'isbn': ParamValue} }
    'waiting_list_customers.index': { paramsTuple?: []; params?: {} }
    'message_logs.feed': { paramsTuple?: []; params?: {} }
    'message_logs.metrics': { paramsTuple?: []; params?: {} }
    'message_logs.sendouts': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'tokens.refresh': { paramsTuple?: []; params?: {} }
    'local.login': { paramsTuple?: []; params?: {} }
    'local.register': { paramsTuple?: []; params?: {} }
    'password_reset.request': { paramsTuple?: []; params?: {} }
    'password_reset.reset': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'email_validation.validate': { paramsTuple?: []; params?: {} }
    'bokflyt.contact': { paramsTuple?: []; params?: {} }
    'signatures.sign': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'checkout.vipps_callback': { paramsTuple?: []; params?: {} }
    'webhooks.sendgrid_events': { paramsTuple?: []; params?: {} }
    'webhooks.twilio_sms_event': { paramsTuple: [ParamValue]; params: {'messageId': ParamValue} }
    'email_verification.send': { paramsTuple?: []; params?: {} }
    'signatures.send_link_me': { paramsTuple?: []; params?: {} }
    'orders.cancel_item_me': { paramsTuple?: []; params?: {} }
    'checkout.initialize': { paramsTuple?: []; params?: {} }
    'checkout.confirm': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'matches.transfer_item': { paramsTuple?: []; params?: {} }
    'branches.store': { paramsTuple?: []; params?: {} }
    'opening_hours.store': { paramsTuple?: []; params?: {} }
    'branch_subjects.store': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.import': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subject_choices.evaluate': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subject_choices.upload': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.cancel_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'user_provisioning.evaluate': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'user_provisioning.provision': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'users.merge': { paramsTuple?: []; params?: {} }
    'matches.notify': { paramsTuple?: []; params?: {} }
    'matches.send_to_stand': { paramsTuple: [ParamValue]; params: {'matchId': ParamValue} }
    'match_rounds.store': { paramsTuple?: []; params?: {} }
    'match_rounds.generate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'items.store': { paramsTuple?: []; params?: {} }
    'items.bulk_upsert': { paramsTuple?: []; params?: {} }
    'invoices.generate': { paramsTuple?: []; params?: {} }
    'invoices.create_company_invoice': { paramsTuple?: []; params?: {} }
    'invoices.export': { paramsTuple?: []; params?: {} }
    'questions_and_answers.store': { paramsTuple?: []; params?: {} }
    'companies.store': { paramsTuple?: []; params?: {} }
    'reminders.count_recipients': { paramsTuple?: []; params?: {} }
    'reminders.send': { paramsTuple?: []; params?: {} }
    'dispatch.store': { paramsTuple?: []; params?: {} }
    'user_details.search': { paramsTuple?: []; params?: {} }
    'user_details.confirm_email': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'signatures.send_link': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'stand_cart.resolve_line': { paramsTuple?: []; params?: {} }
    'stand_cart.refund_plan': { paramsTuple?: []; params?: {} }
    'stand_cart.checkout': { paramsTuple?: []; params?: {} }
    'stand_cart.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'bulk_collection.collect': { paramsTuple?: []; params?: {} }
    'blids.register': { paramsTuple?: []; params?: {} }
    'blids.register_one': { paramsTuple?: []; params?: {} }
    'waiting_list_customers.store': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'user_details.update_me': { paramsTuple?: []; params?: {} }
    'branch_relationships.update': { paramsTuple?: []; params?: {} }
    'branch_members.update': { paramsTuple?: []; params?: {} }
    'branches.update': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.bulk_update_active_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_books.bulk_update_ordered_books': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'match_rounds.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'items.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invoices.set_statuses': { paramsTuple?: []; params?: {} }
    'invoices.set_status': { paramsTuple: [ParamValue]; params: {'invoiceId': ParamValue} }
    'invoices.set_line_cancelled': { paramsTuple: [ParamValue,ParamValue]; params: {'invoiceId': ParamValue,'lineIndex': ParamValue} }
    'questions_and_answers.update_order': { paramsTuple?: []; params?: {} }
    'questions_and_answers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'user_details.update': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'orders.update_branch': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.update_item_deadline': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'blids.update_active_item': { paramsTuple?: []; params?: {} }
    'blids.relink': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
  }
  PUT: {
    'branch_items.update': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.update': { paramsTuple: [ParamValue,ParamValue]; params: {'branchId': ParamValue,'subjectId': ParamValue} }
    'users.set_permission': { paramsTuple?: []; params?: {} }
    'editable_texts.upsert': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'opening_hours.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'branch_members.destroy_direct': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_members.destroy_indirect': { paramsTuple: [ParamValue]; params: {'branchId': ParamValue} }
    'branch_subjects.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'branchId': ParamValue,'subjectId': ParamValue} }
    'users.destroy': { paramsTuple: [ParamValue]; params: {'detailsId': ParamValue} }
    'match_rounds.destroy_matches': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'match_rounds.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'editable_texts.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'questions_and_answers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'companies.destroy': { paramsTuple: [ParamValue]; params: {'companyId': ParamValue} }
    'orders.destroy': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'blids.destroy': { paramsTuple: [ParamValue]; params: {'blid': ParamValue} }
    'waiting_list_customers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}