import { careSuggestion, checkInQuestions } from './checkins';

describe('check-ins', () => {
  it('each have three questions, starting with how you feel', () => {
    for (const kind of ['pre', 'post', 'followup'] as const) {
      for (const role of ['top', 'bottom'] as const) {
        const qs = checkInQuestions(kind, role);
        expect(qs).toHaveLength(3);
        expect(qs[0]).toMatchObject({ id: 'feeling', kind: 'scale' });
      }
    }
  });

  it('ask about the other person by their role', () => {
    expect(checkInQuestions('post', 'bottom')[1].prompt).toBe('How attentive was your Top to you?');
    expect(checkInQuestions('post', 'top')[1].prompt).toBe('How responsive was your bottom during the scene?');
    expect(checkInQuestions('followup', 'bottom')[2].prompt).toBe('Notes for your Top');
    expect(checkInQuestions('followup', 'bottom', true)[2].prompt).toBe('Notes for your Lead');
  });

  it('offer extra care only after a 1 or 2', () => {
    expect(careSuggestion('post', 2)).toBe('stay-longer');
    expect(careSuggestion('followup', 1)).toBe('reach-out');
    expect(careSuggestion('post', 3)).toBeNull();
    expect(careSuggestion('pre', 1)).toBeNull();
  });
});
