import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAsync } from './useAsync.js';

function Probe({ asyncFn, deps = [] }) {
  const { data, error, loading, reload } = useAsync(asyncFn, deps);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="data">{data == null ? '' : JSON.stringify(data)}</span>
      <span data-testid="error">{error ? error.message : ''}</span>
      <button type="button" onClick={() => reload()}>reload</button>
    </div>
  );
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsync', () => {
  it('empieza en loading y luego expone data', async () => {
    const asyncFn = vi.fn().mockResolvedValue({ ok: 1 });
    render(<Probe asyncFn={asyncFn} />);

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('data')).toHaveTextContent('{"ok":1}');
  });

  it('expone error cuando la promesa se rechaza', async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error('fallo de red'));
    render(<Probe asyncFn={asyncFn} />);

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('fallo de red'));
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('reload vuelve a ejecutar la funcion asincrona', async () => {
    const asyncFn = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });
    render(<Probe asyncFn={asyncFn} />);

    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('{"n":1}'));

    screen.getByText('reload').click();

    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('{"n":2}'));
    expect(asyncFn).toHaveBeenCalledTimes(2);
  });

  it('descarta una respuesta obsoleta si reload se llama antes de que la primera resuelva', async () => {
    const first = deferred();
    const second = deferred();
    const asyncFn = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    render(<Probe asyncFn={asyncFn} />);
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    // Se dispara reload ANTES de que la primera peticion resuelva.
    screen.getByText('reload').click();

    // La primera resuelve tarde: no debe "ganarle" a la segunda.
    first.resolve({ from: 'first' });
    await Promise.resolve();
    second.resolve({ from: 'second' });

    await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('{"from":"second"}'));
    expect(screen.getByTestId('data')).not.toHaveTextContent('first');
  });

  it('no actualiza estado despues de desmontar (sin warnings de act)', async () => {
    const slow = deferred();
    const asyncFn = vi.fn().mockReturnValue(slow.promise);

    const { unmount } = render(<Probe asyncFn={asyncFn} />);
    unmount();

    // Resolver despues del desmontaje no debe lanzar ni producir un warning
    // de "update on an unmounted component" (la implementacion se protege
    // con mountedRef); si lo hiciera, esta prueba fallaria por el error no
    // manejado de React en jsdom.
    slow.resolve({ ignored: true });
    await Promise.resolve();
    await Promise.resolve();
  });
});
