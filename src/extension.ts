'use strict';
import * as vscode from 'vscode';
import { Server, Device } from './touchsprite';

let server = new Server();

class Extension {
	TsStartServer() {
		console.log("手动启动服务");
	}
	TsConnect() {
		server.ReceiveIp()
			.then((ip) => {
				return server.Connect(ip);
			}, () => { console.log("用户取消连接") })
	}
	TsGetStatus() {
		server.GetStatus();
	}
	TsGetPicture() {
		server.GetPicture();
	}
	TsRunProject() {
		Promise.resolve(server.Upload())
			.then(() => {
				return server.SetLuaPath();
			})
			.then(() => {
				return server.RunLua()
			})
			.catch(err => console.log(err));
	}
	TsStopProject() {
		server.StopLua();
	}
};

type K = keyof Extension;

let commands: K[];
commands = ['TsStartServer', "TsConnect", "TsGetStatus", "TsGetPicture", "TsRunProject", "TsStopProject"];

let extension = new Extension();

export function activate(context: vscode.ExtensionContext) {
	console.log('触动扩展已启用');
	commands.forEach((command) => {
		let action: Function = extension[command];
		context.subscriptions.push(vscode.commands.registerCommand('extension.' + command, action.bind(extension)));
	})
}

export function deactivate() {

}