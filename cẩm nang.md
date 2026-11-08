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
| Đồng bộ giữa thiết bị | Local-first: IndexedDB ghi trước, sau đó đồng bộ snapshot/tombstone lên Postgres         |

Kho mã ban đầu có một commit `first commit`. Vì vậy lịch sử Git hiện không mô
tả đầy đủ từng giai đoạn phát triển; cẩm nang này tổng hợp theo trạng thái mã
nguồn đang có.

## 2. Cấu trúc thư mục

```text
.
├── src/
│   ├── assets/fonts/       # Font chữ được đóng gói cùng ứng dụng và tài liệu
│   ├── components/         # Shell, bot, đồng bộ và màn hình nghiệp vụ
│   │   └── screens/        # Màn hình nghiệp vụ theo từng nhóm
│   ├── lib/                # Kiểu dữ liệu, nghiệp vụ, lưu trữ, xuất/in, tiện ích
│   │   ├── app-data/       # Bộ tích hợp connector có sẵn từ nền tảng
│   │   ├── auth/           # Bộ khung xác thực có sẵn từ nền tảng
│   │   ├── local-db.ts     # IndexedDB và nghiệp vụ cục bộ
│   │   ├── sync.ts         # Gộp dữ liệu/tombstone, phát hiện xung đột
│   │   ├── workspace.ts    # Server functions cho hệ thống dùng chung
│   │   └── workspace.server.ts # Truy vấn Postgres/PGLite, mã mời, đồng bộ
│   ├── routes/             # Route TanStack Start
│   ├── router.tsx          # Khởi tạo router
│   └── styles.css          # Theme và CSS nền tảng
├── migrations/             # Schema auth, workspace, phục hồi cũ và mã chủ
│   └── auth/               # Bản schema Better Auth gốc, không chỉnh sửa
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
5. `ShopProvider` trong `src/lib/store.tsx` nạp snapshot/tombstone từ IndexedDB, cung cấp
   API thao tác dữ liệu qua `useShop()`.
6. `ScreenView` trong `src/components/shell.tsx` chọn màn hình tương ứng với
   kiểu `Screen` trong `src/lib/nav.ts`.
7. `src/components/assistant-bot.tsx` là trợ lý tra tồn offline; nhận diện ý
   định và phân tích câu dạy nằm trong `src/lib/assistant.ts`. Sản phẩm được tạo
   qua cùng API nghiệp vụ `shop.savePart()`.
8. `src/components/workspace-sync.tsx` đồng bộ định kỳ; màn
   `src/components/screens/workspace.tsx` quản lý workspace, mã mời và thiết bị.

Điều hướng hiện dùng stack ở component shell: `go()` mở màn hình con,
`back()` quay lại, `show()` thay màn hình gốc và `tab()` chuyển tab chính.
Thêm màn hình mới cần cập nhật kiểu `Screen`, tiêu đề, ánh xạ `ScreenView` và
các điểm điều hướng liên quan.

## 4. Màn hình và nghiệp vụ đã có trong mã nguồn

| Khu vực       | File chính                             | Chức năng                                                                                                       |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tổng quan     | `src/components/screens/home.tsx`      | Thống kê vận hành, thao tác nhanh, phiếu gần đây và ghi nhận nhà phát triển Q.89 ở cuối trang                 |
| Kho linh kiện | `src/components/screens/parts.tsx`     | Tìm/lọc linh kiện, cảnh báo tồn thấp, thêm/sửa, nhập/xuất/kiểm kê, lịch sử biến động                            |
| Sửa chữa      | `src/components/screens/repairs.tsx`   | Danh sách/lọc phiếu, tạo và sửa phiếu, quản lý trạng thái, linh kiện/công thợ, bảo hành, hoàn tất/hủy           |
| Khách hàng    | `src/components/screens/customers.tsx` | Danh sách, tìm kiếm, hồ sơ, lịch sử phiếu sửa, tạo phiếu cho khách                                              |
| Báo giá       | `src/components/screens/quotes.tsx`    | Tạo/sửa báo giá, chọn khách, danh sách hạng mục/trạng thái và xuất tài liệu                                     |
| Hóa đơn       | `src/components/screens/invoices.tsx`  | Danh sách/lọc hóa đơn, bán linh kiện, lập hóa đơn sửa chữa, xem/in/hủy                                          |
| Sao lưu       | `src/components/screens/backup.tsx`    | Tải file JSON, xác nhận và khôi phục toàn bộ dữ liệu từ file                                                    |
| Cài đặt       | `src/components/screens/settings.tsx`  | Tên cửa hàng, người lập, liên hệ, mã số thuế, lời cuối hóa đơn và cài ứng dụng                                  |
| Thiết bị      | `src/components/screens/workspace.tsx` | Tạo/tham gia sổ chung, mời/thu hồi, trạng thái thiết bị online/offline                                          |
| Hướng dẫn     | `src/components/screens/guide.tsx`     | Cẩm nang theo từng nghiệp vụ; mở từ menu hoặc nhờ bot hướng dẫn theo câu hỏi                                     |
| Trợ lý        | `src/components/assistant-bot.tsx`     | Tra tồn, vị trí, hàng sắp hết, phiếu sửa; hướng dẫn dùng app, dạy và lưu sản phẩm mới cục bộ                    |

`src/components/line-editor.tsx` dùng để nhập danh sách linh kiện, công thợ,
phụ phí. `src/components/paper-view.tsx` dựng bản HTML dùng chung cho bản xem
trước/in.

## 5. Dữ liệu và quy tắc nghiệp vụ

### Lưu trữ

- `src/lib/local-db.ts` là lớp dữ liệu nghiệp vụ IndexedDB; tên database là
  `so-dien-lanh`. `src/lib/db.ts` chỉ chạy phía server và cung cấp SQL qua
  Postgres thật hoặc PGLite trong preview.
- Các object store dữ liệu: `parts`, `moves`, `customers`, `repairs`, `quotes`,
  `invoices`; `meta` lưu cài đặt, thiết bị và tombstone xóa.
- `migrations/0001_auth.sql` tạo schema Better Auth;
  `migrations/0002_shared_workspaces.sql` tạo hệ thống cửa hàng, thành viên, mã
  mời, thiết bị, snapshot và lịch sử gần nhất; `migrations/0003_password_recovery.sql`
  lưu câu hỏi phục hồi cùng hash/salt và bộ đếm giới hạn thử sai. PGLite preview nằm trong bộ nhớ và sẽ mất khi tiến trình khởi động lại;
  bản triển khai cần Postgres do nền tảng cấp để có lưu trữ bền vững.
- Khi chưa tạo/tham gia workspace, dữ liệu chỉ có trên thiết bị. Khi workspace
  hoạt động, trình duyệt vẫn ghi IndexedDB trước rồi đồng bộ khi online. Thay
  đổi offline chưa kịp tải lên vẫn có thể mất nếu chính thiết bị đó hỏng.
- Các thay đổi tồn kho được thực hiện trong transaction; thao tác xuất không đủ
  tồn sẽ báo lỗi thay vì để lại một phần thay đổi.
- Đồng bộ gộp lịch sử nhập/xuất theo ID, tính lại tồn từ biến động và giữ
  tombstone để truyền thao tác xóa. Nếu nhiều thiết bị cùng xuất vượt tồn hoặc
  tạo mã trùng, trợ lý đồng bộ báo xung đột; người quản trị cần xử lý thủ công.

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
- `src/lib/store.tsx`: nạp snapshot/tombstone, gọi lớp dữ liệu và cập nhật React.
- `src/lib/backup.ts`: đóng gói/kiểm tra dữ liệu backup và tải file.
- `src/lib/sync.ts`: gộp dữ liệu theo ID/cập nhật, áp tombstone, cảnh báo tồn âm
  hoặc mã trùng.

Khi thêm một nghiệp vụ có ảnh hưởng tồn, hãy giữ thao tác ghi tồn và lịch sử
trong cùng transaction; bổ sung kiểu dữ liệu, quy tắc trong `local-db.ts` và
cập nhật store/screen tương ứng.

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
- Video nền toàn ứng dụng được gắn trong `src/routes/__root.tsx` qua
  `src/components/video-background.tsx`. Đặt video MP4 tại
  `public/media/videonen.mp4`; lớp phủ tối, fallback và xử lý giảm chuyển động
  nằm trong `src/styles.css`.
- Logo dùng cho favicon, biểu tượng màn hình chính và manifest tùy chỉnh là
  `public/media/logo-vanan.png` (ảnh vuông PNG độ phân giải cao, nên dùng 512×512).
  Manifest riêng của app ở `public/manifest.webmanifest`; injector nền tảng vẫn
  được giữ nguyên làm lớp PWA dự phòng.
- `src/lib/paper.ts` dựng `PaperDoc`, làm ấm font, xuất PDF có font Noto Sans và
  xuất PNG. Font PDF: `src/assets/fonts/NotoSans-Regular.ttf` và
  `src/assets/fonts/NotoSans-Bold.ttf`.
- Khi xem giấy trong shell, có thể in bằng trình duyệt (`window.print()`), tải
  PDF hoặc tải ảnh. Không nên thay cơ chế dựng giấy chỉ bằng screenshot của DOM:
  giữ `PaperView` để đầu ra nhất quán.
- Backup là JSON và khôi phục sẽ thay toàn bộ dữ liệu trên máy; cần giữ bước xác
  nhận rõ ràng.

## 8. Xác thực và đồng bộ hệ thống

- `src/routes/login.tsx` tự khởi tạo mã chủ ở lần đầu, yêu cầu nhập lại mã
  trước khi kích hoạt, và chỉ giữ một ô nhập mã cho các lần đăng nhập sau.
  `src/lib/auth/access-key-plugin.server.ts` triển khai API khởi tạo, xác nhận,
  đăng nhập và phiên Better Auth; `src/lib/auth/access-key.server.ts` sinh mã
  ngẫu nhiên, hash bằng scrypt và so sánh an toàn.
- `migrations/0004_access_key.sql` lưu hash mã, bản thiết lập tạm có hạn 15
  phút, giới hạn thử đăng nhập và đánh dấu phiên được tạo bằng mã. Mã rõ chỉ
  được gửi cho trình duyệt khi tạo; máy chủ chỉ lưu hash. Email/mật khẩu,
  Google/X và phục hồi cũ đã bị tắt.
- Mã chủ không thể khôi phục nếu bị mất. Năm lần nhập sai trong 15 phút khóa
  thử tiếp 15 phút. Người đầu tiên khởi tạo trở thành chủ; mã dùng chung khiến
  mọi thiết bị cùng một danh tính, không có lịch sử riêng từng thành viên.
- Mọi server function trong `src/lib/workspace.ts` đều dùng `authMiddleware`.
  `src/lib/workspace.server.ts` chỉ dùng `context.userId` đã xác thực để truy
  vấn membership; không nhận user ID từ client làm quyền.
- Workspace ID chỉ là định danh, không phải bí mật hay thông tin đăng nhập.
  Quy trình mã mời/tài khoản thành viên riêng đã ẩn khỏi giao diện do tất cả
  thiết bị hiện dùng chung mã chủ.
- `src/components/workspace-sync.tsx` đồng bộ mỗi 15 giây và khi mạng trở lại.
  Đây không phải LAN-only/P2P; cần máy chủ có kết nối Internet để chuyển dữ liệu
  giữa thiết bị. Khi offline, thao tác tiếp tục trên IndexedDB.
- Thiết bị cùng mã chủ dùng chung danh tính hệ thống; hiện không hỗ trợ cấp
  tài khoản riêng hoặc thu hồi từng thành viên.
- Bot chạy nhận diện ý định hoàn toàn cục bộ (không gọi API AI); sản phẩm được
  dạy trở thành dữ liệu kho bình thường và đồng bộ theo cơ chế chung.
- `src/lib/help.ts` là nguồn nội dung dùng chung của cẩm nang và bot; hỏi cách
  làm một nghiệp vụ sẽ trả lời theo các bước và có nút mở đúng màn hình.
- `src/lib/app-data/` chứa tiện ích gọi connector và phân loại trạng thái/lỗi,
  nhưng không được dùng cho việc đồng bộ nghiệp vụ này.

### Cách sử dụng

1. Lần đầu mở `/login`, hệ thống tự tạo mã chủ. Lưu mã ở nơi an toàn, bấm
   “Tôi đã lưu mã”, nhập lại để xác nhận. Mất mã sẽ không thể đăng nhập lại;
   không có email, OTP hay câu hỏi bí mật để khôi phục.
2. Trên thiết bị khác mở cùng ứng dụng, nhập cùng mã chủ. Chia sẻ mã chỉ với
   người được phép truy cập toàn bộ sổ; mọi thiết bị sẽ là cùng một tài khoản.
3. Mở “Thiết bị & đồng bộ” → chọn “Tạo hệ thống mới”. Sổ cục bộ hiện tại
   sẽ được tải làm dữ liệu ban đầu.
4. Tải backup JSON từ màn “Sao lưu” trước các thay đổi quan trọng. Dữ liệu
   đồng bộ giữa thiết bị qua máy chủ; dùng được ngoại tuyến trên từng máy.
5. Mở biểu tượng robot để tra “LG M31UII còn bao nhiêu cái?”, “linh kiện nào
   sắp hết?” hoặc “có bao nhiêu phiếu sửa đang mở?”. Khi chưa biết sản phẩm,
   nhập tên/model, số lượng, màu và vị trí theo yêu cầu bot; kiểm tra thông tin
   bot tóm tắt rồi chọn “Xác nhận thêm” để lưu, hoặc “Hủy” để không thay đổi kho.

Chỉ dữ liệu đã đồng bộ lên Postgres có bản sao bền vững phía máy chủ. Dữ liệu
mới chưa đồng bộ còn phụ thuộc thiết bị tạo ra nó; đây là giới hạn bắt buộc của
mô hình local-first khi thiết bị đang offline/hỏng.

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

## 10. Kiểm tra và giới hạn đã biết

Trạng thái kiểm tra khi hoàn tất tính năng:

1. `npm run typecheck`: đạt.
2. `npm run build`: đạt; bundler có cảnh báo chunk lớn. `db:migrate` bỏ qua
   triển khai database thật khi `DATABASE_URL` không được cấp trong môi trường
   này; preview sử dụng PGLite in-memory.
3. `npm run check:auth`: đạt khi dev server hoạt động; auth build/dev cùng bật.
4. `npm test`: 196 test đạt, một test tích hợp PWA thất bại do checkout thiếu
   `public/__grok/icon-180.png` (thư mục chỉ có biến thể `icon-180.png.jpg`).
   Không thay đổi tài nguyên PWA do nền tảng quản lý.
5. `src/lib/sync.test.ts`: ba ca gộp dữ liệu/tombstone, tính tồn kho, cảnh báo
   xuất vượt tồn và chọn bản cập nhật mới nhất đều đạt.
6. Browser smoke chưa thể hoàn tất: môi trường không cho tạo
   `/workspace/screenshots/`; Chromium cài được nhưng thiếu thư viện hệ thống
   `libatk-1.0.so.0`. Dev server trả HTTP 200, song điều đó không thay cho QA ảnh
   desktop/mobile.

Trước khi phát hành thật, hãy kiểm tra hai chiều đồng bộ bằng tài khoản trên
hai trình duyệt/thiết bị, cấu hình Postgres do nền tảng cấp và xác nhận các bản
sao lưu được tải định kỳ. Không xóa dữ liệu local trước khi dữ liệu mới được
xác nhận đồng bộ.

## 11. Quy ước khi tiếp tục phát triển

1. Đọc `src/lib/types.ts`, `src/lib/local-db.ts`, `src/lib/store.tsx` và screen
   tương ứng trước khi đổi nghiệp vụ.
2. Giữ IndexedDB là nguồn ghi trước; nếu sửa schema server, tạo migration mới
   trong `migrations/` và giữ truy vấn workspace phía server.
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
| Thêm trường dữ liệu                          | `src/lib/types.ts` → `src/lib/local-db.ts` → `src/lib/store.tsx` → screen                          |
| Sửa tính tồn kho, phiếu, hóa đơn             | `src/lib/local-db.ts`                                                                              |
| Sửa bảo hành, lọc và lãi ước tính            | `src/lib/domain.ts`                                                                                |
| Sửa tiền, ngày, tìm kiếm                     | `src/lib/format.ts`                                                                                |
| Sửa giấy in/PDF/PNG                          | `src/lib/paper.ts`, `src/components/paper-view.tsx`                                                |
| Sửa sao lưu/khôi phục                        | `src/lib/backup.ts`, `src/components/screens/backup.tsx`                                           |
| Sửa offline/PWA/branding                     | `vite.config.ts`, `scripts/grok-pwa-plugin.mjs`, `server/middleware/grok-pwa.ts`, `public/__grok/` |
| Sửa script build/kiểm tra                    | `package.json`, `scripts/`                                                                         |
