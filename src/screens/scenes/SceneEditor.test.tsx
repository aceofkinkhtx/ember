import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { categories } from '../../data/activities';
import { emptyTopSetup } from '../../content/topSetup';
import { emptyDetailed, emptyIntake } from '../../lib/intake';
import { customDesign } from '../../lib/scene/designer';
import type { RuleContext } from '../../lib/scene/rules';
import type { Scene } from '../../lib/scene/model';
import { defaultSettings, SettingsProvider } from '../../state/settings';
import { SceneEditor } from './SceneEditor';

// The editor's language and structure (Michael, Nov 25): moments hold moments
// and activities; adding an activity starts from the list; moments delete
// only after a confirm.

const intake = emptyIntake();
intake.paths = ['detailed'];
intake.detailed = emptyDetailed();
intake.detailed.answers['flogger'] = { choice: 'yes' };
const top = emptyTopSetup();
for (const c of categories) top.offerings.categories[c.id] = { on: true, min: 1, max: 9 };
top.offerings.setAt = '2026-11-01T00:00:00Z';
const ctx: RuleContext = { intake, top, optedOutGear: [], gear: [], intakeOf: 'partner' };

let scene: Scene;

const account = { keys: { userId: 'u1' }, status: 'signed-in' };
vi.mock('../../state/account', () => ({ useAccount: () => account }));
vi.mock('../../lib/scenes', () => ({
  listScenes: vi.fn(async () => [scene]),
  saveScene: vi.fn(async (_k: unknown, s: Scene) => s),
  copyScene: vi.fn(),
  deleteScene: vi.fn()
}));
vi.mock('../../lib/intake', async (original) => ({ ...(await original<typeof import('../../lib/intake')>()), listVersions: vi.fn(async () => []) }));
vi.mock('../../state/sceneContext', () => ({
  useSceneData: () => ({ data: { ctx, gear: [], theirGearShown: true, intakeVersion: 1 }, showTheirGear: async () => 0 })
}));

function open() {
  scene = {
    ...customDesign(
      {
        title: 'Saturday',
        connectionId: 'c1',
        partnerId: 'u2',
        partnerName: 'Wren',
        role: 'top',
        date: '',
        startTime: '',
        minutes: 60,
        location: '',
        isPublic: false,
        intense: false,
        intakeVersion: 1,
        marks: 'week',
        useSpecificGear: false,
        gearIds: [],
        picks: [],
        overrides: [],
        notes: ''
      },
      ctx
    ),
    id: 'sc1'
  };
  render(
    <SettingsProvider initial={{ ...defaultSettings, top: { ...defaultSettings.top, offerings: top.offerings } }}>
      <MemoryRouter initialEntries={['/scenes/sc1']}>
        <Routes>
          <Route path="/scenes/:id" element={<SceneEditor />} />
        </Routes>
      </MemoryRouter>
    </SettingsProvider>
  );
}

describe('scene editor', () => {
  it('uses moment and activity, Build-up and Peak Moment', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Saturday' })).toBeInTheDocument();
    expect(screen.getByText('Add a moment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build-up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Peak Moment' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Add activity' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '+ Add a moment inside' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/beat/i)).toBeNull();
  });

  it('adding an activity shows the list first, then its own sheet', async () => {
    open();
    await screen.findByRole('heading', { name: 'Saturday' });
    await userEvent.click(screen.getAllByRole('button', { name: '+ Add activity' })[0]);
    const sheet = screen.getByRole('dialog', { name: 'Add an activity' });
    await userEvent.click(within(sheet).getByRole('button', { name: /Impact/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: /Floggers/ }));
    const step = await screen.findByRole('dialog', { name: /Floggers/ });
    expect(within(step).getByRole('button', { name: 'Change' })).toHaveClass('btn-outline');
    expect(within(step).getByRole('button', { name: 'Close' })).toHaveClass('btn-outline');
    expect(within(step).getByText('In which moment')).toBeInTheDocument();
  });

  it('deletes a moment only after a confirm, and keeps the ones the rules need', async () => {
    open();
    await screen.findByRole('heading', { name: 'Saturday' });
    await userEvent.click(screen.getByRole('button', { name: 'Build-up' }));
    expect(screen.getAllByRole('button', { name: 'Delete the Build-up moment' })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete the Build-up moment' })[1]);
    const confirm = screen.getByRole('dialog', { name: /Delete the Build-up moment/ });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(screen.getAllByRole('button', { name: 'Delete the Build-up moment' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Delete the Aftercare moment' }));
    const keep = screen.getByRole('dialog', { name: /Delete the Aftercare moment/ });
    await userEvent.click(within(keep).getByRole('button', { name: 'Delete' }));
    expect(within(keep).getByRole('alert')).toHaveTextContent('Every scene needs Aftercare.');

    // Aftercare is the one section no warning removes (Michael, Nov 26).
    expect(within(keep).queryByRole('checkbox')).toBeNull();
    expect(within(keep).queryByRole('button', { name: /Delete/ })).toBeNull();
    await userEvent.click(within(keep).getByRole('button', { name: 'Cancel' }));

    // Every other section goes after its warning is ticked, and can be put back.
    await userEvent.click(screen.getByRole('button', { name: 'Delete the Arrival moment' }));
    const arrival = screen.getByRole('dialog', { name: /Delete the Arrival moment/ });
    const del = within(arrival).getByRole('button', { name: 'Delete' });
    expect(del).toBeDisabled();
    await userEvent.click(within(arrival).getByRole('checkbox'));
    await userEvent.click(del);
    expect(screen.queryByRole('button', { name: 'Delete the Arrival moment' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Start the scene' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Arrival' }));
    expect(screen.getByRole('button', { name: 'Delete the Arrival moment' })).toBeInTheDocument();
  });
});
