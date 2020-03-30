import * as vscode from 'vscode';
import * as path from 'path';
import * as dgram from 'dgram';
import { Server } from './Server';

export class KnownDevice extends vscode.TreeItem {
    info: any;
    constructor(public readonly label: string, info: any) {
        super(label);
        this.info = info;
    }
    iconPath = path.join(__filename, '..', '..', 'images', 'phone_known_device.png');
    contextValue = 'knownDevice';
}

export class DeviceSearcher implements vscode.TreeDataProvider<KnownDevice> {
    readonly finder = dgram.createSocket('udp4');
    readonly sender = dgram.createSocket('udp4');
    private list: KnownDevice[] = [];

    constructor() {
        this.finder.on('error', err => {
            vscode.window.showErrorMessage(`设备管理服务器异常：${err.stack}`);
            this.finder.close();
        });
        this.finder.on('message', msg => {
            // console.log(`服务器接收到来自 ${rinfo.address}:${rinfo.port} 的 ${msg}`);
            let device = JSON.parse(msg.toString());
            if (!this.isInArray(device)) {
                this.list.push(new KnownDevice(device.ip, device));
            }
            this.refresh();
        });
        this.finder.on('listening', () => {
            const address = this.finder.address();
            console.log(`服务器监听 ${address.address}:${address.port}`);
        });
        this.finder.bind(14088);
        this.sender.bind(() => {
            this.sender.setBroadcast(true);
        });
    }

    private _onDidChangeTreeData: vscode.EventEmitter<KnownDevice | undefined> = new vscode.EventEmitter<KnownDevice | undefined>();
    readonly onDidChangeTreeData: vscode.Event<KnownDevice | undefined> = this._onDidChangeTreeData.event;

    getTreeItem(element: KnownDevice): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: KnownDevice | undefined): vscode.ProviderResult<KnownDevice[]> {
        return this.list;
    }
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    isInArray(device: any) {
        for (var i = 0; i < this.list.length; i++) {
            if (device.ip === this.list[i].label) {
                return true;
            }
        }
        return false;
    }

    Search() {
        this.sender.send('{ "ip": "192.168.6.100", "port": 14088 }', 14099, '255.255.255.255', err => {
            if (err) {
                console.log(err);
                this.sender.close();
            }
        });
    }
    Connect(element: KnownDevice, server: Server) {
        console.log(element);
        server.Connect(element.label);
    }
}
