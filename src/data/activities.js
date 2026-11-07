// Starter activity library, taken from the A.C.E. Pre-Negotiation Form.
// Every activity becomes a yes / maybe / no choice in the detailed intake.
//
// Inclusive wording: labels never assume anyone's anatomy or gender. Items that
// involve a penis say "penis or strap-on", vaginal items say "vagina or front
// hole", and items are written from the bottom's side ("my", "my Top's").
//
// The library is a starting point, not a closed list:
// - Tops can hide, rename or add activities in their offerings (M3).
// - Bottoms can add their own under "Something else" in each category (M2).
// Custom activities use the same shape with `custom: true` and behave exactly
// like these built-in ones, including every design rule.
export const categories = [
    { id: 'bondage', label: 'Bondage' },
    { id: 'sensation', label: 'Sensation' },
    { id: 'impact', label: 'Impact' },
    { id: 'touch', label: 'Touch and intimacy' },
    { id: 'penetration', label: 'Penetration' }
];
const a = (category, id, label, extra = {}) => ({
    id,
    label,
    category,
    ...extra
});
export const activities = [
    // Bondage
    a('bondage', 'blindfold', 'Blindfolds'),
    a('bondage', 'collar-lead', 'Collar and lead'),
    a('bondage', 'soft-cuffs', 'Soft cuffs', { restraint: true }),
    a('bondage', 'metal-cuffs', 'Metal cuffs', { restraint: true }),
    a('bondage', 'gag', 'Gags'),
    a('bondage', 'rope', 'Rope', { restraint: true }),
    a('bondage', 'floor-bondage', 'Floor bondage', { restraint: true }),
    a('bondage', 'cross', 'Cross', { restraint: true }),
    a('bondage', 'bench', 'Bench', { restraint: true }),
    a('bondage', 'sex-swing', 'Sex swing', { restraint: true }),
    a('bondage', 'decorative-bondage', 'Decorative bondage', { restraint: true }),
    a('bondage', 'restrictive-bondage', 'Restrictive bondage', { restraint: true }),
    a('bondage', 'mental-bondage', 'Mental bondage'),
    a('bondage', 'mummification', 'Plastic wrap mummification', { restraint: true, edge: true }),
    // Sensation
    a('sensation', 'biting', 'Biting'),
    a('sensation', 'electricity', 'Electricity'),
    a('sensation', 'hair-pulling', 'Hair pulling'),
    a('sensation', 'knife-play', 'Knife play', { edge: true }),
    a('sensation', 'ass-worship', 'Ass worship'),
    a('sensation', 'licking', 'Licking'),
    a('sensation', 'foot-worship', 'Foot worship'),
    a('sensation', 'nipple-play', 'Nipple play'),
    a('sensation', 'scratching', 'Scratching'),
    a('sensation', 'sensory-deprivation', 'Sensory deprivation'),
    a('sensation', 'sharps', 'Sharps', { edge: true }),
    a('sensation', 'tickling', 'Tickling'),
    a('sensation', 'wax', 'Wax play'),
    a('sensation', 'choking', 'Choking', { edge: true }),
    a('sensation', 'erotic-massage', 'Erotic massage'),
    // Impact (feel, areas, positions, intensity and marks are asked separately)
    a('impact', 'bare-hand', 'Bare hand spanking', { impactLevel: 1 }),
    a('impact', 'gloved-hand', 'Gloved spanking', { impactLevel: 1 }),
    a('impact', 'butt-punching', 'Butt punching', { impactLevel: 3 }),
    a('impact', 'paddle', 'Paddles', { impactLevel: 2 }),
    a('impact', 'flogger', 'Floggers', { impactLevel: 2 }),
    a('impact', 'cane', 'Canes', { impactLevel: 4 }),
    a('impact', 'whip', 'Whips', { impactLevel: 4 }),
    // Touch and intimacy
    a('touch', 'cuddling', 'Cuddling'),
    a('touch', 'groping', 'Groping'),
    a('touch', 'body-kissing', 'Body kissing'),
    a('touch', 'mouth-kissing', 'Mouth kissing'),
    a('touch', 'hands-genitals', 'Hands on my genitals'),
    a('touch', 'toys-genitals', 'Toys on my genitals'),
    a('touch', 'orgasms', 'Orgasms'),
    a('touch', 'touch-top', 'Touching my Top’s genitals or strap-on'),
    a('touch', 'giving-oral', 'Giving oral sex', { stiCheck: 'always', negotiatedOnly: true }),
    a('touch', 'receiving-oral', 'Receiving oral sex', { stiCheck: 'always', negotiatedOnly: true }),
    a('touch', 'receiving-anal-licking', 'Receiving anal licking', { stiCheck: 'always', negotiatedOnly: true }),
    // Penetration
    a('penetration', 'fingers-mouth', 'Fingers in mouth'),
    a('penetration', 'fingers-vagina', 'Fingers in vagina or front hole', { anatomy: 'front-hole' }),
    a('penetration', 'fingers-anus', 'Fingers in anus'),
    a('penetration', 'penis-strap-mouth', 'Penis or strap-on in mouth', { stiCheck: 'if-penis', negotiatedOnly: true }),
    a('penetration', 'penis-strap-vagina', 'Penis or strap-on in vagina or front hole', { stiCheck: 'if-penis', negotiatedOnly: true, anatomy: 'front-hole' }),
    a('penetration', 'penis-strap-anus', 'Penis or strap-on in anus', { stiCheck: 'if-penis', negotiatedOnly: true }),
    a('penetration', 'toys-mouth', 'Toys in mouth'),
    a('penetration', 'toys-vagina', 'Toys in vagina or front hole', { anatomy: 'front-hole' }),
    a('penetration', 'toys-anus', 'Toys in anus')
];
/** "I want to feel" choices from the form (section 4, Purpose). */
export const feelings = [
    'Beautiful',
    'Release',
    'Controlled',
    'Degraded',
    'Dominated',
    'Energized',
    'Erotic',
    'Helpless',
    'Masochistic',
    'Overwhelmed',
    'Peaceful',
    'Playful',
    'Submissive'
];
export const feels = ['thuddy', 'stingy', 'sharp', 'other'];
/** Impact areas with risk shown on every beat. Kidneys are never a target (block rule). */
export const impactAreas = [
    { id: 'butt', label: 'Butt', risk: 'low' },
    { id: 'back-thigh', label: 'Back of thigh', risk: 'low' },
    { id: 'front-thigh', label: 'Front of thigh', risk: 'low' },
    { id: 'forearms', label: 'Forearms', risk: 'low' },
    { id: 'chest', label: 'Chest or breasts', risk: 'moderate' },
    { id: 'upper-back', label: 'Upper back', risk: 'moderate' },
    { id: 'upper-arm', label: 'Upper arm', risk: 'moderate' },
    { id: 'inner-thigh', label: 'Inner thigh', risk: 'moderate' },
    { id: 'calves', label: 'Calves', risk: 'moderate' },
    { id: 'soles', label: 'Soles of the feet', risk: 'moderate' },
    { id: 'face', label: 'Face', risk: 'high' },
    { id: 'genitals', label: 'Genitals', risk: 'high' }
];
export const impactPositions = [
    { id: 'all-fours', label: 'Kneeling (all fours)' },
    { id: 'prone', label: 'Lying flat (prone)' },
    { id: 'standing-cross', label: 'Standing (St. Andrew’s cross)' },
    { id: 'over-knee', label: 'Over the knee' }
];
export const markOptions = [
    { id: 'none', label: 'None' },
    { id: 'day', label: 'For the day' },
    { id: 'week', label: 'For the week' },
    { id: 'open', label: 'Open' }
];
/** Aftercare extras from the form; the aftercare map sets the overall style. */
export const aftercareExtras = [
    'Water',
    'Salty snack',
    'Sweet snack',
    'Leave me alone',
    'Blanket',
    'Cuddling',
    'Booty rubs',
    'Comfort item',
    'Talk about the scene',
    'Snuggly clothes',
    'Socialize',
    'Check in tomorrow',
    'Hammock swinging'
];
export const experienceLevels = [
    { id: 'new', label: 'New to this, first time or close to it' },
    { id: 'some', label: 'Some experience, comfortable with basics' },
    { id: 'experienced', label: 'Experienced, know my body and limits well' },
    { id: 'returning', label: 'Experienced, but it has been a while' }
];
/** Speak-up answers. Anything but "right away" sets the self-advocacy flag. */
export const speakUpLevels = [
    { id: 'natural', label: 'I speak up right away, it comes naturally', selfAdvocacyFlag: false },
    { id: 'needs-asking', label: 'I can speak up, but may need to be asked directly', selfAdvocacyFlag: true },
    { id: 'goes-quiet', label: 'I tend to go quiet, freeze or shut down when something is wrong', selfAdvocacyFlag: true },
    { id: 'soft-okay', label: 'In the past I have said yes, stayed silent or said “I’m okay” when I needed to stop', selfAdvocacyFlag: true },
    { id: 'learning', label: 'I am still learning this about myself', selfAdvocacyFlag: true }
];
