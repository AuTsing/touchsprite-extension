import * as vscode from 'vscode';
import * as dgram from 'dgram';
import Server from './Server';
import Ui from './ui/Ui';
import { StatusBarType } from './ui/StatusBar';

export interface IRawDevice {
    ip: string;
    devname: string;
}

class DeviceSearcher {
    private readonly _finder: dgram.Socket;
    private readonly _sender: dgram.Socket;
    private _list: IRawDevice[] = [];
    private readonly _server: Server;

    constructor(server: Server) {
        this._server = server;

        this._finder = dgram.createSocket('udp4');
        this._finder.on('error', err => {
            Ui.logging(`设备搜索器启用失败: ${err.toString()}`);
            this._finder.close();
        });
        this._finder.on('message', msg => {
            const device: IRawDevice = JSON.parse(msg.toString());
            if (this._list.every(dv => dv.ip !== device.ip)) {
                this._list.push(device);
            }
            if (!this._server.getAttachingDevice()) {
                const opts = this._list.map(rowDevice => rowDevice.devname + ': ' + rowDevice.ip);
                vscode.window.showQuickPick(opts).then(opt => {
                    if (!opt) {
                        return;
                    }
                    const ip = opt.match(/: (\S*)/)![1];
                    this._server.attachDevice(ip);
                });
            }
        });
        this._finder.bind(14088);

        this._sender = dgram.createSocket('udp4');
        this._sender.bind(() => this._sender?.setBroadcast(true));
    }

    public search() {
        this._server.detachDevice();
        this._list = [];
        Ui.setStatusBar('$(loading) 搜索设备中...');
        this._sender.send(`{ "ip": "${this._server.getHostIp()}", "port": 14088 }`, 14099, '255.255.255.255', err => {
            if (err) {
                Ui.setStatusBarTemporary(StatusBarType.failed);
                Ui.logging(`搜索设备失败: ${err.toString()}`);
                this._finder.close();
                this._sender.close();
                return;
            }
            setTimeout(() => {
                Ui.setStatusBarTemporary(StatusBarType.successful);
                Ui.logging(`搜索完成: 共搜索到 ${this._list.length} 台设备`);
            }, 3000);
        });
    }
}

export default DeviceSearcher;
