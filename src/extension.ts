import * as Vscode from 'vscode';
import Releaser from './components/Releaser';
import Touchsprite from './components/Touchsprite';
import { useOutput } from './components/Ui';
import Zipper from './components/Zipper';

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

    const zipper = new Zipper();
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.zip-project', () => zipper.zipProject()));

    const releaser = new Releaser();
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.release-project', () => releaser.release()));

    const output = useOutput();
    output.info('触动插件已启用', 1);
}

export function deactivate() {}
