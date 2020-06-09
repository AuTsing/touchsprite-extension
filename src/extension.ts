import * as vscode from 'vscode';
import Server from './Server';
import { DeviceSearcher, KnownDevice } from './DeviceSearcher';

const server = new Server();
const deviceSearcher = new DeviceSearcher();

class Extension {
    TsStartServer() {
        server.logging('触动服务已启动');
    }
    TsConnect() {
        server
            .inputIp()
            .then(ip => server.connect(ip))
            .then(msg => server.logging(msg))
            .catch(err => vscode.window.showErrorMessage(err));
    }
    TsGetPicture() {
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
    TsRunProject() {
        server.setRunFile('prod');
        return this.TsRun();
    }
    TsRunTest() {
        server.setRunFile('dev');
        return this.TsRun();
    }
    TsStopProject() {
        server
            .stopLua()
            .then(msg => {
                server.logging(msg);
            })
            .catch(err => vscode.window.showErrorMessage(err));
    }
    TsZip() {
        server
            .zipProject()
            .then(msg => vscode.window.showInformationMessage(msg))
            .catch(err => vscode.window.showErrorMessage(err));
    }
    TsTest() {
        server
            .connect('192.168.6.111')
            .then(msg => {
                server.logging(msg);
                return server.upload();
            })
            .then(msg => console.log(msg))
            .catch(err => console.log(err));
    }
}

type K = keyof Extension;

let commands: K[];
commands = ['TsStartServer', 'TsConnect', 'TsGetPicture', 'TsRunProject', 'TsRunTest', 'TsStopProject', 'TsZip', 'TsTest'];

let extension = new Extension();

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('触动扩展已启用');
    commands.forEach(command => {
        let action: Function = extension[command];
        context.subscriptions.push(vscode.commands.registerCommand('extension.' + command, action.bind(extension)));
    });
    vscode.window.registerTreeDataProvider('known-devices', deviceSearcher);
    vscode.commands.registerCommand('tree.search', () => deviceSearcher.search());
    vscode.commands.registerCommand('tree.connect', (node: KnownDevice) => deviceSearcher.connect(node, server));
}

export function deactivate() {}
