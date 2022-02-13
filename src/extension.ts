import * as Vscode from 'vscode';
import Touchsprite from './components/Touchsprite';
import { useOutput } from './components/Ui';

export function activate(context: Vscode.ExtensionContext) {
    const touchsprite = new Touchsprite(context);
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.attach-device-by-input', () => touchsprite.attachDeviceByInput()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.attach-device-by-search', () => touchsprite.attachDeviceBySearch()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.detach-device', () => touchsprite.detachDevice()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.run-project', () => touchsprite.runProject()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.run-test-project', () => touchsprite.runTestProject()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.run-script', () => touchsprite.runScript()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.stop-script', () => touchsprite.stopScript()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.upload-files', () => touchsprite.uploadFiles()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.clear-script', () => touchsprite.clearScript()));

    const output = useOutput();
    output.info('触动插件已启用', 1);
}

export function deactivate() {}
