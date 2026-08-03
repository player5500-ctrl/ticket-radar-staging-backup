import { Button } from "@ticket-radar/ui";

import { startReauthentication } from "../services/session";

/**
 * 登出／session 過期後開受保護頁面時顯示的整頁提示（TASK-04）。
 * 取代原本「無限 loading、沒有任何說明」的畫面。
 */
export function ReauthNotice() {
  return (
    <div className="page-container reauth-notice">
      <section className="error-state" role="alert">
        <span aria-hidden="true">!</span>
        <div>
          <h2>請重新登入</h2>
          <p>登入 Session 已失效或你已登出，重新登入後就能繼續使用購票準備功能。</p>
          <Button onClick={startReauthentication}>重新登入</Button>
        </div>
      </section>
    </div>
  );
}
