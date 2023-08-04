import * as Vscode from 'vscode';
import Releaser from './components/Releaser';
import Touchsprite from './components/Touchsprite';
import Zipper from './components/Zipper';
import Output from './components/Output';
import StatusBar from './components/StatusBar';
import Storage from './components/Storage';
import Asker from './components/Asker';
import Workspace from './components/Workspace';
import Server from './components/Server';

export function activate(context: Vscode.ExtensionContext) {
    Output.instance = new Output(context);
    context.subscriptions.push(Output.instance);

    StatusBar.instance = new StatusBar();
    context.subscriptions.push(StatusBar.instance);
    context.subscriptions.push(
        Vscode.commands.registerCommand('touchsprite-extension.clickStatusBarItem', () => StatusBar.instance?.handleClickStatusBarItem())
    );

    const storage = new Storage(context);
    const asker = new Asker(storage);
    const workspace = new Workspace();

    const touchsprite = new Touchsprite(storage, asker, workspace);
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.attachDeviceByInput', () => touchsprite.handleAttachDeviceByInput()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.attachDeviceBySearch', () => touchsprite.handleAttachDeviceBySearch()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.detachDevice', () => touchsprite.handleDetachDevice()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.runProject', () => touchsprite.handleRunProject()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.runTestProject', () => touchsprite.handleRunTestProject()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.runScript', () => touchsprite.handleRunScript()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.stopScript', () => touchsprite.handleStopScript()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.uploadFile', () => touchsprite.handleUploadFile()));
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.clearScript', () => touchsprite.handleClearScript()));

    const zipper = new Zipper(storage);
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.zipProject', () => zipper.handleZipProject()));

    const releaser = new Releaser(storage, asker);
    context.subscriptions.push(Vscode.commands.registerCommand('touchsprite-extension.releaseProject', () => releaser.handleRelease()));

    const server = new Server(touchsprite);
    context.subscriptions.push(server);
}

export function deactivate() {}
