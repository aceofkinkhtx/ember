import { activities, categories, feelings, impactAreas } from './activities';

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

  it('needs the STI checkbox for oral contact, and whenever a penis is involved', () => {
    activities
      .filter((a) => /oral|anal licking/i.test(a.label))
      .forEach((a) => expect(a.stiCheck).toBe('always'));
    activities
      .filter((a) => /penis/i.test(a.label) && a.category === 'penetration')
      .forEach((a) => {
        expect(a.stiCheck).toBe('if-penis');
        expect(a.negotiatedOnly).toBe(true);
      });
  });

  it('never offers kidneys as an impact area', () => {
    expect(impactAreas.some((x) => /kidney/i.test(x.label))).toBe(false);
  });
});

describe('inclusive wording', () => {
  const allLabels = [...activities.map((a) => a.label), ...impactAreas.map((x) => x.label), ...feelings];

  it('never assumes a gender', () => {
    const gendered = /\b(he|him|his|she|her|hers|man|men|woman|women|male|female|boy|girl|guy|lady)\b/i;
    expect(allLabels.filter((l) => gendered.test(l))).toEqual([]);
  });

  it('pairs penis with strap-on and vagina with front hole', () => {
    activities.filter((a) => /penis/i.test(a.label)).forEach((a) => expect(a.label).toMatch(/strap-on/i));
    activities.filter((a) => /vagina/i.test(a.label)).forEach((a) => expect(a.label).toMatch(/front hole/i));
  });

  it('never names breasts or vulva alone', () => {
    expect(allLabels.filter((l) => /^(breasts|vulva)$/i.test(l))).toEqual([]);
  });
});
