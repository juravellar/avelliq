// "1" or a junk value is the first page.
export const pageNumber = (value: string | undefined) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
};

// At least one page, so an empty list is still "page 1 of 1".
export const pageCount = (total: number, pageSize: number) =>
  Math.max(1, Math.ceil(total / pageSize));
