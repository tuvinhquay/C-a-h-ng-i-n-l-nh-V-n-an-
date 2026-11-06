# Cẩm nang phát triển — Cửa hàng điện lạnh Vân An

Tài liệu này ghi lại cấu trúc, luồng hoạt động, nghiệp vụ và cách tiếp tục phát
triển ứng dụng tại thời điểm tạo cẩm nang. Đây là hướng dẫn đọc mã nguồn hiện
tại, không thay thế đặc tả nghiệp vụ hay bản sao lưu dữ liệu cửa hàng.

## 1. Tổng quan dự án

Ứng dụng quản lý hoạt động cửa hàng điện lạnh: danh mục và tồn kho linh kiện,
nhập/xuất kho, khách hàng, phiếu sửa chữa, báo giá, hóa đơn, cài đặt cửa hàng và
sao lưu dữ liệu.

| Hạng mục              | Hiện trạng                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Frontend              | React 19 + TypeScript                                                                    |
| Routing               | TanStack Start / TanStack Router, cấu hình file-based                                    |
| Giao diện             | Tailwind CSS v4, CSS-first; biểu tượng từ `lucide-react`                                 |
| Dữ liệu nghiệp vụ     | IndexedDB trong trình duyệt, cơ sở dữ liệu `so-dien-lanh`                                |
| Ngoại tuyến           | Có đăng ký service worker ở môi trường production; dữ liệu giữ trên trình duyệt/thiết bị |
| Tài liệu              | In qua trình duyệt, tải PDF bằng `pdf-lib` + `@pdf-lib/fontkit`, tải PNG bằng canvas     |
| Ngôn ngữ giao diện    | Tiếng Việt                                                                               |
| Đồng bộ giữa thiết bị | Chưa có cho dữ liệu nghiệp vụ; cần sao lưu/khôi phục thủ công                            |

Kho mã ban đầu có một commit `first commit`. Vì vậy lịch sử Git hiện không mô
tả đầy đủ từng giai đoạn phát triển; cẩm nang này tổng hợp theo trạng thái mã
nguồn đang có.

## 2. Cấu trúc thư mục

```text
.
├── src/
│   ├── assets/fonts/       # Font chữ được đóng gói cùng ứng dụng và tài liệu
│   ├── components/        # Shell, thành phần dùng chung và các màn hình
│   │   └── screens/       # Màn hình nghiệp vụ theo từng nhóm
│   ├── lib/                # Kiểu dữ liệu, nghiệp vụ, lưu trữ, xuất/in, tiện ích
│   │   ├── app-data/      # Bộ tích hợp connector có sẵn từ nền tảng
│   │   ├── auth/          # Bộ khung xác thực có sẵn từ nền tảng
│   │   └── multiplayer/   # Mã hỗ trợ P2P có sẵn từ nền tảng
│   ├── routes/             # Route TanStack Start
│   ├── router.tsx          # Khởi tạo router
│   └── styles.css          # Theme và CSS nền tảng
├── migrations/auth/        # Migration Better Auth được cung cấp sẵn
├── public/__grok/          # Tài nguyên giao diện/cài đặt do nền tảng quản lý
├── scripts/                # Build helper, PWA, preview, kiểm tra và test
├── server/middleware/      # Middleware phía server của nền tảng
├── startup.sh              # Lệnh khởi động lại ứng dụng
├── vite.config.ts          # Cấu hình Vite/TanStack/Nitro/PWA
└── package.json            # Dependencies và scripts
```

Không xóa hoặc ghi đè `public/__grok/`, `server/`, `scripts/grok-pwa-*` hay
những helper nền tảng trong `src/lib/auth`, `src/lib/app-data` nếu không chủ
đích sửa tích hợp tương ứng.

## 3. Khởi tạo và luồng giao diện

1. `src/router.tsx` tạo router và cấu hình rewrite đường dẫn preview.
2. `src/routes/__root.tsx` dựng HTML document, nạp CSS, giữ
   `AuthProvider` và `PreviewHostBridge`.
3. `src/routes/index.tsx` ánh xạ `/` sang `AppShell`.
4. `src/components/shell.tsx` dựng thanh điều hướng, tiêu đề, dock di động,
   vùng hiển thị màn hình, trạng thái mạng, cài ứng dụng và luồng xuất/in.
5. `ShopProvider` trong `src/lib/store.tsx` nạp snapshot từ IndexedDB, cung cấp
   API thao tác dữ liệu qua `useShop()`.
6. `ScreenView` trong `src/components/shell.tsx` chọn màn hình tương ứng với
   kiểu `Screen` trong `src/lib/nav.ts`.

Điều hướng hiện dùng stack ở component shell: `go()` mở màn hình con,
`back()` quay lại, `show()` thay màn hình gốc và `tab()` chuyển tab chính.
Thêm màn hình mới cần cập nhật kiểu `Screen`, tiêu đề, ánh xạ `ScreenView` và
các điểm điều hướng liên quan.

## 4. Màn hình và nghiệp vụ đã có trong mã nguồn

| Khu vực       | File chính                             | Chức năng                                                                                                       |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tổng quan     | `src/components/screens/home.tsx`      | Thống kê phiếu đang sửa, hàng tồn thấp, bảo hành sắp hết, doanh thu/lãi ước tính; thao tác nhanh; phiếu gần đây |
| Kho linh kiện | `src/components/screens/parts.tsx`     | Tìm/lọc linh kiện, cảnh báo tồn thấp, thêm/sửa, nhập/xuất/kiểm kê, lịch sử biến động                            |
| Sửa chữa      | `src/components/screens/repairs.tsx`   | Danh sách/lọc phiếu, tạo và sửa phiếu, quản lý trạng thái, linh kiện/công thợ, bảo hành, hoàn tất/hủy           |
| Khách hàng    | `src/components/screens/customers.tsx` | Danh sách, tìm kiếm, hồ sơ, lịch sử phiếu sửa, tạo phiếu cho khách                                              |
| Báo giá       | `src/components/screens/quotes.tsx`    | Tạo/sửa báo giá, chọn khách, danh sách hạng mục/trạng thái và xuất tài liệu                                     |
| Hóa đơn       | `src/components/screens/invoices.tsx`  | Danh sách/lọc hóa đơn, bán linh kiện, lập hóa đơn sửa chữa, xem/in/hủy                                          |
| Sao lưu       | `src/components/screens/backup.tsx`    | Tải file JSON, xác nhận và khôi phục toàn bộ dữ liệu từ file                                                    |
| Cài đặt       | `src/components/screens/settings.tsx`  | Tên cửa hàng, người lập, liên hệ, mã số thuế, lời cuối hóa đơn và cài ứng dụng                                  |

`src/components/line-editor.tsx` dùng để nhập danh sách linh kiện, công thợ,
phụ phí. `src/components/paper-view.tsx` dựng bản HTML dùng chung cho bản xem
trước/in.

## 5. Dữ liệu và quy tắc nghiệp vụ

### Lưu trữ

- `src/lib/db.ts` là lớp dữ liệu nghiệp vụ trên IndexedDB; tên database là
  `so-dien-lanh`.
- Các object store dữ liệu: `parts`, `moves`, `customers`, `repairs`, `quotes`,
  `invoices`; `meta` lưu cài đặt cửa hàng.
- Không có database dùng chung cho dữ liệu kho/phiếu/hóa đơn trong trạng thái
  hiện tại. Dữ liệu ở mỗi trình duyệt/thiết bị riêng; xóa dữ liệu trình duyệt có
  thể làm mất dữ liệu nếu chưa sao lưu.
- Các thay đổi tồn kho được thực hiện trong transaction; thao tác xuất không đủ
  tồn sẽ báo lỗi thay vì để lại một phần thay đổi.

### Kiểu dữ liệu

`src/lib/types.ts` định nghĩa `Part`, `StockMove`, `Customer`, `LineItem`,
`Repair`, `Quote`, `Invoice`, `Settings`, `Snapshot`, `BackupFile` và các kiểu
input cho thao tác lưu.

- Tiền được lưu dạng số nguyên VND.
- Số lượng hỗ trợ tối đa ba chữ số thập phân.
- `StockMove` ghi lại tên/mã linh kiện tại thời điểm phát sinh.
- Trạng thái phiếu sửa: `open`, `done`, `cancelled`.
- Trạng thái hóa đơn: `issued`, `void`; loại hóa đơn: `sale`, `repair`.
- Bảo hành gắn với phiếu sửa đã hoàn tất và mốc ngày bảo hành.

### Tách lớp

- `src/lib/domain.ts`: quy tắc thuần như tồn thấp, trạng thái bảo hành, lọc phiếu,
  phiếu sắp hết hạn, doanh thu và lãi gộp ước tính.
- `src/lib/format.ts`: mã phiếu, định dạng tiền/ngày/số lượng, tìm kiếm không dấu,
  tính tổng dòng và đọc số tiền thành chữ.
- `src/lib/store.tsx`: nạp snapshot, gọi lớp dữ liệu và cập nhật trạng thái React.
- `src/lib/backup.ts`: đóng gói/kiểm tra dữ liệu backup và tải file.

Khi thêm một nghiệp vụ có ảnh hưởng tồn, hãy giữ thao tác ghi tồn và lịch sử
trong cùng transaction; bổ sung kiểu dữ liệu, quy tắc trong `db.ts` và cập nhật
store/screen tương ứng.

## 6. Giao diện hiện tại

- Theme tối với nền `#0b0f19`; cyan `#22d3ee` và cam `#f97316` là hai màu nhấn.
- Token màu, typography và CSS dùng chung nằm trong `src/styles.css`.
- Các thẻ kính dùng class `.glass` / `.glass-orange`; dock di động dạng nổi, có
  khoảng đệm safe-area.
- `src/components/ui.tsx` có `Button`, `Field`, `Badge`, `Modal`, `EmptyState`
  và `fieldClass`.
- Desktop dùng sidebar; màn nhỏ dùng dock chính và menu “Thêm”.
- Màn Tổng quan bố trí Bento/Grid và đọc số liệu từ snapshot hiện tại.
- Tài liệu in giữ palette giấy sáng riêng để đảm bảo dễ đọc khi in.

Các thay đổi giao diện hiện có trong working tree tại lúc ghi tài liệu gồm:
`src/styles.css`, `src/components/shell.tsx`,
`src/components/screens/home.tsx`, `src/components/ui.tsx` và
`src/lib/paper.ts`. Đây là trạng thái làm việc, không đồng nghĩa mọi thay đổi
đã được commit.

## 7. Offline, cài đặt, in và xuất file

- Dữ liệu nghiệp vụ lưu tại IndexedDB nên các thao tác dữ liệu không cần máy chủ
  sau khi ứng dụng và tài nguyên đã được tải.
- `src/components/shell.tsx` lắng nghe `online`/`offline`, đăng ký
  `sw.js` trong production, nhận lời mời cài ứng dụng và báo lỗi đăng ký service
  worker.
- Cấu hình PWA và tài nguyên nền tảng liên quan nằm ở `vite.config.ts`,
  `scripts/grok-pwa-plugin.mjs`, `server/middleware/grok-pwa.ts` và
  `public/__grok/`.
- `src/lib/paper.ts` dựng `PaperDoc`, làm ấm font, xuất PDF có font Noto Sans và
  xuất PNG. Font PDF: `src/assets/fonts/NotoSans-Regular.ttf` và
  `src/assets/fonts/NotoSans-Bold.ttf`.
- Khi xem giấy trong shell, có thể in bằng trình duyệt (`window.print()`), tải
  PDF hoặc tải ảnh. Không nên thay cơ chế dựng giấy chỉ bằng screenshot của DOM:
  giữ `PaperView` để đầu ra nhất quán.
- Backup là JSON và khôi phục sẽ thay toàn bộ dữ liệu trên máy; cần giữ bước xác
  nhận rõ ràng.

## 8. Xác thực và tích hợp nền tảng

- `src/lib/auth/` là bộ khung tích hợp Better Auth/gate; `migrations/auth/0001_auth.sql`
  là schema xác thực, không phải schema kho hàng.
- `src/lib/app-data/` chứa tiện ích gọi connector và phân loại trạng thái/lỗi.
- Không nhầm sự hiện diện của các helper trên với việc dữ liệu kho đã được lưu
  trên server hoặc tự đồng bộ giữa người dùng/thiết bị.
- Nếu sau này bật auth hoặc chuyển dữ liệu nghiệp vụ lên server, cần thiết kế
  quyền sở hữu dữ liệu và phạm vi truy vấn server-side; không nhận `userId` tin
  cậy từ client. Làm theo hướng dẫn tương ứng trong `.grok/skills/auth`,
  `.grok/skills/neon` và `.grok/references/data-and-auth.md` nếu có.

## 9. Lệnh phát triển và kiểm tra

Các lệnh được khai báo trong `package.json`:

```bash
npm run dev          # chạy ứng dụng phát triển
npm run typecheck    # TypeScript không phát sinh output
npm run lint         # ESLint toàn dự án
npm test             # test scripts và test TypeScript
npm run build        # build production và chạy db:migrate
npm run check:auth   # kiểm tra invariant xác thực
```

`npm run dev` dùng `scripts/with-app-env.mjs`; không khởi động Vite trực tiếp.
`startup.sh` là entrypoint khởi động lại và cần được giữ đồng bộ với cách chạy
ứng dụng. Khi đổi dependency/build config, chạy build và kiểm tra production
preview. Tài liệu hướng dẫn QA: `.grok/references/browser-qa.md`.

## 10. Các lỗi/việc cần kiểm tra tiếp

Kết quả quan sát trong phiên lập cẩm nang:

1. `npm run build` đã hoàn thành thành công; đầu ra production được tạo. Build có
   cảnh báo chunk JavaScript lớn hơn 500 kB.
2. `npm run typecheck` hiện thất bại tại `src/lib/auth/server.ts`: file import
   `ensureDbReady` và `getPglite` từ `src/lib/db.ts`, nhưng hai export này không
   tồn tại trong file đó. Cần xác định đây là phần wiring auth/PGLite cần khôi
   phục hay mã thừa; không thêm export giả chỉ để làm qua typecheck.
3. `npm test` có một nhóm test về PWA/branding thất bại trong lần chạy đã ghi
   nhận. Cần chạy lại và xem từng failure trước khi kết luận, vì test suite bao
   gồm các contract plugin/tài nguyên nền tảng.
4. Lint các file UI/PDF đã sửa không có error; `src/components/ui.tsx` còn cảnh
   báo Fast Refresh do export helper cùng file component.
5. Chưa xác nhận bằng browser smoke trong phiên này: script QA yêu cầu ghi ảnh
   dưới `/workspace/screenshots/`, trong khi checkout hiện ở đường dẫn
   `/workspaces/...`. Không coi HTTP 200 hoặc build thành công là thay thế cho
   kiểm tra hình ảnh trên desktop/mobile.

Sau khi xử lý, nên chạy lại `npm run typecheck`, `npm test`, `npm run lint`,
`npm run build`, rồi dùng browser smoke trên cả desktop và mobile; nếu build mới
thành công thì kiểm tra thêm bản production preview.

## 11. Quy ước khi tiếp tục phát triển

1. Đọc `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/store.tsx` và screen tương
   ứng trước khi đổi nghiệp vụ.
2. Giữ IndexedDB là nguồn dữ liệu hiện tại, hoặc lập kế hoạch migration/sync rõ
   ràng trước khi thay storage.
3. Cập nhật test cho quy tắc nghiệp vụ thuần trong `src/lib/domain.ts` hoặc các
   script test tương ứng khi thêm hành vi mới.
4. Giữ giao diện responsive và hit target phù hợp trên điện thoại; trạng thái
   rỗng, lỗi, loading và lỗi lưu cần có phản hồi.
5. Với giấy tờ, kiểm tra cả xem trước, in, PDF, PNG và font tiếng Việt.
6. Không sửa/xóa tài nguyên PWA, branding, bridge preview hoặc middleware nền
   tảng nếu không có yêu cầu cụ thể.
7. Trước khi commit, kiểm tra `git status` và stage đúng các file thuộc công
   việc; không đưa dữ liệu thật của cửa hàng hay file backup vào Git.

## 12. Bản đồ file tra cứu nhanh

| Muốn làm gì                                  | Bắt đầu tại                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Đổi route hoặc thiết lập router              | `src/router.tsx`, `src/routes/`                                                                    |
| Đổi shell, điều hướng, dock, trạng thái mạng | `src/components/shell.tsx`, `src/lib/nav.ts`                                                       |
| Đổi token và giao diện nền                   | `src/styles.css`, `src/components/ui.tsx`                                                          |
| Thêm trường dữ liệu                          | `src/lib/types.ts` → `src/lib/db.ts` → `src/lib/store.tsx` → screen                                |
| Sửa tính tồn kho, phiếu, hóa đơn             | `src/lib/db.ts`                                                                                    |
| Sửa bảo hành, lọc và lãi ước tính            | `src/lib/domain.ts`                                                                                |
| Sửa tiền, ngày, tìm kiếm                     | `src/lib/format.ts`                                                                                |
| Sửa giấy in/PDF/PNG                          | `src/lib/paper.ts`, `src/components/paper-view.tsx`                                                |
| Sửa sao lưu/khôi phục                        | `src/lib/backup.ts`, `src/components/screens/backup.tsx`                                           |
| Sửa offline/PWA/branding                     | `vite.config.ts`, `scripts/grok-pwa-plugin.mjs`, `server/middleware/grok-pwa.ts`, `public/__grok/` |
| Sửa script build/kiểm tra                    | `package.json`, `scripts/`                                                                         |
