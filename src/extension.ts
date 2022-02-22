import * as Vscode from 'vscode';
import Releaser from './components/Releaser';
import Touchsprite from './components/Touchsprite';
import Zipper from './components/Zipper';
import SnapshopV1 from './components/SnapshopV1';
import { useOutput, useStatusBar } from './components/Ui';

export function activate(context: Vscode.ExtensionContext) {
    const touchsprite = new Touchsprite(context);
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.attachDeviceByInput', () => touchsprite.attachDeviceByInput()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.attachDeviceBySearch', () => touchsprite.attachDeviceBySearch()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.detachDevice', () => touchsprite.detachDevice()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.runProject', () => touchsprite.runProject()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.runTestProject', () => touchsprite.runTestProject()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.runScript', () => touchsprite.runScript()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.stopScript', () => touchsprite.stopScript()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.uploadFile', () => touchsprite.uploadFile()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.clearScript', () => touchsprite.clearScript()));

    const zipper = new Zipper();
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.zipProject', () => zipper.zipProject()));

    const releaser = new Releaser();
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.releaseProject', () => releaser.release()));

    const snapshop = new SnapshopV1(context, touchsprite);
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.snapshopV1', () => snapshop.open()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.recommendSnapshopV2', () => snapshop.recommendSnapshopV2()));

    const statusBar = useStatusBar();
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.commandMenu', () => statusBar.menu()));

    const output = useOutput();
    output.info('触动插件已启用', 1);

    return { touchsprite };
}

export function deactivate() {}
