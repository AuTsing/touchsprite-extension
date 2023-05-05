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
        let searched = false;
        return new Promise((resolve, reject) => {
            searcher.on('message', async msg => {
                selecting = true;

                const newSearchDevice = JSON.parse(msg.toString()) as TsSearchDevice;
                if (devices.every(device => device.ip !== newSearchDevice.ip)) {
                    devices.push(newSearchDevice);
                }

                const list = devices.map(device => `${device.devname}: ${device.ip}`);
                const selection = await Vscode.window.showQuickPick(list);
                if (selection === undefined && !searched) {
                    selecting = false;
                    return;
                }
                if (selection === undefined && searched) {
                    reject('未选择设备');
                    selecting = false;
                    return;
                }

                const device = devices[list.indexOf(selection!!)];
                if (device) {
                    resolve(device);
                } else {
                    reject('未选择设备');
                }
                selecting = false;
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
                    searched = true;
                    return;
                }
                setTimeout(() => {
                    searcher.close();
                    sender.close();
                    Output.printlnAndShow('搜索成功:', `共搜索到 ${devices.length} 台设备`);
                    doing?.dispose();
                    searched = true;
                    if (!selecting) {
                        reject('未选择设备');
                    }
                }, 3000);
            });
        });
    }
}
