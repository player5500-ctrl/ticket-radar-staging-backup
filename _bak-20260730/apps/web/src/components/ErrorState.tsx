import { Button } from "@ticket-radar/ui";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <section className="error-state" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <h2>訊號暫時中斷</h2>
        <p>{message}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            重新連線
          </Button>
        )}
      </div>
    </section>
  );
}
