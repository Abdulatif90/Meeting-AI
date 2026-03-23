import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

import { DEFAULT_PAGE } from "@/constants";

export const filtersSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(DEFAULT_PAGE).withOptions({ clearOnDefault: true }),
};

const filtersSearchParamsLoader = createLoader(filtersSearchParams);

export const loadSearchParams = async (
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
) => {
  return filtersSearchParamsLoader(await searchParams);
};