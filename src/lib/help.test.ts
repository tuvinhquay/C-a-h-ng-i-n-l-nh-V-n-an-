import assert from "node:assert/strict";
import test from "node:test";
import { findGuideTopic, isHelpRequest } from "./help.ts";

test("recognizes Vietnamese help requests", () => {
  assert.equal(isHelpRequest("Hướng dẫn tôi cách nhập kho"), true);
  assert.equal(isHelpRequest("Làm sao tạo phiếu sửa?"), true);
  assert.equal(isHelpRequest("Cách khôi phục dữ liệu"), true);
  assert.equal(isHelpRequest("LG M31UII còn bao nhiêu cái?"), false);
});

test("matches specific help questions to accurate guide topics", () => {
  assert.equal(findGuideTopic("Cách nhập kho")?.id, "stock-moves");
  assert.equal(findGuideTopic("Hướng dẫn thêm linh kiện")?.id, "add-part");
  assert.equal(findGuideTopic("Cách lập hóa đơn")?.id, "sales");
  assert.equal(findGuideTopic("Làm sao lập hóa đơn sửa chữa?")?.id, "repair-invoice");
  assert.equal(findGuideTopic("Cách tạo workspace và mã mời")?.id, "workspace");
  assert.equal(findGuideTopic("Hướng dẫn sử dụng"), null);
});
