import * as vscode from 'vscode';
import Server from './components/Server';
import Debugger from './components/Debuger';
import DeviceSearcher from './components/DeviceSearcher';
import Snapshoter from './view/Snapshoter';
import Ui from './components/ui/Ui';
import Publisher from './components/Publisher';
import LuaConfigurationProvider from './components/debug/LuaConfigurationProvider';
import LuaDebugAdapterServerDescriptorFactory from './components/debug/LuaDebugAdapterServerDescriptorFactory';
import Tools from './components/debug/Tools';

export function activate(context: vscode.ExtensionContext) {
    const server = new Server();
    context.subscriptions.push(vscode.commands.registerCommand('extension.startServer', () => Ui.output('触动插件已启用', 1)));
    context.subscriptions.push(vscode.commands.registerCommand('extension.attachDeviceThroughInput', () => server.attachDeviceThroughInput()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.detachDevice', () => server.detachDevice()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.menus', () => server.deviceMenus()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runProject', () => server.runProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runTestProject', () => server.runTestProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runScript', () => server.runScript()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.stopScript', () => server.stopScript()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.zipProject', () => server.zipProject()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.uploadFiles', () => server.uploadFiles()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.setHostIp', () => server.setHostIp()));

    const debuger = new Debugger(server, context);
    context.subscriptions.push(vscode.commands.registerCommand('extension.debug', () => debuger.debug()));

    const publisher = new Publisher();
    context.subscriptions.push(vscode.commands.registerCommand('extension.publish', () => publisher.publish()));
    context.subscriptions.push(vscode.commands.registerCommand('extension.inquiry', () => publisher.inquiry()));

    const deviceSearcher = new DeviceSearcher(server);
    context.subscriptions.push(vscode.commands.registerCommand('extension.attachDeviceThroughSearch', () => deviceSearcher.search()));

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

    context.subscriptions.push(vscode.commands.registerCommand('extension.test', () => server.test()));

    vscode.commands.executeCommand('extension.startServer');
}

export function deactivate() {}
