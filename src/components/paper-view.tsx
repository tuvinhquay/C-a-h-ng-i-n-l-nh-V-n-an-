import type { PaperDoc } from "@/lib/types";

/** Giấy in. Màu nằm trong CSS (.paper) để in ra đúng, không phụ thuộc token Tailwind. */
export function PaperView({ doc, printable = false }: { doc: PaperDoc; printable?: boolean }) {
  return (
    <article id={printable ? "invoice-print" : undefined} className="paper mx-auto w-full max-w-3xl">
      <header className="paper-head">
        <p className="paper-shop">{doc.shopName}</p>
        {doc.shopMeta.map((line) => (
          <p key={line} className="paper-meta">
            {line}
          </p>
        ))}
      </header>
      <div className="paper-body">
        <h2 className="paper-title">{doc.title}</h2>
        <p className="paper-code">
          <strong>Số: {doc.code}</strong>
          <span>{doc.dateText}</span>
        </p>
        <section>
          <h3>Khách hàng</h3>
          {doc.customerLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
        {doc.deviceLines.length > 0 ? (
          <section>
            <h3>Thiết bị</h3>
            {doc.deviceLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>Nội dung</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, index) => (
              <tr key={`${line.name}-${index}`}>
                <td>{line.name}</td>
                <td>
                  {line.qty} {line.unit}
                </td>
                <td>{line.price}</td>
                <td>{line.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="paper-total">Tổng cộng: {doc.total}</p>
        <p className="paper-words">Bằng chữ: {doc.totalWords}</p>
        {doc.warranty ? <p className="paper-warranty">{doc.warranty}</p> : null}
        {doc.note ? <p>Ghi chú: {doc.note}</p> : null}
        {doc.footer ? <p className="paper-footer">{doc.footer}</p> : null}
        <div className="paper-sign">
          <div>
            <strong>Khách hàng</strong>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <strong>Người lập</strong>
            <span>{doc.signer || "(Ký, ghi rõ họ tên)"}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
