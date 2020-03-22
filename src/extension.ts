import * as vscode from 'vscode';
import { Server } from './Server';

let server = new Server();

class Extension {
    TsStartServer() {
        vscode.window.showInformationMessage('触动服务已启动');
    }
    TsConnect() {
        server.ReceiveIp().then(
            ip => {
                return server.Connect(ip);
            },
            () => {
                console.log('用户取消连接');
            }
        );
    }
    TsGetStatus() {
        server.GetStatus();
    }
    TsGetPicture() {
        server.GetPicture();
    }
    TsRunProject() {
        Promise.resolve(server.SetLogServer())
            .then(() => {
                return server.Upload();
            })
            .then(() => {
                return server.UploadInclude();
            })
            .then(() => {
                return server.SetLuaPath();
            })
            .then(() => {
                return server.RunLua();
            })
            .catch(err => console.log(err));
    }
    TsStopProject() {
        server.StopLua();
    }
    TsZip() {
        server.ZipProject();
    }
    TsTest() {
        Promise.resolve(server.Connect('192.168.6.110')).then(() => {
            return server.MyTest();
        });
    }
}

type K = keyof Extension;

let commands: K[];
commands = ['TsStartServer', 'TsConnect', 'TsGetStatus', 'TsGetPicture', 'TsRunProject', 'TsStopProject', 'TsZip', 'TsTest'];

let extension = new Extension();

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('触动扩展已启用');
    commands.forEach(command => {
        let action: Function = extension[command];
        context.subscriptions.push(vscode.commands.registerCommand('extension.' + command, action.bind(extension)));
    });
}

export function deactivate() {}
