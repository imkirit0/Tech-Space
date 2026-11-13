import { expect, test } from "vitest";
import { pageHref, pageParam, pageWindow, paginate } from "./paging";

test("pageParam falls back to page 1 for junk", () => {
  expect(pageParam({ page: "3" })).toBe(3);
  expect(pageParam({ page: "0" })).toBe(1);
  expect(pageParam({ page: "abc" })).toBe(1);
  expect(pageParam({ page: ["2", "3"] })).toBe(1);
  expect(pageParam({ regPage: "4" }, "regPage")).toBe(4);
});

test("pageWindow clamps past-the-end pages to the last one", () => {
  expect(pageWindow(393, 99, 25)).toMatchObject({ page: 16, pageCount: 16, skip: 375 });
  expect(pageWindow(0, 5, 25)).toMatchObject({ page: 1, pageCount: 1, skip: 0 });
});

test("paginate slices the right rows", () => {
  const items = Array.from({ length: 60 }, (_, i) => i);
  const p = paginate(items, 3, 25);
  expect(p.items).toEqual([50, 51, 52, 53, 54, 55, 56, 57, 58, 59]);
  expect(p.pageCount).toBe(3);
});

test("pageHref keeps other filters, drops page 1, and handles repeated params", () => {
  const params = { status: "PENDING", exam: ["A", "B"], page: "4", empty: undefined };
  expect(pageHref("/manager", params, 2, { hash: "activities" })).toBe("/manager?status=PENDING&exam=A&exam=B&page=2#activities");
  expect(pageHref("/manager", params, 1)).toBe("/manager?status=PENDING&exam=A&exam=B");
  expect(pageHref("/x", { page: "2", regPage: "3" }, 5, { key: "regPage" })).toBe("/x?page=2&regPage=5");
});
