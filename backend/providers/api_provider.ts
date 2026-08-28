import { HttpContext } from "@adonisjs/core/http";
import { BaseSerializer } from "@adonisjs/core/transformers";
import { type SimplePaginatorMetaKeys } from "@adonisjs/lucid/types/querybuilder";

class ApiSerializer extends BaseSerializer<{
  Wrap: "data";
  PaginationMetaData: SimplePaginatorMetaKeys;
}> {
  wrap = "data" as const;

  definePaginationMetaData(metaData: unknown): SimplePaginatorMetaKeys {
    if (!this.isLucidPaginatorMetaData(metaData)) {
      throw new Error(
        "Invalid pagination metadata. Expected metadata to contain Lucid pagination keys",
      );
    }
    return metaData;
  }
}

const serializer = new ApiSerializer();
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- framework macro glue: Object.assign cannot express the merged callable-with-method type
const serialize = Object.assign(function (
  this: HttpContext,
  ...[data, resolver]: Parameters<ApiSerializer["serializeWithoutWrapping"]>
) {
  return serializer.serializeWithoutWrapping(data, resolver ?? this.containerResolver);
}) as ApiSerializer["serializeWithoutWrapping"] & { withWrapping: ApiSerializer["serialize"] };

HttpContext.instanceProperty("serialize", serialize);

declare module "@adonisjs/core/http" {
  export interface HttpContext {
    serialize: ApiSerializer["serializeWithoutWrapping"] & {
      withWrapping: ApiSerializer["serialize"];
    };
  }
}
