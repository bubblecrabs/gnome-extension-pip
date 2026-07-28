import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const CORNER_VALUES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

function cornerLabel(corner: string): string {
    switch (corner) {
        case 'top-left': return 'Top Left';
        case 'top-right': return 'Top Right';
        case 'bottom-right': return 'Bottom Right';
        case 'bottom-left': return 'Bottom Left';
        default: return corner;
    }
}

export default class PiPManagerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        const positionGroup = new Adw.PreferencesGroup({
            title: 'Placement',
            description: 'Control where PiP windows appear on screen',
        });
        page.add(positionGroup);

        const cornerRow = new Adw.ComboRow({
            title: 'Default Corner',
            model: new Gtk.StringList({
                strings: CORNER_VALUES.map(cornerLabel),
            }),
        });
        const currentCorner = settings.get_string('corner');
        cornerRow.selected = Math.max(0, CORNER_VALUES.indexOf(currentCorner));
        cornerRow.connect('notify::selected', () => {
            settings.set_string('corner', CORNER_VALUES[cornerRow.selected]);
        });
        positionGroup.add(cornerRow);

        const offsetRow = new Adw.SpinRow({
            title: 'Screen Edge Offset',
            subtitle: 'Distance from the screen corner in pixels',
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 1,
                value: settings.get_int('offset'),
            }),
        });
        offsetRow.connect('notify::value', () => {
            settings.set_int('offset', offsetRow.value);
        });
        positionGroup.add(offsetRow);

        const behaviourGroup = new Adw.PreferencesGroup({
            title: 'Behaviour',
            description: 'Configure PiP window attributes',
        });
        page.add(behaviourGroup);

        const alwaysOnTopRow = new Adw.SwitchRow({
            title: 'Always on Top',
            subtitle: 'Keep PiP window above all other windows',
            active: settings.get_boolean('always-on-top'),
        });
        settings.bind(
            'always-on-top',
            alwaysOnTopRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        behaviourGroup.add(alwaysOnTopRow);

        const proportionalResizeRow = new Adw.SwitchRow({
            title: 'Proportional Resize',
            subtitle: 'Maintain video aspect ratio when resizing the PiP window',
            active: settings.get_boolean('proportional-resize'),
        });
        settings.bind(
            'proportional-resize',
            proportionalResizeRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT,
        );
        behaviourGroup.add(proportionalResizeRow);

        window.add(page);

        return Promise.resolve();
    }
}
