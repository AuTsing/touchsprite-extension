import * as vscode from 'vscode';
import Server from './components/Server';
import DeviceSearcher from './components/DeviceSearcher';
import Snapshoter from './view/Snapshoter';
import Ui from './components/ui/Ui';
import Publisher from './components/Publisher';

import LuaConfigurationProvider from './components/debug/LuaConfigurationProvider';
import LuaDebugAdapterServerDescriptorFactory from './components/debug/LuaDebugAdapterServerDescriptorFactory';
import Tools from './components/debug/Tools';

export function activate(context: vscode.ExtensionContext) {
    const server = new Server(context);
    context.subscriptions.push(vscode.commands.registerCommand('extension.startServer', () => Ui.logging('触动插件已启用')));
    context.subscriptions.push(vscode.commands.registerCommand('extension.connect', () => server.attachDeviceThroughInput()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.disconnect', () => server.detachDevice()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.menu', () => server.operationsMenu()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runProject', () => server.runProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runTestProject', () => server.runTestProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runScript', () => server.runScript()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.stopScript', () => server.stopScript()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.zipProject', () => server.zipProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.uploadFile', () => server.uploadFile()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.setHostIp', () => server.setHostIp()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.debug', () => server.debug()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.test', () => {}));

    const publisher = new Publisher(server);
    context.subscriptions.push(vscode.commands.registerCommand('extension.publish', () => publisher.publish()));

    const dvs = new DeviceSearcher(server);
    context.subscriptions.push(vscode.commands.registerCommand('extension.search', () => dvs.search()));

    const snapshoter = new Snapshoter(context, server);
    context.subscriptions.push(vscode.commands.registerCommand('extension.snapshoter', () => snapshoter.show()));

    const provider = new LuaConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('lua', provider));
    const factory = new LuaDebugAdapterServerDescriptorFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('lua', factory));
    context.subscriptions.push(factory);

    const pkg = require(context.extensionPath + '/package.json');
    Tools.adapterVersion = pkg.version;
    Tools.vscodeExtensionPath = context.extensionPath;
}

export function deactivate() {}
