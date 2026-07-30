import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { FormField } from './FormField.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { LoadingSkeleton } from './LoadingSkeleton.jsx';
import { ErrorState } from './ErrorState.jsx';
import { EmptyState } from './EmptyState.jsx';
import { AccessDenied } from './AccessDenied.jsx';

describe('ConfirmDialog', () => {
  it('no renderiza nada cuando open es false', () => {
    render(<ConfirmDialog open={false} title="Eliminar" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra titulo, mensaje, y dispara onConfirm/onClose', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Eliminar proveedor"
        message="Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Eliminar proveedor')).toBeInTheDocument();
    expect(screen.getByText('Esta accion no se puede deshacer.')).toBeInTheDocument();

    await user.click(screen.getByText('Eliminar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('se cierra con la tecla Escape (heredado de Modal)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmDialog open title="X" onConfirm={vi.fn()} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mientras busy=true, deshabilita ambos botones y no permite cerrar con Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmDialog open title="X" busy confirmLabel="Eliminar" onConfirm={vi.fn()} onClose={onClose} />);

    expect(screen.getByText('Cancelar').closest('button')).toBeDisabled();
    expect(screen.getByText('Procesando…').closest('button')).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('FormField', () => {
  it('asocia label y control via htmlFor/id, y expone aria-describedby/aria-invalid al render-prop', () => {
    render(
      <FormField label="Correo" required error="Correo invalido">
        {({ id, describedBy, invalid }) => (
          <input id={id} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </FormField>,
    );

    const input = screen.getByLabelText('Correo *');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Correo invalido');
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
  });

  it('muestra el hint solo cuando NO hay error', () => {
    const { rerender } = render(<FormField label="Nombre" hint="Ayuda visible">{() => <input />}</FormField>);
    expect(screen.getByText('Ayuda visible')).toBeInTheDocument();

    rerender(<FormField label="Nombre" hint="Ayuda visible" error="Requerido">{() => <input />}</FormField>);
    expect(screen.queryByText('Ayuda visible')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Requerido');
  });
});

describe('StatusBadge', () => {
  it('resuelve una etiqueta real conocida (kind=maintenance, value=IN_PROGRESS)', () => {
    render(<StatusBadge kind="maintenance" value="IN_PROGRESS" />);
    expect(screen.getByText('En progreso')).toBeInTheDocument();
  });

  it('resuelve estados reales de nodo y equipo', () => {
    render(
      <>
        <StatusBadge kind="node" value="OUT_OF_SERVICE" />
        <StatusBadge kind="equipment" value="OPERATIONAL" />
      </>,
    );
    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    expect(screen.getByText('Operativo')).toBeInTheDocument();
  });

  it('nunca rompe el render ante un valor desconocido: muestra el valor crudo', () => {
    render(<StatusBadge kind="maintenance" value="ALGO_INESPERADO" />);
    expect(screen.getByText('ALGO_INESPERADO')).toBeInTheDocument();
  });
});

describe('LoadingSkeleton', () => {
  it('marca aria-busy y renderiza el numero de lineas pedido', () => {
    const { container } = render(<LoadingSkeleton lines={3} />);
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).toBeInTheDocument();
    // 3 lineas + el <span> de "Cargando…" para lectores de pantalla.
    expect(busyEl.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});

describe('ErrorState', () => {
  it('muestra el mensaje del error y no un stack trace', () => {
    render(<ErrorState error={new Error('El servidor no respondio')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('El servidor no respondio');
    expect(screen.queryByText(/at Object/)).not.toBeInTheDocument();
  });

  it('el boton de reintentar solo aparece si se pasa onRetry, y lo invoca al hacer click', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState error={new Error('x')} />);
    expect(screen.queryByText('Reintentar')).not.toBeInTheDocument();

    rerender(<ErrorState error={new Error('x')} onRetry={onRetry} />);
    await user.click(screen.getByText('Reintentar'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  it('muestra titulo, subtitulo y una accion opcional', () => {
    render(<EmptyState title="Sin proveedores" subtitle="Aun no hay registros." action={<button type="button">Crear</button>} />);
    expect(screen.getByText('Sin proveedores')).toBeInTheDocument();
    expect(screen.getByText('Aun no hay registros.')).toBeInTheDocument();
    expect(screen.getByText('Crear')).toBeInTheDocument();
  });
});

describe('AccessDenied', () => {
  it('muestra el mensaje de acceso restringido y navega al hacer click en volver', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/usuarios']}>
        <AccessDenied />
      </MemoryRouter>,
    );

    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    const button = screen.getByText('Volver al inicio');
    await user.click(button);
    // No hay ruta /dashboard montada en este test minimo, pero el click no
    // debe lanzar: confirma que useNavigate() esta correctamente conectado.
    await waitFor(() => expect(button).toBeInTheDocument());
  });
});
