import * as vscode from 'vscode';
import * as path from 'path';
import * as dgram from 'dgram';
import * as os from 'os';
import Server from './Server';

export class KnownDevice extends vscode.TreeItem {
    info: any;
    constructor(public readonly label: string, info: any) {
        super(label);
        this.info = info;
    }
    iconPath = path.join(__filename, '..', '..', 'assets', 'images', 'phone_known_device.png');
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

    public getTreeItem(element: KnownDevice): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    public getChildren(element?: KnownDevice | undefined): vscode.ProviderResult<KnownDevice[]> {
        return this.list;
    }
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    public isInArray(device: any) {
        for (var i = 0; i < this.list.length; i++) {
            if (device.ip === this.list[i].label) {
                return true;
            }
        }
        return false;
    }

    private getLogIp(): Promise<string> {
        let interfaces = os.networkInterfaces();
        return new Promise<string>(resolve => {
            for (let devName in interfaces) {
                let iface = interfaces[devName];
                for (let i = 0; i < iface.length; i++) {
                    let alias = iface[i];
                    if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                        resolve(alias.address);
                    }
                }
            }
        });
    }
    public search() {
        this.getLogIp().then(ip => {
            this.sender.send(`{ "ip": "${ip}", "port": 14088 }`, 14099, '255.255.255.255', err => {
                if (err) {
                    console.log(err);
                    this.sender.close();
                }
            });
        });
    }
    public connect(element: KnownDevice, server: Server) {
        // console.log(element);
        server
            .connect(element.label)
            .then(msg => vscode.window.setStatusBarMessage(msg))
            .catch(err => vscode.window.showErrorMessage(err));
    }
}
