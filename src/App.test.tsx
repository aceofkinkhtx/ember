import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { safetyFloor } from './content/copy';
import { defaultSettings, loadSettings, nextStep, SETTINGS_KEY, type Settings } from './state/settings';

const done = (patch: Partial<Settings>): Settings => ({
  ...defaultSettings,
  onboarding: 'done',
  ageConfirmedAt: '2026-11-01T00:00:00Z',
  safetyFloorAcknowledgedAt: new Date().toISOString(),
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

    expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'they/them' }));
    await user.click(screen.getByRole('button', { name: 'Nonbinary' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Protect Ember first.' })).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Discreet mode' }));
    await user.click(screen.getByRole('button', { name: 'Continue without a PIN' }));

    expect(screen.getByRole('heading', { name: 'How much do you want to see?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'What you offer' })).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Impact' }));
    fireEvent.change(screen.getByRole('slider', { name: 'How far you go with impact, up to' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('slider', { name: 'How far you go with impact, from' }), { target: { value: '3' } });
    expect(screen.getByText('3 to 8')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Canes' }));
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Whips' }));
    const sheet = screen.getByRole('dialog');
    await user.clear(within(sheet).getByRole('textbox', { name: 'Name' }));
    await user.type(within(sheet).getByRole('textbox', { name: 'Name' }), 'Single tails');
    await user.click(within(sheet).getByRole('button', { name: 'Save name' }));
    expect(screen.getByRole('button', { name: 'Single tails' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Your settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Skip for now" }));

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(safetyFloor.length);
    await user.click(screen.getByRole('button', { name: 'I understand' }));

    expect(screen.getByRole('heading', { name: 'What needs you today' })).toBeInTheDocument();
    const saved = loadSettings();
    expect(saved.discreet).toBe(true);
    expect(saved.identity.pronouns).toEqual(['they']);
    expect(saved.identity.genders).toEqual(['Nonbinary']);
    expect(saved.ageConfirmedAt).not.toBeNull();
    expect(saved.safetyFloorAcknowledgedAt).not.toBeNull();
    expect(saved.top.offerings.categories.impact).toEqual({ on: true, min: 3, max: 8 });
    expect(saved.top.offerings.renames).toEqual({ whip: 'Single tails' });
    expect(saved.top.offerings.activities).toEqual({ cane: false });
    expect(saved.top.settings.setAt).toBeNull();
    expect(screen.queryByText('Tell Ember what you offer')).not.toBeInTheDocument();
  });

  it("asks everyone about themselves, and skips the Top's steps for bottoms", () => {
    expect(nextStep('welcome', 'bottom')).toBe('about');
    expect(nextStep('welcome', 'top')).toBe('about');
    expect(nextStep('privacy', 'bottom')).toBe('safety');
    expect(nextStep('privacy', 'top')).toBe('depth');
    expect(nextStep('depth', 'both')).toBe('offerings');
    expect(nextStep('topSettings', 'top')).toBe('safety');
  });
});

describe('navigation', () => {
  it('shows the Top tab bar', () => {
    render(<App initialSettings={done({ roles: 'top', activeRole: 'top' })} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Home', 'Connections', 'Scenes', 'Gear', 'Me']);
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
    expect(nav).not.toHaveTextContent(/Scenes|Gear/);
    expect(nav).toHaveTextContent('Plans');
  });
});

describe('donation note', () => {
  it('appears once the month is up, and not again right after', async () => {
    const user = userEvent.setup();
    const long = '2026-01-01T00:00:00Z';
    const { unmount } = render(<App initialSettings={done({ roles: 'top', safetyFloorAcknowledgedAt: long })} />);
    expect(screen.getByRole('dialog', { name: 'Help keep Ember free' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '$5' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Not this month' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    render(<App initialSettings={loadSettings()} />);
    expect(screen.queryByRole('dialog', { name: 'Help keep Ember free' })).not.toBeInTheDocument();
  });

  it('does not appear in the first week', () => {
    render(<App initialSettings={done({ roles: 'top', safetyFloorAcknowledgedAt: new Date().toISOString() })} />);
    expect(screen.queryByRole('dialog', { name: 'Help keep Ember free' })).not.toBeInTheDocument();
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
