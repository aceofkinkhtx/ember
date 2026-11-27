import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { NumberField } from './NumberField';
import { PhotoGallery } from './toys/PhotoGallery';

// Number boxes can be cleared and retyped (Michael, Nov 27).
function Harness() {
  const [n, setN] = useState(10);
  const [ok, setOk] = useState(true);
  return (
    <>
      <NumberField label="Minutes" min={1} max={480} value={n} onChange={setN} onValid={setOk} />
      <output>{`${n} ${ok ? 'ok' : 'bad'}`}</output>
    </>
  );
}

describe('NumberField', () => {
  it('can be cleared, says why while empty, and takes a new number', async () => {
    render(<Harness />);
    const box = screen.getByRole('textbox', { name: 'Minutes' });
    await userEvent.clear(box);
    expect(box).toHaveValue('');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter at least 1 minute.');
    expect(screen.getByText('10 bad')).toBeInTheDocument();
    await userEvent.type(box, '25');
    expect(box).toHaveValue('25');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('25 ok')).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, '0');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter at least 1 minute.');
    await userEvent.clear(box);
    await userEvent.type(box, '999');
    expect(screen.getByRole('alert')).toHaveTextContent('At most 480 minutes.');
  });
});

describe('PhotoGallery', () => {
  it('shows every photo full size, one at a time, and closes', async () => {
    let closed = false;
    render(<PhotoGallery title="Suede flogger" urls={['blob:a', 'blob:b', null]} onClose={() => (closed = true)} />);
    expect(screen.getByRole('dialog', { name: 'Photos of Suede flogger' })).toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '‹ Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next ›' }));
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(closed).toBe(true);
  });
});
