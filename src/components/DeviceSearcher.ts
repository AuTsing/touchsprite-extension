import * as Vscode from 'vscode';
import * as Dgram from 'dgram';
import StatusBar from './StatusBar';
import Output from './Output';

export interface TsSearchDevice {
    ip: string;
    devname: string;
    osType: 'iOS' | 'Android';
}

export default class DeviceSearcher {
    private readonly hostIp: string;

    constructor(hostIp: string) {
        this.hostIp = hostIp;
    }

    public async search(): Promise<TsSearchDevice> {
        const doing = StatusBar.doing('搜索中');
        const port: number = Math.round(Math.random() * (19999 - 15000 + 1) + 15000);
        const devices: TsSearchDevice[] = [];
        const searcher = Dgram.createSocket('udp4');
        const sender = Dgram.createSocket('udp4');

        let selecting = false;
        let selected = false;
        let lastQuickPick: Thenable<string | undefined> | null = null;
        return new Promise((resolve, reject) => {
            searcher.on('message', async msg => {
                if (selected) {
                    return;
                }
                selecting = true;

                const newSearchDevice = JSON.parse(msg.toString()) as TsSearchDevice;
                if (devices.every(device => device.ip !== newSearchDevice.ip)) {
                    devices.push(newSearchDevice);
                }

                const list = devices.map(device => `${device.devname}: ${device.ip}`);
                const quickPick = Vscode.window.showQuickPick(list);
                lastQuickPick = quickPick;
                const selection = await quickPick;
                if (quickPick !== lastQuickPick) {
                    return;
                }
                if (selection === undefined) {
                    selecting = false;
                    selected = true;
                    reject('未选择设备');
                    return;
                }

                selecting = false;
                selected = true;
                const device = devices[list.indexOf(selection!!)];
                if (device) {
                    resolve(device);
                } else {
                    reject('未选择设备');
                }
            });
            searcher.on('error', e => reject(e.message));
            searcher.bind(port, this.hostIp);

            sender.bind(0, this.hostIp, () => sender.setBroadcast(true));
            sender.send(`{ "ip": "${this.hostIp}", "port": ${port} }`, 14099, '255.255.255.255', e => {
                if (e) {
                    searcher.close();
                    sender.close();
                    doing?.dispose();
                    reject(e.message);
                    return;
                }
                setTimeout(() => {
                    searcher.close();
                    sender.close();
                    Output.printlnAndShow('搜索成功:', `共搜索到 ${devices.length} 台设备`);
                    doing?.dispose();
                    if (!selecting && !selected) {
                        reject('未选择设备');
                    }
                }, 3000);
            });
        });
    }
}
