import { Button } from "@ticket-radar/ui";

import { resolveApiError } from "../services/apiErrors";
import { startReauthentication } from "../services/session";

/**
 * 全站唯一的錯誤卡片。文案一律由 `resolveApiError` 產生，確保各頁風格一致，
 * 且技術性訊息只在本機開發出現（TASK-05）。
 */
export function ErrorState({
  error,
  subject = "資料",
  onRetry,
}: {
  error: unknown;
  /** 這次讀不到的東西，用來組句子，例如「活動」「購票任務」。 */
  subject?: string;
  onRetry?: () => void;
}) {
  const resolved = resolveApiError(error, subject);

  return (
    <section className="error-state" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <h2>{resolved.title}</h2>
        <p>{resolved.message}</p>
        {resolved.technical && (
          <p className="error-state__technical">{resolved.technical}</p>
        )}
        {resolved.kind === "auth" ? (
          <Button onClick={startReauthentication}>重新登入</Button>
        ) : (
          onRetry &&
          resolved.canRetry && (
            <Button variant="secondary" onClick={onRetry}>
              重新連線
            </Button>
          )
        )}
      </div>
    </section>
  );
}
