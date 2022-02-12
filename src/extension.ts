import * as Vscode from 'vscode';
import Touchsprite from './components/Touchsprite';
import { useOutput } from './components/Ui';

export function activate(context: Vscode.ExtensionContext) {
    const touchsprite = new Touchsprite();
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.attach-device-by-input', () => touchsprite.attachDeviceByInput()));

    const output = useOutput();
    output.info('触动插件已启用', 1);
}

export function deactivate() {}
