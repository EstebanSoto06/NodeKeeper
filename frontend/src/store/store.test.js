import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore, showToast, dismissToast } from './store.js';

describe('store (toast)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => dismissToast());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('showToast publica un mensaje visible para los suscriptores de useStore', () => {
    const { result } = renderHook(() => useStore());
    expect(result.current.toast).toBeNull();

    act(() => showToast('Operación exitosa'));

    expect(result.current.toast).toMatchObject({ message: 'Operación exitosa', kind: 'success' });
  });

  it('dismissToast limpia el mensaje antes de que expire el temporizador', () => {
    const { result } = renderHook(() => useStore());
    act(() => showToast('Error al guardar', 'error'));
    expect(result.current.toast).not.toBeNull();

    act(() => dismissToast());

    expect(result.current.toast).toBeNull();
  });

  it('el toast se autodescarta despues de su temporizador', () => {
    const { result } = renderHook(() => useStore());
    act(() => showToast('Mensaje temporal'));
    expect(result.current.toast).not.toBeNull();

    act(() => vi.advanceTimersByTime(4300));

    expect(result.current.toast).toBeNull();
  });
});
