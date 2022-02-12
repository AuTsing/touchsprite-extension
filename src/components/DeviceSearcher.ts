import * as Vscode from 'vscode';
import * as Dgram from 'dgram';
import Touchsprite from './Touchsprite';
import * as Ui from './Ui';

export interface ITsSearchDevice {
    ip: string;
    devname: string;
    osType: 'iOS' | 'Android';
}

export default class DeviceSearcher {
    private readonly touchsprite: Touchsprite;
    private readonly output: Ui.Output;
    private readonly statusBar: Ui.StatusBar;
    private selected: boolean;

    constructor(touchsprite: Touchsprite) {
        this.touchsprite = touchsprite;
        this.output = Ui.useOutput();
        this.statusBar = Ui.useStatusBar();
        this.selected = false;
    }

    public async search(): Promise<ITsSearchDevice> {
        const doing = this.statusBar.doing('搜索中');

        this.selected = false;
        const device = await new Promise<ITsSearchDevice>((resolve, reject) => {
            const port: number = Math.round(Math.random() * (19999 - 15000 + 1) + 15000);
            const ip = this.touchsprite.getHostIp();
            const devices: ITsSearchDevice[] = [];

            const searcher = Dgram.createSocket('udp4');
            const sender = Dgram.createSocket('udp4');

            searcher.on('error', e => {
                searcher.close();
                sender.close();
                doing.dispose();
                reject(e);
            });
            searcher.on('message', async msg => {
                const newSearchDevice: ITsSearchDevice = JSON.parse(msg.toString());
                if (devices.every(device => device.ip !== newSearchDevice.ip)) {
                    devices.push(newSearchDevice);
                }
                if (!this.selected) {
                    const list = devices.map(device => `${device.devname}: ${device.ip}`);
                    const selectedDevice = await Vscode.window.showQuickPick(list);
                    if (selectedDevice) {
                        const device = devices[list.indexOf(selectedDevice)];
                        resolve(device);
                    }
                    this.selected = true;
                }
            });
            searcher.bind(port, ip);

            sender.bind(0, ip, () => sender.setBroadcast(true));
            sender.send(`{ "ip": "${ip}", "port": ${port} }`, 14099, '255.255.255.255', e => {
                if (e) {
                    searcher.close();
                    sender.close();
                    doing.dispose();
                    reject(e);
                    return;
                }
                setTimeout(() => {
                    searcher.close();
                    sender.close();
                    doing.dispose();
                    this.output.info(`搜索完成: 共搜索到 ${devices.length} 台设备`);
                }, 3000);
            });
        });

        return device;
    }
}
