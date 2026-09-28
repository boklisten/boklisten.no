import { HttpContext } from "@adonisjs/core/http";
import { BaseSerializer } from "@adonisjs/core/transformers";
import type { SimplePaginatorMetaKeys } from "@adonisjs/lucid/types/querybuilder";

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
function serialize(
  this: HttpContext,
  ...[data, resolver]: Parameters<ApiSerializer["serializeWithoutWrapping"]>
) {
  return serializer.serializeWithoutWrapping(data, resolver ?? this.containerResolver);
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- serializeWithoutWrapping is overloaded; a single implementation can only be matched to the overloads by assertion
HttpContext.instanceProperty("serialize", serialize as HttpContext["serialize"]);

declare module "@adonisjs/core/http" {
  export interface HttpContext {
    serialize: ApiSerializer["serializeWithoutWrapping"];
  }
}
