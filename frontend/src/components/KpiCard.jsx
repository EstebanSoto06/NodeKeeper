/* Tarjeta KPI / indicador con barra de acento de estado a la izquierda. */
import { Card } from './Card.jsx';

export function KpiCard({ label, value, accent, fg, delta, deltaColor }) {
  return (
    <Card className="nk-kpi" pad={false}>
      <span className="accent" style={{ background: accent }}></span>
      <div className="lab">{label}</div>
      <div className="num" style={{ color: fg }}>{value}</div>
      {delta && <div className="delta" style={{ color: deltaColor }}>{delta}</div>}
    </Card>
  );
}
