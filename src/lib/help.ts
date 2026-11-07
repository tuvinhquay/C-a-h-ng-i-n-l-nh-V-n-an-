import type { Screen } from "@/lib/nav";

export interface GuideTopic {
  id: string;
  category: string;
  title: string;
  keywords: string[];
  steps: string[];
  screen: Screen;
}

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: "add-part",
    category: "Kho linh kiện",
    title: "Thêm linh kiện vào kho",
    keywords: ["thêm linh kiện", "thêm sản phẩm", "tạo mã hàng", "nhập linh kiện", "tồn đầu"],
    steps: [
      "Mở Kho linh kiện rồi chọn Thêm linh kiện.",
      "Nhập tên, mã hàng nếu có, loại máy, thương hiệu, đơn vị và thông tin giá.",
      "Nhập số lượng tồn đầu, mức tồn tối thiểu và vị trí để dễ tìm.",
      "Chọn Lưu linh kiện. Tồn đầu được ghi vào lịch sử kho.",
    ],
    screen: { view: "part" },
  },
  {
    id: "stock-moves",
    category: "Kho linh kiện",
    title: "Nhập, xuất hoặc kiểm kê tồn",
    keywords: [
      "nhập kho",
      "nhập hàng",
      "xuất kho",
      "kiểm kê",
      "điều chỉnh tồn",
      "lịch sử nhập xuất",
    ],
    steps: [
      "Mở Kho linh kiện và chọn linh kiện cần cập nhật.",
      "Chọn Nhập / xuất.",
      "Chọn Nhập để tăng tồn, Xuất để giảm tồn, hoặc Kiểm kê để ghi số lượng thực tế.",
      "Nhập số lượng và ghi chú, rồi xác nhận. Lịch sử biến động được lưu tự động.",
    ],
    screen: { view: "parts" },
  },
  {
    id: "repairs",
    category: "Sửa chữa",
    title: "Tạo và cập nhật phiếu sửa",
    keywords: ["phiếu sửa", "sửa chữa", "nhận máy", "bảo hành", "máy đang sửa"],
    steps: [
      "Mở Sửa chữa rồi chọn Tạo phiếu sửa.",
      "Chọn khách đã có hoặc tạo khách mới; nhập thiết bị, model, serial và triệu chứng.",
      "Thêm linh kiện, công thợ, ghi chú và thời hạn bảo hành.",
      "Chọn Lưu, vẫn đang sửa để lưu nháp; khi hoàn tất, chọn hoàn tất phiếu để ghi nhận xuất linh kiện.",
    ],
    screen: { view: "repair" },
  },
  {
    id: "customers",
    category: "Khách hàng",
    title: "Lưu hồ sơ khách hàng",
    keywords: ["khách hàng", "hồ sơ khách", "thêm khách", "tạo khách"],
    steps: [
      "Mở menu Thêm rồi chọn Khách hàng.",
      "Chọn Thêm khách, nhập tên và thông tin liên hệ cần thiết.",
      "Chọn Lưu hồ sơ. Từ hồ sơ khách, bạn có thể xem lịch sử sửa và tạo phiếu mới.",
    ],
    screen: { view: "customers" },
  },
  {
    id: "quotes",
    category: "Báo giá",
    title: "Lập và gửi báo giá",
    keywords: ["báo giá", "lập giá", "ước giá", "chuyển báo giá"],
    steps: [
      "Mở menu Thêm rồi chọn Báo giá, sau đó chọn Tạo báo giá.",
      "Chọn khách hàng hoặc nhập thông tin người nhận.",
      "Thêm linh kiện, công thợ và phụ phí; bạn có thể chỉnh số lượng và đơn giá từng dòng.",
      "Chọn Lưu báo giá. Mở lại báo giá để xem, in, tải PDF/ảnh hoặc chuyển thành phiếu sửa.",
    ],
    screen: { view: "quote" },
  },
  {
    id: "sales",
    category: "Hóa đơn",
    title: "Bán linh kiện và xuất hóa đơn",
    keywords: ["bán hàng", "bán linh kiện", "hóa đơn", "hóa đơn bán", "xuất hóa đơn bán"],
    steps: [
      "Từ Tổng quan chọn Bán linh kiện, hoặc mở mục Hóa đơn rồi bắt đầu bán.",
      "Thêm linh kiện và số lượng; chọn khách nếu cần ghi thông tin người mua.",
      "Kiểm tra tổng tiền và tồn kho, sau đó chọn Xuất hóa đơn và trừ kho.",
      "Mở hóa đơn vừa tạo để in, tải PDF/ảnh hoặc xem chi tiết.",
    ],
    screen: { view: "sale" },
  },
  {
    id: "repair-invoice",
    category: "Hóa đơn",
    title: "Lập hóa đơn sửa chữa",
    keywords: ["hóa đơn sửa", "hóa đơn sửa chữa", "thu tiền sửa chữa", "xuất hóa đơn sửa"],
    steps: [
      "Mở Sửa chữa và chọn phiếu đã hoàn tất.",
      "Chọn Lập hóa đơn sửa chữa.",
      "Kiểm tra các khoản thu, công thợ và ghi chú trước khi phát hành.",
      "Chọn xuất hóa đơn; sau đó có thể in hoặc tải PDF/ảnh từ chi tiết hóa đơn.",
    ],
    screen: { view: "repairs", filter: "done" },
  },
  {
    id: "backup",
    category: "Sao lưu",
    title: "Sao lưu hoặc chuyển dữ liệu",
    keywords: ["sao lưu", "backup", "khôi phục", "đổi điện thoại", "chuyển máy"],
    steps: [
      "Mở menu Thêm rồi chọn Sao lưu.",
      "Chọn Tải file sao lưu và giữ file JSON ở nơi an toàn.",
      "Trên thiết bị mới, mở cùng mục và chọn file để khôi phục.",
      "Khôi phục sẽ thay toàn bộ dữ liệu trên thiết bị hiện tại; hãy sao lưu trước khi xác nhận.",
    ],
    screen: { view: "backup" },
  },
  {
    id: "workspace",
    category: "Thiết bị & đồng bộ",
    title: "Kết nối nhiều thiết bị",
    keywords: ["đồng bộ", "mã mời", "workspace", "kết nối thiết bị", "thành viên", "đăng nhập"],
    steps: [
      "Đăng nhập tài khoản của bạn. Mỗi thành viên dùng tài khoản riêng.",
      "Quản trị viên mở Thiết bị & đồng bộ và tạo hệ thống cửa hàng.",
      "Quản trị viên tạo mã mời rồi gửi mã cho thành viên.",
      "Thành viên đăng nhập trên thiết bị của mình, nhập mã mời và xác nhận tham gia.",
      "Dữ liệu vẫn dùng được ngoại tuyến trên từng máy; các thay đổi sẽ đồng bộ khi có mạng.",
    ],
    screen: { view: "workspace" },
  },
  {
    id: "settings",
    category: "Cửa hàng",
    title: "Cập nhật thông tin và cài ứng dụng",
    keywords: ["cài đặt cửa hàng", "thông tin cửa hàng", "tên cửa hàng", "cài ứng dụng", "cài app"],
    steps: [
      "Mở menu Thêm rồi chọn Thông tin cửa hàng.",
      "Cập nhật tên, chủ cửa hàng, số điện thoại, địa chỉ và thông tin in trên hóa đơn.",
      "Chọn Lưu để áp dụng.",
      "Trên điện thoại, chọn Cài ra màn hình chính trong ứng dụng hoặc dùng menu trình duyệt để cài.",
    ],
    screen: { view: "settings" },
  },
  {
    id: "assistant",
    category: "Trợ lý",
    title: "Hỏi hoặc dạy Trợ lý Vân An",
    keywords: ["trợ lý", "bot", "dạy bot", "hỏi bot", "tra cứu kho"],
    steps: [
      "Chạm biểu tượng robot ở góc màn hình.",
      "Hỏi tồn kho, vị trí linh kiện, hàng sắp hết hoặc số phiếu sửa đang mở.",
      "Nếu chưa có sản phẩm, gửi tên/model, số lượng, màu và vị trí.",
      "Đọc lại phần tóm tắt rồi chọn Xác nhận thêm để lưu; chọn Hủy nếu thông tin chưa đúng.",
    ],
    screen: { view: "guide" },
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function isHelpRequest(text: string): boolean {
  const value = normalize(text);
  return (
    /(^| )(huong dan|chi toi|lam sao|lam the nao|chua biet|khong biet|tro giup|giup toi|how to|help)( |$)/.test(
      value,
    ) || /(^| )cach( |$)/.test(value)
  );
}

export function findGuideTopic(text: string): GuideTopic | null {
  const query = normalize(text);
  if (!query) return null;

  const matches = GUIDE_TOPICS.map((topic) => {
    const score = Math.max(
      0,
      ...topic.keywords
        .map(normalize)
        .filter((keyword) => query.includes(keyword))
        .map((keyword) => keyword.length),
    );
    return { topic, score };
  })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!matches.length || matches[0]?.score === matches[1]?.score) return null;
  return matches[0]?.topic ?? null;
}
