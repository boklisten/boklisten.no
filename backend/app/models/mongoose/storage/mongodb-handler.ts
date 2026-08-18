import logger from "@adonisjs/core/services/logger";
import {
  SchemaType,
  QueryFilter,
  Model,
  MongooseUpdateQueryOptions,
  PipelineStage,
  Types,
  UpdateQuery,
  UpdateWithAggregationPipeline,
  UpdateWriteOpResult,
} from "mongoose";

import { MongooseModelCreator } from "#models/mongoose/storage/mongoose-schema-creator";
import { ExpandFilter } from "#services/legacy/query/db-query-expand-filter";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { PermissionService } from "#services/permission_service";
import { BlSchema } from "#services/storage_service";
import { BlDocument } from "#shared/bl-document";
import { BlError } from "#shared/bl-error";
import { UserPermission } from "#shared/user-permission";
import { NestedDocument } from "#types/nested-document";

export class MongodbHandler<T extends BlDocument> {
  private readonly mongooseModel: Model<T>;
  public path: string;

  constructor(schema: BlSchema<T>, modelName: string) {
    this.path = modelName;
    this.mongooseModel = new MongooseModelCreator<T>(schema, modelName).create();
  }

  // fixme: disallow undefined here, and handle missing values higher up
  public async get(id: string | undefined): Promise<T> {
    const document_ = (await this.mongooseModel
      .findById<T>(id)
      .lean({ transform: MongooseModelCreator.transformObject })
      .exec()
      .catch((error) => {
        throw this.handleError(
          new BlError(`error when trying to find document with id "${id}"`),
          error,
        );
      })) as T;

    if (!document_) {
      throw new BlError(`object "${id}" not found`).code(702);
    }
    return document_;
  }

  public async getOrNull(id: string | undefined): Promise<T | null> {
    try {
      return await this.get(id);
    } catch {
      return null;
    }
  }

  public async getByQuery(
    databaseQuery: SEDbQuery,
    allowedNestedDocuments?: NestedDocument[],
  ): Promise<T[]> {
    logger.trace(
      `${this.path}.find(${JSON.stringify(databaseQuery.getFilter())}, ${JSON.stringify(
        databaseQuery.getOgFilter(),
      )}).limit(${databaseQuery.getLimitFilter()}).skip(${databaseQuery.getSkipFilter()}).sort(${JSON.stringify(
        databaseQuery.getSortFilter(),
      )})`,
    );
    const docs = (await this.mongooseModel
      .find(databaseQuery.getFilter(), databaseQuery.getOgFilter())
      .limit(databaseQuery.getLimitFilter())
      .skip(databaseQuery.getSkipFilter())
      .sort(databaseQuery.getSortFilter())
      .lean({ transform: MongooseModelCreator.transformObject })
      .exec()
      .catch((error) => {
        throw this.handleError(new BlError(`could not find document by the provided query`), error);
      })) as T[];

    if (docs.length <= 0) {
      throw new BlError("not found").code(702);
    }

    const expandFilters = databaseQuery.getExpandFilter();
    return allowedNestedDocuments && allowedNestedDocuments.length > 0
      ? await this.retrieveNestedDocuments(docs, allowedNestedDocuments, expandFilters)
      : docs;
  }

  public async getByQueryOrNull(
    databaseQuery: SEDbQuery,
    allowedNestedDocuments?: NestedDocument[],
  ) {
    try {
      return await this.getByQuery(databaseQuery, allowedNestedDocuments);
    } catch {
      return null;
    }
  }

  public async getMany(ids: string[], userPermission?: UserPermission) {
    try {
      const idArray = ids.map((id) => new Types.ObjectId(id));
      // if user have admin privileges, he can also get documents that are inactive
      const filter =
        userPermission && PermissionService.isAdmin(userPermission)
          ? { _id: { $in: idArray } }
          : { _id: { $in: idArray }, active: true };

      return (await this.mongooseModel
        .find(filter)
        .lean({ transform: MongooseModelCreator.transformObject })
        .exec()) as T[];
    } catch (error) {
      throw this.handleError(new BlError("error when trying to find documents"), error);
    }
  }

  public async aggregate(aggregation: PipelineStage[]): Promise<unknown[]> {
    const docs = await this.mongooseModel
      .aggregate(aggregation)
      .exec()
      .catch((error) => {
        throw this.handleError(new BlError("failed to aggregate documents"), error);
      });

    if (!docs) {
      throw new BlError(`aggregation returned null`);
    }
    MongooseModelCreator.transformObject({}, docs);
    return docs;
  }

  public async getAll(userPermission?: UserPermission) {
    const filter =
      userPermission && PermissionService.isAdmin(userPermission) ? {} : { active: true };
    const document_ = (await this.mongooseModel
      .find(filter)
      .lean({ transform: MongooseModelCreator.transformObject })
      .exec()
      .catch((error) => {
        throw this.handleError(new BlError("failed to get all documents"), error);
      })) as T[];

    if (!document_) {
      throw new BlError(`getAll returned null`);
    }
    return document_;
  }

  public async add(
    document_: Omit<T, "id">,
    user?: { id: string; permission: UserPermission },
  ): Promise<T> {
    try {
      if (user) {
        document_.user = user;
      }

      const newDocument = new this.mongooseModel(document_);
      return (await newDocument.save()).toObject();
    } catch (error) {
      logger.error(error);
      throw this.handleError(
        new BlError("error when trying to add document").data(document_),
        error,
      );
    }
  }

  public async addMany(docs: T[]) {
    const insertedDocs = await this.mongooseModel.insertMany(docs);
    return insertedDocs.map((document_) => document_.toObject());
  }

  public async update(id: string, data: UpdateQuery<T>) {
    const newData = { ...data, lastUpdated: new Date() };
    // Don't update the user of a document after creation
    delete newData["user"];

    const document_ = (await this.mongooseModel
      .findOneAndUpdate({ _id: id }, newData, { new: true })
      .lean({ transform: MongooseModelCreator.transformObject })
      .exec()
      .catch((error) => {
        logger.error(`failed to update document: ${error}`);
        throw this.handleError(
          new BlError(`failed to update document with id ${id}`).store("data", newData),
          error,
        );
      })) as T;

    if (!document_) {
      throw new BlError(`could not find document with id "${id}"`).code(702);
    }

    return document_;
  }

  public async updateMany(
    filter: QueryFilter<T> | Record<string, unknown>,
    update: UpdateWithAggregationPipeline | UpdateQuery<T>,
    options?: MongooseUpdateQueryOptions,
  ): Promise<UpdateWriteOpResult> {
    return this.mongooseModel.updateMany(filter as QueryFilter<T>, update, options);
  }

  public async put(id: string, data: T): Promise<void> {
    await this.mongooseModel
      .replaceOne({ _id: id }, data, {
        upsert: true,
      })
      .catch((error) => {
        throw this.handleError(
          new BlError("failed to PUT document").store("data", {
            data,
            _id: id,
          }),
          error,
        );
      });
  }

  public async remove(id: string) {
    const document_ = (await this.mongooseModel
      .findByIdAndDelete<T>(id)
      .lean({ transform: MongooseModelCreator.transformObject })
      .exec()
      .catch((error) => {
        throw this.handleError(new BlError(`could not remove document with id "${id}"`), error);
      })) as T;

    if (!document_) {
      throw new BlError(`could not remove document with id "${id}"`).code(702);
    }
    return document_;
  }

  public async exists(id: string) {
    try {
      await this.get(id);
      return true;
    } catch {
      throw new BlError(`document with id ${id} does not exist`).code(702);
    }
  }
  public async search(searchStr: string, excludedPaths: string[] = []): Promise<T[]> {
    const normalized = searchStr.trim();

    if (!normalized) {
      return [];
    }

    const excluded = new Set(["_id", "__v", ...excludedPaths]);
    const searchPaths: string[] = [];

    this.mongooseModel.schema.eachPath((path: string, schemaType: SchemaType) => {
      if (!excluded.has(path) && schemaType.instance === "String") {
        searchPaths.push(path);
      }
    });

    if (searchPaths.length === 0) {
      throw new BlError("no searchable fields found").code(701);
    }

    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    return (await this.mongooseModel
      .find({
        $or: searchPaths.map((path) => ({ [path]: regex })),
      })
      .lean({ transform: MongooseModelCreator.transformObject })
      .exec()) as T[];
  }
  /**
   * Tries to fetch all nested values on the specified documents.
   * @param {BlDocument[]} docs the documents to search through
   * @param allowedNestedDocuments
   * @param {ExpandFilter} expandFilters the nested documents to fetch
   */

  private async retrieveNestedDocuments(
    docs: T[],
    allowedNestedDocuments: NestedDocument[],
    expandFilters: ExpandFilter[],
  ) {
    if (!expandFilters || expandFilters.length <= 0) {
      return docs;
    }
    const expandedNestedDocuments = allowedNestedDocuments.filter((nestedDocument) =>
      expandFilters.some((expandFilter) => expandFilter.fieldName === nestedDocument.field),
    );

    try {
      return await Promise.all(
        docs.map((document_) => this.getNestedDocuments(document_, expandedNestedDocuments)),
      );
    } catch (error) {
      throw (
        new BlError("could not retrieve nested documents")
          .code(702)

          // @ts-expect-error fixme: auto ignored
          .add(error)
      );
    }
  }

  private async getNestedDocuments(document_: T, nestedDocuments: NestedDocument[]) {
    const nestedDocumentsPromArray = nestedDocuments.flatMap((nestedDocument) =>
      // @ts-expect-error fixme: auto ignored
      document_ && document_[nestedDocument.field]
        ? [
            this.getNestedDocument(
              // @ts-expect-error fixme: auto ignored
              document_[nestedDocument.field],
              nestedDocument,
            ),
          ]
        : [],
    );

    try {
      const nestedDocs = await Promise.all(nestedDocumentsPromArray);

      for (const [index, nestedDocument] of nestedDocuments.entries()) {
        // @ts-expect-error fixme: auto ignored
        document_[nestedDocument.field] = nestedDocs[index];
      }

      return document_;
    } catch {
      return document_;
    }
  }

  private getNestedDocument(id: string, nestedDocument: NestedDocument) {
    return nestedDocument.storage.get(id);
  }

  private handleError(blError: BlError, error: unknown): BlError {
    if (error && error instanceof Error) {
      if (error.name === "CastError") {
        return blError.code(702).store("castError", error);
      } else if (error.name === "ValidationError") {
        return blError.code(701).store("validationError", error);
      } else {
        return blError.code(200);
      }
    } else {
      return new BlError("EndpointMongoDb: unknown error").add(blError).code(200);
    }
  }
}
