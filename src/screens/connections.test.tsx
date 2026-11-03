import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { App } from '../App';
import * as account from '../lib/account';
import { defaultSettings, type Settings } from '../state/settings';

// The server is faked here; supabase/tests covers the real privacy rules.
vi.mock('../lib/account', async (original) => {
  const real = await original<typeof import('../lib/account')>();
  return {
    ...real,
    lookupInvite: vi.fn(),
    lookupPersonalCode: vi.fn(),
    submitGuestAnswers: vi.fn(),
    signUp: vi.fn()
  };
});

const done = (patch: Partial<Settings> = {}): Settings => ({
  ...defaultSettings,
  onboarding: 'done',
  roles: 'top',
  activeRole: 'top',
  ageConfirmedAt: '2026-11-01T00:00:00Z',
  safetyFloorAcknowledgedAt: new Date().toISOString(),
  donationPromptedAt: new Date().toISOString(),
  ...patch
});

const guestInvite: account.InviteInfo = {
  kind: 'guest',
  inviterRole: 'top',
  suggestedPath: 'detailed',
  inviterPublicKey: 'pk-river',
  note: { name: 'River', pronouns: 'they/them', message: 'Looking forward to Saturday.' },
  expired: false,
  used: false
};

function visit(path: string) {
  window.history.pushState({}, '', path);
}

afterEach(() => {
  vi.mocked(account.lookupInvite).mockReset();
  vi.mocked(account.lookupPersonalCode).mockReset();
  vi.mocked(account.submitGuestAnswers).mockReset();
  vi.mocked(account.signUp).mockReset();
  visit('/');
});

describe('connections without an account', () => {
  it('offers to create an account, and checks the password twice', async () => {
    visit('/connections');
    render(<App initialSettings={done()} />);
    expect(await screen.findByText(/Connecting with someone needs an account/)).toBeInTheDocument();
    const submit = screen.getAllByRole('button', { name: 'Create account' }).find((b) => b.getAttribute('type') === 'submit')!;
    await userEvent.type(screen.getByLabelText('Email'), 'jade@example.com');
    await userEvent.type(screen.getByLabelText(/^Password(?! again)/), 'a long passphrase');
    await userEvent.type(screen.getByLabelText('Password again'), 'a different one!');
    expect(submit).toBeDisabled();
    expect(screen.getByText("The two passwords don't match yet.")).toBeInTheDocument();
  });

  it('explains the email step when confirmation is needed', async () => {
    vi.mocked(account.signUp).mockResolvedValue({ kind: 'confirm-email' });
    visit('/connections');
    render(<App initialSettings={done()} />);
    await userEvent.type(await screen.findByLabelText('Email'), 'jade@example.com');
    await userEvent.type(screen.getByLabelText(/^Password(?! again)/), 'a long passphrase');
    await userEvent.type(screen.getByLabelText('Password again'), 'a long passphrase');
    const submit = screen.getAllByRole('button', { name: 'Create account' }).find((b) => b.getAttribute('type') === 'submit')!;
    await userEvent.click(submit);
    expect(await screen.findByText(/Check your email and tap the link/)).toBeInTheDocument();
    expect(account.signUp).toHaveBeenCalledWith('jade@example.com', 'a long passphrase');
  });
});

describe('guest link', () => {
  it('works on a phone with no Ember setup, asks for 18+, and sends locked answers', async () => {
    vi.mocked(account.lookupInvite).mockResolvedValue(guestInvite);
    vi.mocked(account.submitGuestAnswers).mockResolvedValue();
    visit('/guest/ABCDEFGHJKMNPQRSTUVWXYZ2#notekey');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'River invited you' })).toBeInTheDocument();
    expect(account.lookupInvite).toHaveBeenCalledWith('ABCDEFGHJKMNPQRSTUVWXYZ2', 'notekey');
    expect(screen.getByText(/Looking forward to Saturday/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();

    await userEvent.click(screen.getByLabelText("I'm 18 or older"));
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await userEvent.type(screen.getByLabelText(/Your scene name/), 'Sol');
    await userEvent.click(screen.getByRole('button', { name: 'Send my answers' }));

    expect(await screen.findByText(/River has your answers now/)).toBeInTheDocument();
    const [code, publicKey, answers] = vi.mocked(account.submitGuestAnswers).mock.calls[0];
    expect(code).toBe('ABCDEFGHJKMNPQRSTUVWXYZ2');
    expect(publicKey).toBe('pk-river');
    expect(answers.name).toBe('Sol');
  });

  it('says so plainly when the link was already used', async () => {
    vi.mocked(account.lookupInvite).mockResolvedValue({ ...guestInvite, used: true });
    visit('/guest/ABCDEFGHJKMNPQRSTUVWXYZ2');
    render(<App />);
    expect(await screen.findByText(/already been used/)).toBeInTheDocument();
  });
});

describe('accept invite', () => {
  it("shows who is inviting and asks a signed-out person to sign in", async () => {
    vi.mocked(account.lookupInvite).mockResolvedValue({ ...guestInvite, kind: 'account' });
    visit('/join/ABCD2345#notekey');
    render(<App initialSettings={done({ roles: 'bottom', activeRole: 'bottom' })} />);
    expect(await screen.findByText('River (they/them)')).toBeInTheDocument();
    expect(screen.getByText('Top', { selector: 'p' })).toBeInTheDocument();
    // The invitee picks their own role, starting from the usual match.
    expect(screen.getByRole('radio', { name: 'Bottom' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('To connect, create an account or sign in.')).toBeInTheDocument();
  });
});

describe('personal code', () => {
  it("shows the owner's scene name and role, and warns when the roles can't work together", async () => {
    vi.mocked(account.lookupInvite).mockResolvedValue(null);
    vi.mocked(account.lookupPersonalCode).mockResolvedValue({ sceneName: 'Ace', role: 'top', publicKey: 'pk-ace' });
    visit('/join/ACEOFKINK');
    render(<App initialSettings={done({ roles: 'bottom', activeRole: 'bottom' })} />);

    expect(await screen.findByRole('heading', { name: 'Connect with Ace' })).toBeInTheDocument();
    expect(screen.getByText('Top', { selector: 'p' })).toBeInTheDocument();
    expect(account.lookupPersonalCode).toHaveBeenCalledWith('ACEOFKINK');
    expect(screen.getByText('To send a request, create an account or sign in.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Top' }));
    expect(screen.getByText(/Those roles don't fit together/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Switch' }));
    expect(screen.queryByText(/Those roles don't fit together/)).not.toBeInTheDocument();
  });
});
