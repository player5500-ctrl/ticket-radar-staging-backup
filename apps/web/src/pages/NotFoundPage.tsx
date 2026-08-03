import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page-container not-found">
      <span aria-hidden="true">404</span>
      <h1>雷達找不到這個訊號</h1>
      <p>頁面可能已移動，或網址輸入有誤。</p>
      <Link className="text-link" to="/">
        返回首頁
      </Link>
    </div>
  );
}
