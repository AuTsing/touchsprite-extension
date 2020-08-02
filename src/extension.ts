import * as vscode from 'vscode';
import Server from './Server';
import { DeviceSearcher, KnownDevice } from './DeviceSearcher';
import Snapshoter from './view/Snapshoter';

const server = new Server();

class Extension {
    public TsStartServer() {
        server.logging('触动服务已启动');
    }
    public TsConnect() {
        server
            .inputIp()
            .then(ip => server.connect(ip))
            .then(msg => vscode.window.setStatusBarMessage(msg))
            .catch(err => vscode.window.showErrorMessage(err));
    }
    public TsGetPicture() {
        server
            .getPicture()
            .then(msg => vscode.window.showInformationMessage(msg))
            .catch(err => vscode.window.showErrorMessage(err));
    }
    private TsRun() {
        server
            .setLogServer()
            .then(msg => {
                console.log(msg);
                return server.upload();
            })
            .then(msg => {
                console.log(msg);
                return server.uploadIncludes();
            })
            .then(msg => {
                console.log(msg);
                return server.setLuaPath();
            })
            .then(msg => {
                console.log(msg);
                return server.runLua();
            })
            .then(msg => {
                server.logging(msg);
            })
            .catch(err => vscode.window.showErrorMessage(err));
    }
    public TsRunProject() {
        server.setRunFile('prod');
        return this.TsRun();
    }
    public TsRunTest() {
        server.setRunFile('dev');
        return this.TsRun();
    }
    public TsStopProject() {
        server
            .stopLua()
            .then(msg => {
                server.logging(msg);
            })
            .catch(err => vscode.window.showErrorMessage(err));
    }
    public TsZip() {
        server
            .zipProject()
            .then(msg => vscode.window.showInformationMessage(msg))
            .catch(err => vscode.window.showErrorMessage(err));
    }
    public TsTest() {
        let config = vscode.workspace.getConfiguration();
        console.log(config);
    }
}

type K = keyof Extension;

const commands: K[] = ['TsStartServer', 'TsConnect', 'TsRunProject', 'TsRunTest', 'TsStopProject', 'TsZip', 'TsTest'];

export function activate(context: vscode.ExtensionContext) {
    const extension = new Extension();
    commands.forEach(command => {
        let action: Function = extension[command];
        context.subscriptions.push(vscode.commands.registerCommand('extension.' + command, action.bind(extension)));
    });

    const deviceSearcher = new DeviceSearcher();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('known-devices', deviceSearcher));
    context.subscriptions.push(vscode.commands.registerCommand('tree.search', () => deviceSearcher.search()));
    context.subscriptions.push(vscode.commands.registerCommand('tree.connect', (node: KnownDevice) => deviceSearcher.connect(node, server)));

    const snapshoter = new Snapshoter(context, server);
    context.subscriptions.push(vscode.commands.registerCommand('extension.snapshotor', () => snapshoter.showSnapshoter()));

    vscode.window.setStatusBarMessage('触动服务已启用：未连接设备');
}

export function deactivate() {}
