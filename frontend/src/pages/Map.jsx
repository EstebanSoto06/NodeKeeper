/* Mapa de nodos (placeholder estilizado del Design System — sustituible por
   Leaflet/Mapbox). Marcadores coloreados por salud (verde/ámbar/rojo), leyenda
   con conteos y panel lateral al seleccionar un nodo, con acceso al detalle. */
import { useState } from 'react';
import { DATA, NK } from '../data/mockData.js';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { StatusPill, HealthDot } from '../components/StatusPill.jsx';
import { Icon } from '../components/Icon.jsx';

export function Map({ go }) {
  const [sel, setSel] = useState(null);
  const [hidden, setHidden] = useState({});
  const nodes = DATA.nodes;
  const counts = { green: 0, amber: 0, red: 0 };
  nodes.forEach((n) => counts[n.health]++);
  const selNode = nodes.find((n) => n.id === sel);
  const legend = [
    { k: 'green', label: 'Sin pendientes' },
    { k: 'amber', label: 'Tareas incompletas' },
    { k: 'red', label: 'Pendientes' },
  ];

  return (
    <div>
      <PageHeader eyebrow="Geolocalización" title="Mapa de nodos"
        subtitle={`${nodes.length} nodos · Zona Norte, San Carlos`}
        actions={<Button variant="secondary" icon="list" onClick={() => go('nodes')}>Ver listado</Button>} />

      <div className="nk-map-wrap">
        <div className="nk-map">
          <div className="nk-map-canvas"></div>
          <div className="nk-map-grid"></div>
          <div className="nk-map-land" style={{ left: '12%', top: '18%', width: '40%', height: '46%' }}></div>
          <div className="nk-map-land" style={{ left: '54%', top: '40%', width: '34%', height: '40%', borderRadius: '50% 40% 60% 30%' }}></div>
          <div className="nk-map-road" style={{ left: '16%', top: '34%', width: '60%' }}></div>
          <div className="nk-map-road" style={{ left: '30%', top: '20%', width: '46%', transform: 'rotate(58deg)' }}></div>
          <div className="nk-map-road" style={{ left: '22%', top: '60%', width: '52%', transform: 'rotate(-18deg)' }}></div>

          {nodes.filter((n) => !hidden[n.health]).map((n) => {
            const s = NK.health[n.health];
            return (
              <button key={n.id} className={`nk-marker ${sel === n.id ? 'is-active' : ''}`} style={{ left: n.x + '%', top: n.y + '%' }} onClick={() => setSel(n.id)}>
                <span className="nk-marker-pin" style={{ background: s.solid }}>
                  {n.health === 'red' ? <span className="nk-marker-count">{n.pending}</span> : <span className="nk-marker-inner"></span>}
                </span>
              </button>
            );
          })}

          <div className="nk-map-legend">
            {legend.map((l) => (
              <button key={l.k} className={`nk-legend-item ${hidden[l.k] ? 'is-off' : ''}`} onClick={() => setHidden((h) => ({ ...h, [l.k]: !h[l.k] }))}>
                <HealthDot health={l.k} size={9} />
                <span>{l.label}</span>
                <span className="nk-legend-count nk-mono">{counts[l.k]}</span>
              </button>
            ))}
          </div>
          <div className="nk-map-placeholder-note">Mapa ilustrativo · sustituir por Leaflet / Mapbox</div>
        </div>

        <Card pad={false} className="nk-map-panel">
          {selNode ? (
            <div>
              <div className="nk-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HealthDot health={selNode.health} size={11} />
                  <h3 className="nk-section-title">{selNode.name}</h3>
                </div>
                <button className="nk-iconbtn" style={{ width: 28, height: 28 }} onClick={() => setSel(null)}><Icon name="chevron-right" size={16} /></button>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div className="nk-meta"><span className="k">Código</span><span className="v nk-mono">{selNode.code}</span></div>
                <div className="nk-meta"><span className="k">Localidad</span><span className="v">{selNode.city} · {selNode.locality}</span></div>
                <div className="nk-meta"><span className="k">Estado</span><span className="v">
                  {selNode.health === 'red'
                    ? <StatusPill state={{ ...NK.health.red, label: `${selNode.pending} pendientes` }} />
                    : <StatusPill state={NK.health[selNode.health]} />}
                </span></div>
                <div className="nk-meta"><span className="k">Coordenadas</span><span className="v nk-mono" style={{ fontSize: 13 }}>10.3{selNode.x}, -84.4{selNode.y}</span></div>
                <div className="nk-meta"><span className="k">Equipos</span><span className="v nk-mono">{selNode.equip}</span></div>
                <Button variant="primary" icon="arrow-right" style={{ width: '100%', marginTop: 4 }} onClick={() => go('node-detail', selNode.id)}>Ver detalle del nodo</Button>
              </div>
            </div>
          ) : (
            <Empty icon="map-pin" title="Selecciona un nodo" sub="Toca un marcador para ver su información." />
          )}
        </Card>
      </div>
    </div>
  );
}
