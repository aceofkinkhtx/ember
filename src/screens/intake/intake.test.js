import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { loadDraft } from '../../lib/intake';
import { defaultSettings } from '../../state/settings';
const bottom = {
    ...defaultSettings,
    onboarding: 'done',
    roles: 'bottom',
    activeRole: 'bottom',
    ageConfirmedAt: '2026-11-01T00:00:00Z',
    safetyFloorAcknowledgedAt: new Date().toISOString(),
    donationPromptedAt: new Date().toISOString()
};
async function throughEssentials() {
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    // Safety comes right after the essentials.
    expect(screen.getByRole('heading', { name: 'Safety' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Call 911' }));
    await userEvent.click(screen.getByLabelText(/no play when either of us is noticeably intoxicated/));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Body and mind' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
}
afterEach(() => window.history.pushState({}, '', '/'));
describe('intake', () => {
    it('quick path: every word group is required, and the decoder follows each one', async () => {
        window.history.pushState({}, '', '/intake');
        render(_jsx(App, { initialSettings: bottom }));
        await throughEssentials();
        await userEvent.click(screen.getByRole('checkbox', { name: /^Quick/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
        for (const [group, word] of [
            ['What should it feel like?', 'Velvet'],
            ['How do you want us to connect?', 'Cherish me'],
            ['How should it move?', 'Drift']
        ]) {
            expect(screen.getByRole('heading', { name: group })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Skip/ })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
            await userEvent.click(screen.getByRole('checkbox', { name: new RegExp(`^${word}`) }));
            await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
            expect(screen.getByRole('heading', { name: `What does ${word} do for you?` })).toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', { name: 'Skip this question' }));
        }
        expect(screen.getByRole('heading', { name: 'Aftercare' })).toBeInTheDocument();
        expect(loadDraft()?.intake.quick?.words).toEqual({ heat: ['velvet'], hold: ['cherish'], flow: ['drift'] });
    });
    it('keeps a no as a hard block unless the bottom turns on overrides', async () => {
        window.history.pushState({}, '', '/intake');
        render(_jsx(App, { initialSettings: bottom }));
        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
        const toggle = screen.getByLabelText(/My Top may override a no after we talk/);
        expect(toggle).not.toBeChecked();
        await userEvent.click(toggle);
        expect(loadDraft()?.intake.essentials.allowNoOverride.on).toBe(true);
        expect(loadDraft()?.intake.essentials.allowNoOverride.changedAt).toBeTruthy();
    });
    it('detailed path: my body choices decide which activities show, and you can add your own', async () => {
        window.history.pushState({}, '', '/intake');
        render(_jsx(App, { initialSettings: bottom }));
        await throughEssentials();
        await userEvent.click(screen.getByRole('checkbox', { name: /^Detailed/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('heading', { name: 'My body' })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('radio', { name: 'No' }));
        await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('heading', { name: 'Bondage' })).toBeInTheDocument();
        // Blindfolds: no. It goes straight to the limit strip.
        await userEvent.click(screen.getAllByRole('radio', { name: 'No' })[0]);
        expect(loadDraft()?.intake.detailed?.answers.blindfold).toEqual({ choice: 'no' });
        for (let i = 0; i < 4; i++)
            await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('heading', { name: 'Penetration' })).toBeInTheDocument();
        expect(screen.queryByText('Fingers in vagina or front hole')).not.toBeInTheDocument();
        expect(screen.getByText('Fingers in anus')).toBeInTheDocument();
        await userEvent.type(screen.getByLabelText('Add your own to penetration'), 'Plugs');
        await userEvent.click(screen.getByRole('button', { name: 'Add' }));
        expect(screen.getByText('Plugs')).toBeInTheDocument();
    });
});
