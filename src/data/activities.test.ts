import { activities, categories, impactAreas } from './activities';

describe('activity library', () => {
  it('has unique ids', () => {
    const ids = activities.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts every activity in a known category', () => {
    const known = new Set(categories.map((c) => c.id));
    activities.forEach((a) => expect(known.has(a.category)).toBe(true));
  });

  it('marks the edge play items from the spec', () => {
    const edge = activities.filter((a) => a.edge).map((a) => a.id);
    expect(edge).toEqual(expect.arrayContaining(['choking', 'knife-play', 'sharps']));
  });

  it('flags every penis and oral item as STI check and negotiated only', () => {
    activities
      .filter((a) => /penis in|oral|anal licking/i.test(a.label))
      .forEach((a) => {
        expect(a.stiCheck).toBe(true);
        expect(a.negotiatedOnly).toBe(true);
      });
  });

  it('never offers kidneys as an impact area', () => {
    expect(impactAreas.some((x) => /kidney/i.test(x.label))).toBe(false);
  });
});
