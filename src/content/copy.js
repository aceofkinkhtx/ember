// Interface wording that changes with discreet mode, plus fixed safety copy.
// Copy rule: never use an em dash anywhere (a test enforces this).
const tabLabels = {
    home: { plain: 'Home', discreet: 'Home' },
    connections: { plain: 'Connections', discreet: 'People' },
    scenes: { plain: 'Scenes', discreet: 'Plans' },
    toys: { plain: 'Gear', discreet: 'Kit' },
    profile: { plain: 'Profile', discreet: 'Profile' },
    me: { plain: 'Me', discreet: 'Me' }
};
export const tabsByRole = {
    top: ['home', 'connections', 'scenes', 'toys', 'me'],
    bottom: ['home', 'connections', 'scenes', 'profile', 'me']
};
export function tabLabel(tab, discreet) {
    return discreet ? tabLabels[tab].discreet : tabLabels[tab].plain;
}
/** A role in a connection can also be S/switch: either way, decided scene by scene. Written "S/switch" wherever it names the role. */
export function roleLabel(role, discreet) {
    if (role === 'switch')
        return discreet ? 'Either' : 'S/switch';
    if (discreet)
        return role === 'top' ? 'Lead' : 'Share';
    return role === 'top' ? 'Top' : 'bottom';
}
/** Notification wording. In discreet mode it never hints at the content. */
export const notificationText = {
    dailyTip: { plain: "Today's tip is ready", discreet: 'Your daily note is ready' },
    checkIn: { plain: 'Time to check in after your scene', discreet: 'You have a reminder' }
};
export function notification(kind, discreet) {
    return discreet ? notificationText[kind].discreet : notificationText[kind].plain;
}
/** The safety floor. No setting can remove any of these. */
export const safetyFloor = [
    {
        title: 'Safe words, said aloud',
        detail: 'Signals are confirmed out loud together at the start of every scene.'
    },
    {
        title: 'Limits always on screen',
        detail: 'The limit strip stays visible through the whole scene: no in red, maybe in amber, physical care in blue.'
    },
    {
        title: 'Aftercare, every time',
        detail: 'Every scene has an aftercare phase, with more time available whenever it is needed.'
    },
    {
        title: 'Sub drop is planned for',
        detail: 'Right after the scene, you both check in on how you feel. For 3 days after, you each get a quick daily check-in, because drop can hit Tops and bottoms alike.'
    },
    {
        title: 'Ready before starting',
        detail: 'A readiness check happens before every scene begins.'
    },
    {
        title: 'Triggers where they matter',
        detail: 'Trauma and trigger flags appear as warnings on the moments they are most likely to come up.'
    }
];
