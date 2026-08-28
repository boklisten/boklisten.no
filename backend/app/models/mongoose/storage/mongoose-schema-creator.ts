import mongoose, { Model, Schema } from "mongoose";

import { BlSchema } from "#services/storage_service";

export class MongooseModelCreator<T> {
  constructor(
    private schema: BlSchema<T>,
    private schemaName: string,
  ) {}

  create(): Model<T> {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the mongoose/typed-model boundary: the schema was built from T, but mongoose cannot carry that through model()
    return mongoose.model(
      this.schemaName,
      this.standardizeSchema(this.schema),
    ) as unknown as Model<T>;
  }

  private standardizeSchema(schema: Schema): Schema {
    schema.add({
      active: {
        type: Boolean,
        default: true,
      },
      user: {
        type: {
          id: String,
          permission: String,
        },
      },
      viewableFor: {
        type: [String],
        default: [],
      },
      viewableForPermission: {
        type: String,
      },
      editableFor: {
        type: [String],
        default: [],
      },
    });

    //remove fields that the client shall not see
    schema.set("toJSON", { transform: MongooseModelCreator.transformObject });
    schema.set("toObject", {
      transform: MongooseModelCreator.transformObject,
    });

    // Enable automatic timestamps
    schema.set("timestamps", {
      createdAt: "creationTime",
      updatedAt: "lastUpdated",
    });

    return schema;
  }

  public static transformObject(document_: unknown, returnValue?: unknown): void {
    // Mongoose isn't sure which parameter to use, so try both :/
    if (!returnValue && document_) returnValue = document_;
    if (!returnValue) return;
    // Arrays are also "object" and can be handled the same way
    if (typeof returnValue === "object") {
      const document = returnValue;
      // Translate _id to id only if id does not already exist
      // (embedded documents such as BlDocument.user may have an id field which is different from the _id field)
      if ("_id" in document && !("id" in document)) {
        Reflect.set(document, "id", Reflect.get(document, "_id"));
      }
      Reflect.deleteProperty(document, "_id");
      Reflect.deleteProperty(document, "__v");
      for (const key of Object.keys(document)) {
        const value: unknown = Reflect.get(document, key);
        if (value instanceof mongoose.Types.ObjectId) {
          Reflect.set(document, key, String(value));
        } else if (typeof value === "object") {
          MongooseModelCreator.transformObject(value);
        }
      }
    }
  }
}
