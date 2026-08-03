export function Logo() {
  return (
    <span className="logo" aria-label="追票雷達 Ticket Radar">
      <span aria-hidden="true" className="logo__radar">
        <span className="logo__sweep" />
      </span>
      <span className="logo__wordmark">
        <strong>追票雷達</strong>
        <small>Ticket Radar</small>
      </span>
    </span>
  );
}
