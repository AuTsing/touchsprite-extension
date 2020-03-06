'use strict';
import * as vscode from 'vscode';
import { Server, Device } from './touchsprite';

let server = new Server();

class Extension {
	TsStartServer() {
		console.log("hello");
	}
	TsConnect(ip: string = "192.168.6.111") {
		server.Connect(ip);
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
				console.log("准备设置路径");
				return server.SetLuaPath();
			})
			.then(() => {
				console.log("准备运行脚本")
				return server.RunLua()
			})
			.catch(err => console.log(err));
	}
	TsStopProject() {
		server.StopLua();
	}
};


let commands: string[];
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