import sgClient from "@sendgrid/client";
import sgMail from "@sendgrid/mail";

import env from "#start/env";

sgMail.setApiKey(env.get("SENDGRID_API_KEY").release());
sgClient.setApiKey(env.get("SENDGRID_API_KEY").release());
