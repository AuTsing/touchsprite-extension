import * as vscode from 'vscode';
import Server from './Server';
import TsMessager from './TsMessager';

interface IDevice {
    ip: string;
    name: string | undefined;
    id: string | undefined;
    auth: string | undefined;
    expire: number | undefined;
}

class Device implements IDevice {
    ip: string;
    name: string | undefined;
    id: string | undefined;
    auth: string | undefined;
    expire: number | undefined;
    osType: string | undefined;

    constructor(ip: string) {
        this.ip = ip;
    }

    public init(key: string, server: Server): Promise<Device> {
        return new Promise((resolve, reject) => {
            TsMessager.getDeviceId(this)
                .then(res => {
                    this.id = res.data;
                    return TsMessager.getAuth(this, key);
                })
                .then(res => {
                    const { data } = res;
                    if (data.status === 403) {
                        return Promise.reject('连接设备数超过最大设备数，请前往开发者后台清空设备，稍后再尝试');
                    }
                    if (data.status !== 200) {
                        return Promise.reject('获取身份验证失败');
                    }
                    this.auth = data.auth;
                    this.expire = data.time + data.valid;
                    return TsMessager.getDeviceName(this);
                })
                .then(res => {
                    this.name = res.data;
                    let osType: number | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.osType');
                    if (osType === 1) {
                        this.osType = 'iOS';
                    } else if (osType === 2) {
                        this.osType = 'Android';
                    } else if (osType === 3) {
                        this.osType = 'Android_x86';
                    } else {
                        if (this.name === 'iPhone') {
                            this.osType = 'iOS';
                        } else {
                            this.osType = 'Android';
                        }
                    }
                    resolve(this);
                    return;
                })
                .catch(err => {
                    reject(err);
                    return;
                });
        });
    }
}

export default Device;
