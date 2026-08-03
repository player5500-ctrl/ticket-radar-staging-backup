import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../services/api";

export function DemoTicketPage() {
  const [submitted, setSubmitted] = useState(false);
  const recordMutation = useMutation({
    mutationFn: () =>
      api.createPurchaseRecord({
        eventId: "event-stellar-route-taipei",
        orderReferenceMasked: "DEMO-***-4821",
        ticketCount: 1,
        sessionLabel: "Demo 一般票",
        seatOrAreaMasked: "區域已遮罩",
        notes: "受控 Demo 成功頁",
        source: "extension_demo",
      }),
  });
  return (
    <div className="page-container demo-ticket-page">
      <header className="page-heading">
        <p className="section-heading__eyebrow">CONTROLLED EXTENSION DEMO</p>
        <h1>Demo 售票頁</h1>
        <p>
          此頁僅供 Extension 驗證基本聯絡欄位填入。座位、票數、條款、送出與付款均不會被
          Extension 操作。
        </p>
      </header>
      {submitted ? (
        <section className="empty-state" data-ticket-radar-demo="success">
          <span>✓</span>
          <h2>Demo 訂單已成立</h2>
          <p data-tr-sensitive="order-reference">訂單參考：DEMO-ORDER-4821</p>
          <p>這不是實際訂單，也沒有付款或取票資料。</p>
          <button
            className="tr-button tr-button--secondary"
            type="button"
            disabled={recordMutation.isPending}
            onClick={() => recordMutation.mutate()}
          >
            {recordMutation.isSuccess ? "已儲存遮罩後紀錄" : "儲存遮罩後 Demo 紀錄"}
          </button>
        </section>
      ) : (
        <form
          className="demo-ticket-form"
          data-ticket-radar-demo="ticket-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <label>
            購票人姓名
            <input data-tr-field="purchaserName" name="purchaserName" required />
          </label>
          <label>
            Email
            <input data-tr-field="email" name="email" type="email" required />
          </label>
          <label>
            手機
            <input data-tr-field="phone" name="phone" inputMode="tel" required />
          </label>
          <label>
            票種（僅供使用者自行選擇）
            <select name="ticketType">
              <option>一般票</option>
              <option>身障席</option>
            </select>
          </label>
          <label>
            張數（僅供使用者自行選擇）
            <select name="quantity">
              <option>1</option>
              <option>2</option>
            </select>
          </label>
          <button className="tr-button tr-button--primary" type="submit">
            由我手動送出 Demo 表單
          </button>
        </form>
      )}
    </div>
  );
}
