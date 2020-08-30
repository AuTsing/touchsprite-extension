import * as vscode from 'vscode';
import * as dgram from 'dgram';
import Server from './Server';
import Ui, { StatusBarType } from './UI';

export interface IRawDevice {
    ip: string;
}

class DeviceSearcher {
    private readonly _finder = dgram.createSocket('udp4');
    private readonly _sender = dgram.createSocket('udp4');
    private _list: IRawDevice[] = [];
    private readonly _server: Server;
    private readonly _ui: Ui;

    constructor(server: Server, ui: Ui) {
        this._server = server;
        this._ui = ui;
        this._finder.on('error', err => {
            this._ui.logging(`设备搜索器启用失败: ${err.toString()}`);
            this._finder.close();
        });
        this._finder.on('message', msg => {
            const device: IRawDevice = JSON.parse(msg.toString());
            this._list.push(device);
        });
        this._finder.bind(14088);
        this._sender.bind(() => this._sender.setBroadcast(true));
    }

    public search() {
        this._list = [];
        this._ui.setStatusBar('$(loading) 搜索设备中...');
        this._sender.send(`{ "ip": "${this._server.getHostIp()}", "port": 14088 }`, 14099, '255.255.255.255', err => {
            if (err) {
                this._ui.setStatusBarTemporary(StatusBarType.failed);
                this._ui.logging(`搜索设备失败: ${err.toString()}`);
                this._sender.close();
                return;
            }
            setTimeout(() => {
                this._ui.setStatusBarTemporary(StatusBarType.successful);
                this._ui.logging(`搜索完成: 共搜索到 ${this._list.length} 台设备`);
                const opts = this._list.map(rowDevice => rowDevice.ip);
                vscode.window.showQuickPick(opts).then(ip => {
                    if (!ip) {
                        return;
                    }
                    this._server.attachDevice(ip);
                });
            }, 1500);
        });
    }
}

export default DeviceSearcher;
