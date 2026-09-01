import { Schema } from "mongoose";

import type { BlSchema } from "#services/storage_service";
import type { Company } from "#shared/company";

export const CompanySchema: BlSchema<Company> = new Schema({
  name: {
    type: String,
    trim: true,
    required: true,
  },
  contactInfo: {
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    postCode: {
      type: String,
      trim: true,
    },
    postCity: {
      type: String,
      trim: true,
    },
  },
  customerNumber: {
    type: String,
    trim: true,
  },
  organizationNumber: {
    type: String,
    trim: true,
  },
});
