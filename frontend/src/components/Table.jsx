/* Tabla del Design System. Uso:
     <Table columns={['Código','Nodo','Estado']}>
       <tr>…</tr>
     </Table>
   Para casos con celdas/encabezados personalizados, usa <table className="nk-table"> directamente. */

export function Table({ columns = [], children }) {
  return (
    <table className="nk-table">
      <thead>
        <tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
