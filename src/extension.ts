import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

interface PiPWindow extends Meta.Window {
    _pipSettingsChangedId?: number;
    _pipUnmanagingId?: number;
}

const PIP_TITLE_EXACT = [
    'picture-in-picture',
    'picture in picture',
];

type Corner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

const SNAP_THRESHOLD_RATIO = 0.15;

function isPiP(window: Meta.Window): boolean {
    if (!window || window.get_window_type() !== Meta.WindowType.NORMAL)
        return false;

    const title = (window.get_title() ?? '').toLowerCase();
    const wmClass = (window.get_wm_class() ?? '').toLowerCase();
    const wmInstance = (window.get_wm_class_instance() ?? '').toLowerCase();

    if (title && PIP_TITLE_EXACT.includes(title))
        return true;
    if (title.endsWith(' - pip'))
        return true;
    if (/picture.?in.?picture/i.test(title))
        return true;
    if (/picture.?in.?picture/i.test(wmClass))
        return true;
    if (/picture.?in.?picture/i.test(wmInstance))
        return true;

    return false;
}

function cornerPosition(
    corner: Corner,
    offset: number,
    workArea: { x: number; y: number; width: number; height: number },
    frameRect: { width: number; height: number },
): { x: number; y: number } {
    switch (corner) {
        case 'top-left':
            return { x: workArea.x + offset, y: workArea.y + offset };
        case 'top-right':
            return {
                x: workArea.x + workArea.width - frameRect.width - offset,
                y: workArea.y + offset,
            };
        case 'bottom-left':
            return {
                x: workArea.x + offset,
                y: workArea.y + workArea.height - frameRect.height - offset,
            };
        case 'bottom-right':
            return {
                x: workArea.x + workArea.width - frameRect.width - offset,
                y: workArea.y + workArea.height - frameRect.height - offset,
            };
    }
}

function moveToCorner(window: Meta.Window, corner: Corner, offset: number): void {
    const workArea = window.get_work_area_current_monitor();
    const frameRect = window.get_frame_rect();

    if (!frameRect.width || !frameRect.height)
        return;

    const { x, y } = cornerPosition(corner, offset, workArea, frameRect);
    window.move_frame(true, x, y);
}

function nearestCorner(window: Meta.Window): Corner {
    const workArea = window.get_work_area_current_monitor();
    const frameRect = window.get_frame_rect();

    const cx = frameRect.x + frameRect.width / 2;
    const cy = frameRect.y + frameRect.height / 2;
    const onLeft = cx < workArea.x + workArea.width / 2;
    const onTop = cy < workArea.y + workArea.height / 2;

    if (onLeft && onTop)
        return 'top-left';
    if (!onLeft && onTop)
        return 'top-right';
    if (onLeft)
        return 'bottom-left';
    return 'bottom-right';
}

export default class PiPManager extends Extension {
    private _settings?: Gio.Settings;
    private _windowCreatedId?: number;
    private _grabOpEndId?: number;
    private _pendingIdles: Set<number> = new Set();
    private _managedWindows: Set<PiPWindow> = new Set();

    enable(): void {
        this._settings = this.getSettings();

        this._windowCreatedId = global.display.connect(
            'window-created',
            (_display: Meta.Display, window: Meta.Window) => {
                const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    this._pendingIdles.delete(id);

                    if (!isPiP(window))
                        return GLib.SOURCE_REMOVE;

                    this._setupPiP(window as PiPWindow);
                    return GLib.SOURCE_REMOVE;
                });
                this._pendingIdles.add(id);
            },
        );

        this._grabOpEndId = global.display.connect(
            'grab-op-end',
            (_display: Meta.Display, window: Meta.Window, op: Meta.GrabOp) => {
                if (!window || !isPiP(window))
                    return;
                if (op !== Meta.GrabOp.MOVING && op !== Meta.GrabOp.KEYBOARD_MOVING)
                    return;

                this._snapToNearestCornerIfClose(window);
            },
        );
    }

    disable(): void {
        if (this._windowCreatedId !== undefined) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = undefined;
        }

        if (this._grabOpEndId !== undefined) {
            global.display.disconnect(this._grabOpEndId);
            this._grabOpEndId = undefined;
        }

        for (const id of this._pendingIdles)
            GLib.source_remove(id);
        this._pendingIdles.clear();

        for (const window of [...this._managedWindows])
            this._teardownPiP(window);
        this._managedWindows.clear();

        this._settings = undefined;
    }

    private _snapToNearestCornerIfClose(window: Meta.Window): void {
        const settings = this._settings!;
        const workArea = window.get_work_area_current_monitor();
        const frameRect = window.get_frame_rect();
        const offset = settings.get_int('offset');
        const corner = nearestCorner(window);
        const target = cornerPosition(corner, offset, workArea, frameRect);

        const distance = Math.hypot(frameRect.x - target.x, frameRect.y - target.y);
        const threshold = Math.min(workArea.width, workArea.height) * SNAP_THRESHOLD_RATIO;

        if (distance > threshold)
            return;

        settings.set_string('corner', corner);
        moveToCorner(window, corner, offset);
    }

    private _setupPiP(window: PiPWindow): void {
        const settings = this._settings!;

        this._managedWindows.add(window);

        if (settings.get_boolean('always-on-top'))
            window.make_above();
        else
            window.unmake_above();

        const corner = settings.get_string('corner') as Corner;
        const offset = settings.get_int('offset');

        const actor = window.get_compositor_private();
        if (actor) {
            const firstFrameId = actor.connect('first-frame', () => {
                actor.disconnect(firstFrameId);
                moveToCorner(window, corner, offset);
            });
        } else {
            moveToCorner(window, corner, offset);
        }

        window._pipSettingsChangedId = settings.connect('changed', (_s, key: string) => {
            if (key === 'always-on-top') {
                if (settings.get_boolean('always-on-top'))
                    window.make_above();
                else
                    window.unmake_above();
            }
        });

        window._pipUnmanagingId = window.connect('unmanaging', () => {
            this._teardownPiP(window);
        });
    }

    private _teardownPiP(window: PiPWindow): void {
        if (window._pipSettingsChangedId !== undefined) {
            this._settings?.disconnect(window._pipSettingsChangedId);
            window._pipSettingsChangedId = undefined;
        }

        if (window._pipUnmanagingId !== undefined) {
            window.disconnect(window._pipUnmanagingId);
            window._pipUnmanagingId = undefined;
        }

        this._managedWindows.delete(window);
    }
}
