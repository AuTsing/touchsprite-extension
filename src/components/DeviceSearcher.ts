import * as vscode from 'vscode';
import * as dgram from 'dgram';
import Server from './Server';
import Ui from './ui/Ui';

export interface IRawDevice {
    ip: string;
    devname: string;
}

class DeviceSearcher {
    private readonly server: Server;

    constructor(server: Server) {
        this.server = server;
    }

    public async search() {
        const statusBarDisposer = Ui.doing('搜索设备中');
        const port: number = Math.round(Math.random() * (19999 - 15000 + 1) + 15000);
        let isAttached: boolean = false;
        try {
            const devices: IRawDevice[] = [];
            const finder = dgram.createSocket('udp4');
            finder.on('error', err => {
                Ui.outputError(`搜索器启用失败: ${err.toString()}`);
                finder.close();
            });
            finder.on('message', buf => {
                const gotNewDevice: IRawDevice = JSON.parse(buf.toString());
                if (devices.every(device => device.ip !== gotNewDevice.ip)) {
                    devices.push(gotNewDevice);
                }
                if (!isAttached) {
                    vscode.window.showQuickPick(devices.map(device => `${device.devname}: ${device.ip}`)).then(selected => {
                        if (selected) {
                            isAttached = true;
                            const ip = selected.match(/: (\S*)/)![1];
                            this.server.attachDevice(ip);
                        }
                    });
                }
            });
            finder.bind(port);

            const sender = dgram.createSocket('udp4');
            sender.bind(() => sender.setBroadcast(true));
            const ip = await this.server.getHostIp();
            sender.send(`{ "ip": "${ip}", "port": ${port} }`, 14099, '255.255.255.255', err => {
                if (err) {
                    Ui.outputError(`搜索失败: ${err.toString()}`);
                    finder.close();
                    sender.close();
                    statusBarDisposer();
                    return;
                }
                setTimeout(() => {
                    Ui.output(`搜索成功: 共搜索到 ${devices.length} 台设备`);
                    finder.close();
                    sender.close();
                    statusBarDisposer();
                }, 3000);
            });
        } catch (err) {
            Ui.outputWarn(`搜索失败: ${err.toString()}`);
            statusBarDisposer();
        }
    }
}

export default DeviceSearcher;
