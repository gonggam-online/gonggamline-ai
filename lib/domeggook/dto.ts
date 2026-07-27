export type DomeggookItemListProviderDto = {
  no: unknown;
  title?: unknown;
  thumb?: unknown;
  price?: unknown;
  unitQty?: unknown;
  id?: unknown;
  sellerId?: unknown;
  nick?: unknown;
  url?: unknown;
  link?: unknown;
  market?: {
    domeggook?: unknown;
    supply?: unknown;
  };
  shipping?: {
    fee?: unknown;
  };
  stock?: unknown;
};

export type DomeggookItemDetailProviderDto = {
  basis: {
    no: unknown;
    title?: unknown;
    status?: unknown;
  };
  price?: {
    dome?: unknown;
    supply?: unknown;
    qty?: unknown;
  };
  seller?: {
    id?: unknown;
    name?: unknown;
  };
  thumb?: {
    small?: unknown;
    big?: unknown;
  };
  shipping?: {
    fee?: unknown;
  };
  link?: unknown;
  market?: {
    domeggook?: unknown;
    supply?: unknown;
  };
};

export type DomeggookProviderErrorDto = {
  code: string | null;
  message: string | null;
};

export type DomeggookSearchEnvelope = {
  items: DomeggookItemListProviderDto[];
  totalItems: unknown;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function parseMarket(value: unknown) {
  const record = asRecord(value);
  if (!record) return undefined;
  return { domeggook: record.domeggook, supply: record.supply };
}

function parseShipping(value: unknown) {
  const record = asRecord(value);
  if (!record) return undefined;
  return { fee: record.fee };
}

export function parseDomeggookItemListProviderDto(
  value: unknown
): DomeggookItemListProviderDto | null {
  const record = asRecord(value);
  if (!record || record.no === undefined || record.no === null) return null;

  return {
    no: record.no,
    title: record.title,
    thumb: record.thumb,
    price: record.price,
    unitQty: record.unitQty,
    id: record.id,
    sellerId: record.sellerId,
    nick: record.nick,
    url: record.url,
    link: record.link,
    market: parseMarket(record.market),
    shipping: parseShipping(record.shipping),
    stock: record.stock,
  };
}

export function parseDomeggookItemDetailProviderDto(
  value: unknown
): DomeggookItemDetailProviderDto | null {
  const record = asRecord(value);
  const basis = asRecord(record?.basis);
  if (!record || !basis || basis.no === undefined || basis.no === null) {
    return null;
  }

  const price = asRecord(record.price);
  const seller = asRecord(record.seller);
  const thumb = asRecord(record.thumb);

  return {
    basis: {
      no: basis.no,
      title: basis.title,
      status: basis.status,
    },
    price: price
      ? { dome: price.dome, supply: price.supply, qty: price.qty }
      : undefined,
    seller: seller ? { id: seller.id, name: seller.name } : undefined,
    thumb: thumb ? { small: thumb.small, big: thumb.big } : undefined,
    shipping: parseShipping(record.shipping),
    link: record.link,
    market: parseMarket(record.market),
  };
}

export function parseDomeggookSearchEnvelope(
  value: unknown
): DomeggookSearchEnvelope | null {
  const root = asRecord(value);
  const domeggook = asRecord(root?.domeggook);
  const list = asRecord(domeggook?.list);
  const header = asRecord(domeggook?.header);
  if (!root || !domeggook || !list) return null;

  const rawItems = list.item;
  const values =
    rawItems === undefined || rawItems === null
      ? []
      : Array.isArray(rawItems)
        ? rawItems
        : [rawItems];
  const items = values.map(parseDomeggookItemListProviderDto);
  if (items.some((item) => item === null)) return null;

  return {
    items: items.filter(
      (item): item is DomeggookItemListProviderDto => item !== null
    ),
    totalItems: header?.numberOfItems ?? header?.totalCount ?? null,
  };
}

export function parseDomeggookDetailEnvelope(
  value: unknown
): DomeggookItemDetailProviderDto | "not_found" | null {
  const root = asRecord(value);
  const domeggook = asRecord(root?.domeggook);
  if (!root || !domeggook) return null;
  const rawItems = domeggook.item;
  if (rawItems === undefined || rawItems === null) return "not_found";
  const first = Array.isArray(rawItems) ? rawItems[0] : rawItems;
  if (first === undefined) return "not_found";
  return parseDomeggookItemDetailProviderDto(first);
}

export function parseDomeggookProviderError(
  value: unknown
): DomeggookProviderErrorDto | null {
  const root = asRecord(value);
  const domeggook = asRecord(root?.domeggook);
  const error = asRecord(domeggook?.error ?? root?.error);
  if (!error) return null;
  return {
    code:
      typeof error.code === "string" || typeof error.code === "number"
        ? String(error.code)
        : null,
    message: typeof error.message === "string" ? error.message : null,
  };
}
