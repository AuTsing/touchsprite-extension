import * as vscode from 'vscode';
import Server from './components/Server';
import Ui from './components/Ui';
import DeviceSearcher from './components/DeviceSearcher';
import Snapshoter from './view/Snapshoter';

export function activate(context: vscode.ExtensionContext) {
    const ui = new Ui();
    const server = new Server(ui);
    context.subscriptions.push(vscode.commands.registerCommand('extension.startServer', () => ui.logging('触动插件已启用')));
    context.subscriptions.push(vscode.commands.registerCommand('extension.connect', () => server.attachDeviceThroughInput()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.disconnect', () => server.detachDevice()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.menu', () => server.operationsMenu()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runProject', () => server.runProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runTestProject', () => server.runTestProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runScript', () => server.runScript()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.stopScript', () => server.stopScript()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.zipProject', () => server.zipProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.test', () => server.test()));

    const dvs = new DeviceSearcher(server, ui);
    context.subscriptions.push(vscode.commands.registerCommand('extension.search', () => dvs.search()));

    const snapshoter = new Snapshoter(context, server, ui);
    context.subscriptions.push(vscode.commands.registerCommand('extension.snapshoter', () => snapshoter.show()));
}

export function deactivate() {}
