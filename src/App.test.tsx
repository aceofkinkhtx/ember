import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { safetyFloor } from './content/copy';
import { defaultSettings, loadSettings, nextStep, SETTINGS_KEY, type Settings } from './state/settings';

const done = (patch: Partial<Settings>): Settings => ({
  ...defaultSettings,
  onboarding: 'done',
  ageConfirmedAt: '2026-11-01T00:00:00Z',
  safetyFloorAcknowledgedAt: '2026-11-01T00:00:00Z',
  ...patch
});

describe('onboarding', () => {
  it('will not continue until a role is chosen and 18+ is confirmed', async () => {
    const user = userEvent.setup();
    render(<App />);
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /Top/ }));
    expect(next).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: "I'm 18 or older" }));
    expect(next).toBeEnabled();
  });

  it('walks a Top through privacy, depth and the safety floor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('radio', { name: /Top/ }));
    await user.click(screen.getByRole('checkbox', { name: "I'm 18 or older" }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Protect Ember first.' })).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Discreet mode' }));
    await user.click(screen.getByRole('button', { name: 'Continue without a PIN' }));

    expect(screen.getByRole('heading', { name: 'How much do you want to see?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(safetyFloor.length);
    await user.click(screen.getByRole('button', { name: 'I understand' }));

    expect(screen.getByRole('heading', { name: 'What needs you today' })).toBeInTheDocument();
    const saved = loadSettings();
    expect(saved.discreet).toBe(true);
    expect(saved.ageConfirmedAt).not.toBeNull();
    expect(saved.safetyFloorAcknowledgedAt).not.toBeNull();
  });

  it('skips the depth step for bottoms', () => {
    expect(nextStep('privacy', 'bottom')).toBe('safety');
    expect(nextStep('privacy', 'top')).toBe('depth');
  });
});

describe('navigation', () => {
  it('shows the Top tab bar', () => {
    render(<App initialSettings={done({ roles: 'top', activeRole: 'top' })} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Home', 'Connections', 'Scenes', 'Toys', 'Me']);
    expect(screen.queryByRole('radiogroup', { name: 'View' })).not.toBeInTheDocument();
  });

  it('shows the bottom tab bar', () => {
    render(<App initialSettings={done({ roles: 'bottom', activeRole: 'bottom' })} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Home', 'Connections', 'Scenes', 'Profile', 'Me']);
  });

  it('lets switches toggle between views', async () => {
    const user = userEvent.setup();
    render(<App initialSettings={done({ roles: 'both', activeRole: 'top' })} />);
    await user.click(screen.getByRole('radio', { name: 'bottom' }));
    expect(screen.getByRole('heading', { name: 'Your space' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('rose');
  });

  it('uses neutral wording in discreet mode', () => {
    render(<App initialSettings={done({ roles: 'top', discreet: true })} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).not.toHaveTextContent(/Scenes|Toys/);
    expect(nav).toHaveTextContent('Plans');
  });
});

describe('PIN lock', () => {
  it('locks on open and unlocks with the right PIN', async () => {
    const { createPinRecord } = await import('./lib/pin');
    const pin = await createPinRecord('246810');
    const user = userEvent.setup();
    render(<App initialSettings={done({ roles: 'top', pin })} />);

    expect(screen.getByRole('heading', { name: 'Enter your PIN' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();

    for (const d of '246810') await user.click(screen.getByRole('button', { name: d }));
    expect(await screen.findByRole('heading', { name: 'What needs you today' })).toBeInTheDocument();
  });

  it('stays locked on a wrong PIN', async () => {
    const { createPinRecord } = await import('./lib/pin');
    const pin = await createPinRecord('246810');
    const user = userEvent.setup();
    render(<App initialSettings={done({ roles: 'top', pin })} />);

    for (const d of '111111') await user.click(screen.getByRole('button', { name: d }));
    expect(await screen.findByText(/didn't match/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SETTINGS_KEY)).not.toContain('246810');
  });
});
