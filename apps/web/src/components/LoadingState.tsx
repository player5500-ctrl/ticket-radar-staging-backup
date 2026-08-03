export function LoadingState({ label = "正在接收雷達訊號…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-state__radar" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
