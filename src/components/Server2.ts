import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import Device from './Device';
import Api from './Api';
import Ui from './ui/Ui';
import Zipper from './Zipper';
import ProjectGenerator from './ProjectGenerator';

class Server {
    private readonly api: Api = new Api();
    private attachingDevice: Device | undefined;
    private readonly extensionPath: string;
    private hostIp: string | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
    }

    private getAccessKey(): Promise<string> {
        const accessKey: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.accessKey');
        if (accessKey) {
            return Promise.resolve(accessKey);
        } else {
            return Promise.reject('AccessKey为空');
        }
    }

    public attachDevice(ip: string) {
        return this.api
            .getDeviceId(ip)
            .then(resp => {
                const id = resp.data;
                if (!id) {
                    return Promise.reject('获取设备ID失败');
                }
                return Promise.all([id, this.getAccessKey()]);
            })
            .then(([id, ak]) => {
                return Promise.all([id, this.api.getAuth(id, ak)]);
            })
            .then(([id, resp]) => {
                const { status, message, auth } = resp.data;
                if (status !== 200) {
                    return Promise.reject(message);
                }
                if (!auth) {
                    return Promise.reject('获取验证密钥失败');
                }
                return Promise.all([id, auth, this.api.getDeviceName(ip, auth)]);
            })
            .then(([id, auth, resp]) => {
                const name = resp.data;
                if (!name) {
                    return Promise.reject('获取设备名失败');
                }
                const osTypeSelected: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.osType');
                let osType: string = 'Android';
                switch (osTypeSelected) {
                    case '苹果':
                        osType = 'iOS';
                        break;
                    case '安卓':
                        osType = 'Android';
                        break;
                    case '安卓模拟器':
                        osType = 'Android_x86';
                        break;
                    case '自动':
                    default:
                        if (name === 'iPhone') {
                            osType = 'iOS';
                        } else {
                            osType = 'Android';
                        }
                        break;
                }
                return Promise.all([id, auth, name, osType]);
            })
            .then(([id, auth, name, osType]) => {
                const device = new Device(ip, id, auth, name, osType);
                this.attachingDevice = device;
            })
            .catch(err => {
                Ui.logging('连接设备失败: ' + err);
            });
    }

    public attachDeviceThroughInput() {
        return vscode.window
            .showInputBox({
                prompt: '请输入设备IP地址',
                value: '192.168.',
                placeHolder: 'x.x.x.x',
            })
            .then(inputValue => {
                inputValue = inputValue ? inputValue : '';
                inputValue = /^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(inputValue) ? inputValue : '';
                if (!inputValue) {
                    Ui.logging('连接设备失败: IP地址格式错误');
                }
                return this.attachDevice(inputValue);
            });
    }

    public detachDevice() {
        this.attachingDevice = undefined;
    }

    public deviceMenus() {
        return vscode.window.showQuickPick(['触动插件: 连接设备(搜索设备)', '触动插件: 连接设备(手动输入)', '触动插件: 断开设备']).then(selected => {
            switch (selected) {
                case '触动插件: 连接设备(搜索设备)':
                    vscode.commands.executeCommand('extension.attachDevice');
                    break;
                case '触动插件: 连接设备(手动输入)':
                    vscode.commands.executeCommand('extension.attachDeviceThroughInput');
                    break;
                case '触动插件: 断开设备':
                    vscode.commands.executeCommand('extension.detachDevice');
                    break;
                default:
                    break;
            }
        });
    }

    public zipProject() {
        const pjg = new ProjectGenerator().useZip();
        const zipper = new Zipper();
        Ui.setStatusBar('$(loading) 打包工程中...');
        pjg.generate()
            .then(pjfs => {
                return zipper.addFiles(pjfs);
            })
            .then(() => {
                const dir: string = pjg.projectRoot!;
                const filename: string = path.basename(dir) + '.zip';
                return zipper.zipFiles(dir, filename);
            })
            .then(url => {
                Ui.logging(`打包工程成功: ${url}`);
            })
            .catch(err => {
                Ui.logging(`打包工程失败: ${err.toString()}`);
            });
    }

    private getAttachingDevice() {
        if (this.attachingDevice) {
            return Promise.resolve(this.attachingDevice);
        } else {
            return Promise.reject('未连接设备');
        }
    }

    private getHostIp() {
        if (this.hostIp) {
            return Promise.resolve(this.hostIp);
        } else {
            const interfaces = os.networkInterfaces();
            for (let devName in interfaces) {
                const iface = interfaces[devName];
                for (let i = 0; i < iface.length; i++) {
                    const alias = iface[i];
                    if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                        this.hostIp = alias.address;
                        return Promise.resolve(this.hostIp);
                    }
                }
            }
            return Promise.reject('获取本机IP失败');
        }
    }

    public async runProject(runfile = 'main.lua', boot?: string): Promise<void> {
        try {
            boot = boot ? boot : runfile;
            const attachingDevice = await this.getAttachingDevice();
            const hostIp = await this.getHostIp();
            const { ip, auth, osType } = attachingDevice;
            const resp1 = await this.api.setLogServer(ip, auth, hostIp);
            if (resp1.data !== 'ok') {
                return Promise.reject('设置日志服务器失败');
            }
            const resp2 = await this.api.setLuaPath(ip, auth, boot, osType);
            if (resp2.data === 'ok') {
                return Promise.reject('设置引导文件失败');
            }
            const pjg = new ProjectGenerator(runfile);
            const pjfs = await pjg.generate();
            const resp3: string[] = [];
            for (const pjf of pjfs) {
                const resp = await this.api.upload(ip, auth, pjf);
                resp3.push(resp.data);
            }
            if (resp3.some(resp => resp !== 'ok')) {
                return Promise.reject('上传工程失败');
            }
            const resp4 = await this.api.runLua(ip, auth);
            if (resp4.data !== 'ok') {
                return Promise.reject('运行引导文件失败');
            }
            Ui.logging('运行工程成功');
        } catch (err) {
            Ui.logging(`运行工程失败: ${err.toString()}`);
        }
    }

    public runTestProject() {
        const runfile: string = vscode.workspace.getConfiguration().get('touchsprite-extension.testRunFile') || 'maintest.lua';
        return this.runProject(runfile);
    }
}
