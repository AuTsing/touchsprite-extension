import * as vscode from 'vscode';
import { TsRequset } from './MyHttpClient';

interface IDevice {
    ip: string;
    name: string | undefined;
    deviceId: string | undefined;
    auth: string | undefined;
    expire: number | undefined;
}

export class Device implements IDevice {
    ip: string;
    name: string | undefined;
    deviceId: string | undefined;
    auth: string | undefined;
    expire: number | undefined;
    osType!: string;

    constructor(ip: string) {
        this.ip = ip;
    }

    public init(key: string): Promise<Device> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                reject('连接超时');
            }, 3000);
            TsRequset.GetDeviceId(this)
                .then(value => {
                    console.log('成功获取设备ID');
                    this.deviceId = value;
                    return TsRequset.GetAuth(this, key);
                })
                .then(value => {
                    console.log('成功获取Auth');
                    let json = JSON.parse(value);
                    this.auth = json.auth;
                    this.expire = json.time + json.valid;
                    return TsRequset.GetDeviceName(this);
                })
                .then(value => {
                    console.log('成功获取设备名');
                    this.name = value;
                    let osType: number | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.osType');
                    if (osType == 1) {
                        this.osType = 'iOS';
                    } else if (osType == 2) {
                        this.osType = 'Android';
                    } else if (osType == 3) {
                        this.osType = 'Android_x86';
                    } else {
                        if (this.name == 'iPhone') {
                            this.osType = 'iOS';
                        } else {
                            this.osType = 'Android';
                        }
                    }
                    resolve(this);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }
}
