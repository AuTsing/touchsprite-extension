import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as fs from 'fs';
import Device from './Device';
import Api from './Api';
import Ui from './ui/Ui';
import Zipper from './Zipper';
import ProjectGenerator, { IProjectFile, ProjectFileRoot } from './ProjectGenerator';

export default class Server {
    public readonly api: Api = new Api();
    private attachingDevice: Device | undefined;
    private hostIp: string | undefined;
    private loggerPort: number;
    private readonly extensionGlobalState: vscode.Memento;

    constructor(context: vscode.ExtensionContext) {
        this.loggerPort = Math.round(Math.random() * (20000 - 24999 + 1) + 24999);
        this.setLogger();
        this.extensionGlobalState = context.globalState;
    }

    private getAccessKey(): Promise<string> {
        const accessKey: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.accessKey');
        if (accessKey) {
            return Promise.resolve(accessKey);
        } else {
            return Promise.reject('AccessKey为空');
        }
    }

    private setLogger() {
        const logger = net.createServer((socket: net.Socket) => {
            socket.on('data', data => Ui.output(data.toString('utf8', 4, data.length - 2)));
        });
        logger.on('error', err => {
            logger.close();
            Ui.outputError(`日志服务器启用失败, 这可能导致设备日志无法正常接收, 错误代码: ${err.toString()}, 如无法自行解决, 请联系开发者获取帮助`);
        });
        logger.listen(this.loggerPort);
    }

    public attachDevice(ip: string) {
        const statusBarDisposer = Ui.doing('连接中');
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
                this.extensionGlobalState.update('device', ip);
                Ui.output(`连接设备成功: ${name} >> ${ip}`);
                Ui.attachDevice(this.attachingDevice);
            })
            .catch(err => {
                Ui.outputWarn(`连接设备失败: ${err}`);
            })
            .finally(() => {
                statusBarDisposer();
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
                    Ui.outputWarn('连接设备失败: IP地址格式错误');
                    return;
                }
                return this.attachDevice(inputValue);
            });
    }

    public detachDevice() {
        this.attachingDevice = undefined;
        Ui.detachDevice();
    }

    public deviceMenus() {
        return vscode.window.showQuickPick(['触动插件: 连接设备(搜索设备)', '触动插件: 连接设备(手动输入)', '触动插件: 断开设备']).then(selected => {
            switch (selected) {
                case '触动插件: 连接设备(搜索设备)':
                    vscode.commands.executeCommand('extension.attachDeviceThroughSearch');
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
        const statusBarDisposer = Ui.doing('打包工程中');
        return pjg
            .generate()
            .then(pjfs => {
                return zipper.addFiles(pjfs);
            })
            .then(() => {
                return pjg.getRoot();
            })
            .then(root => {
                const dir: string = path.dirname(root);
                const filename: string = path.basename(root) + '.zip';
                return zipper.zipFiles(dir, filename);
            })
            .then(url => {
                Ui.output(`打包工程成功: ${url}`);
            })
            .catch(err => {
                Ui.outputWarn(`打包工程失败: ${err.toString()}`);
            })
            .finally(() => {
                statusBarDisposer();
            });
    }

    public async getAttachingDevice() {
        if (this.attachingDevice) {
            return Promise.resolve(this.attachingDevice);
        }
        const ip = this.extensionGlobalState.get<string>('device');
        if (ip) {
            await this.attachDevice(ip);
        }
        if (this.attachingDevice) {
            return Promise.resolve(this.attachingDevice);
        }
        return Promise.reject('未连接设备');
    }

    public getHostIp() {
        if (this.hostIp) {
            return Promise.resolve(this.hostIp);
        } else {
            const interfaces = os.networkInterfaces();
            for (const interfaceKey in interfaces) {
                if (interfaceKey.toLocaleLowerCase().indexOf('vmware') < 0 && interfaceKey.toLocaleLowerCase().indexOf('virtualbox') < 0) {
                    const interfaceValue = interfaces[interfaceKey];
                    for (const alias of interfaceValue) {
                        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                            this.hostIp = alias.address;
                            return Promise.resolve(this.hostIp);
                        }
                    }
                }
            }
            return Promise.reject('获取本机IP失败');
        }
    }

    public async runProject(runfile = 'main.lua', boot?: string): Promise<void> {
        const statusBarDisposer = Ui.doing('发送工程中');
        try {
            boot = boot ? boot : runfile;
            const attachingDevice = await this.getAttachingDevice();
            const hostIp = await this.getHostIp();
            const { ip, auth, osType } = attachingDevice;
            const resp1 = await this.api.getStatus(ip, auth);
            if (resp1.data !== 'f00') {
                await this.stopScript();
            }
            const resp2 = await this.api.setLogServer(ip, auth, hostIp, this.loggerPort);
            if (resp2.data !== 'ok') {
                throw new Error('设置日志服务器失败');
            }
            const resp3 = await this.api.setLuaPath(ip, auth, boot, osType);
            if (resp3.data !== 'ok') {
                throw new Error('设置引导文件失败');
            }
            const pjg = new ProjectGenerator(runfile);
            const pjfs = await pjg.generate();
            const resp4: string[] = [];
            for (const pjf of pjfs) {
                const resp = await this.api.upload(ip, auth, pjf);
                resp4.push(resp.data);
            }
            if (resp4.some(resp => resp !== 'ok')) {
                throw new Error('上传工程失败');
            }
            const resp5 = await this.api.runLua(ip, auth);
            if (resp5.data !== 'ok') {
                throw new Error('运行引导文件失败');
            }
            Ui.output('运行工程成功');
            this.watchScript(attachingDevice);
        } catch (err) {
            if (err instanceof Error) {
                Ui.outputWarn(`运行工程失败: ${err.toString()}`);
            }
        }
        statusBarDisposer();
    }

    public runTestProject() {
        const runfile: string = vscode.workspace.getConfiguration().get('touchsprite-extension.testRunFile') || 'maintest.lua';
        return this.runProject(runfile);
    }

    public async runScript(): Promise<void> {
        const statusBarDisposer = Ui.doing('发送脚本中');
        try {
            const attachingDevice = await this.getAttachingDevice();
            const focusing = vscode.window.activeTextEditor?.document;
            if (!focusing) {
                throw new Error('未指定脚本');
            }
            if (path.extname(focusing.fileName) !== '.lua') {
                throw new Error('所选文件非Lua脚本');
            }
            const hostIp = await this.getHostIp();
            const { ip, auth, osType } = attachingDevice;
            const resp1 = await this.api.getStatus(ip, auth);
            if (resp1.data !== 'f00') {
                await this.stopScript();
            }
            const resp2 = await this.api.setLogServer(ip, auth, hostIp, this.loggerPort);
            if (resp2.data !== 'ok') {
                throw new Error('设置日志服务器失败');
            }
            const resp3 = await this.api.setLuaPath(ip, auth, path.basename(focusing.fileName), osType);
            if (resp3.data !== 'ok') {
                throw new Error('设置引导文件失败');
            }
            const pjf: IProjectFile = {
                url: focusing.fileName,
                path: '/',
                filename: path.basename(focusing.fileName),
                root: ProjectFileRoot.lua,
            };
            const resp4 = await this.api.upload(ip, auth, pjf);
            if (resp4.data !== 'ok') {
                throw new Error('上传脚本失败');
            }
            const resp5 = await this.api.runLua(ip, auth);
            if (resp5.data !== 'ok') {
                throw new Error('运行引导文件失败');
            }
            Ui.output(`运行脚本成功`);
            this.watchScript(attachingDevice);
        } catch (err) {
            if (err instanceof Error) {
                Ui.outputWarn(`运行脚本失败: ${err.toString()}`);
            }
        }
        statusBarDisposer();
    }

    public async stopScript(): Promise<void> {
        try {
            const attachingDevice = await this.getAttachingDevice();
            const { ip, auth } = attachingDevice;
            const resp = await this.api.stopLua(ip, auth);
            if (resp.data !== 'ok') {
                throw new Error('停止脚本失败');
            }
            Ui.output(`停止脚本成功`);
        } catch (err) {
            if (err instanceof Error) {
                Ui.outputWarn(`停止脚本失败: ${err.toString()}`);
            }
        }
    }

    public async uploadFiles(): Promise<void> {
        const statusBarDisposer = Ui.doing('上传文件中');
        try {
            const attachingDevice = await this.getAttachingDevice();
            const { ip, auth } = attachingDevice;
            const root = await vscode.window.showQuickPick(['lua', 'res'], { placeHolder: '上传至...' }).then(selected => {
                const root = selected === 'lua' ? ProjectFileRoot.lua : ProjectFileRoot.res;
                return Promise.resolve(root);
            });
            const uris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
            });
            if (!uris || uris.length === 0) {
                throw new Error('未选择文件');
            }
            const pjfs: IProjectFile[] = uris.map(uri => {
                const url = uri.path.substring(1);
                return {
                    url: url,
                    path: '/',
                    filename: path.basename(url),
                    root: root,
                };
            });
            const resp1: string[] = [];
            for (const pjf of pjfs) {
                const resp = await this.api.upload(ip, auth, pjf);
                resp1.push(resp.data);
            }
            if (resp1.some(resp => resp !== 'ok')) {
                throw new Error('上传文件失败');
            }
            Ui.output(`上次文件成功: ${resp1.length}`);
        } catch (err) {
            if (err instanceof Error) {
                Ui.outputWarn(`上传文件失败: ${err.toString()}`);
            }
        }
        statusBarDisposer();
    }

    public setHostIp() {
        return vscode.window
            .showInputBox({
                prompt: '请输入本机IP地址',
                value: '192.168.',
                placeHolder: 'x.x.x.x',
            })
            .then(inputValue => {
                inputValue = inputValue ? inputValue : '';
                inputValue = /^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(inputValue) ? inputValue : '';
                if (inputValue) {
                    return Promise.resolve(inputValue);
                } else {
                    return Promise.reject(`IP地址错误`);
                }
            })
            .then(
                ip => {
                    this.hostIp = ip;
                    Ui.output(`设置本机IP地址成功: ${ip}`);
                },
                err => {
                    Ui.outputWarn(`设置本机IP地址失败: ${err.toString()}`);
                }
            );
    }

    private watchScript(device: Device) {
        const runningDisposer = Ui.doing('脚本运行中', '📲');
        const toClear = setInterval(() => {
            this.api
                .getStatus(device.ip, device.auth)
                .then(resp => {
                    if (resp.data !== 'f01' && resp.data !== 'f01(pause)') {
                        return Promise.reject(resp.data);
                    }
                })
                .catch(err => {
                    runningDisposer();
                    clearInterval(toClear);
                });
        }, 1000);
    }

    public async clearDir() {
        const statusBarDisposer = Ui.doing('清空脚本中');
        try {
            const attachingDevice = await this.getAttachingDevice();
            const { ip, auth } = attachingDevice;
            const dirs: string[] = ['/'];
            const dirsToRemove: string[] = [];
            const files: string[] = [];

            while (dirs.length > 0) {
                const dir = dirs.shift()!;
                const resp = await this.api.getFileList(ip, auth, dir);
                if (resp.data.ret !== true) {
                    throw new Error('获取文件列表失败');
                }
                resp.data.Dirs?.forEach(nextDir => dirs.push(dir + nextDir + '/'));
                resp.data.Files?.forEach(file => files.push(dir + file));
                dir !== '/' ? dirsToRemove.push(dir) : undefined;
            }

            const resp2: string[] = [];
            for (const file of files) {
                const resp = await this.api.removeFiles(ip, auth, file);
                resp2.push(resp.data);
            }
            for (const dir of dirsToRemove.reverse()) {
                const resp = await this.api.removeFiles(ip, auth, dir);
                resp2.push(resp.data);
            }
            if (resp2.some(resp => resp !== 'ok')) {
                throw new Error('清空脚本失败');
            }
            Ui.output(`清空脚本成功`);
        } catch (err) {
            if (err instanceof Error) {
                Ui.outputWarn(`清空脚本失败: ${err.toString()}`);
            }
        }
        statusBarDisposer();
    }

    public async createProject() {
        let uri: vscode.Uri | undefined = undefined;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length === 1) {
            uri = workspaceFolders[0].uri;
            const uriFiles = fs.readdirSync(uri.fsPath);
            if (uriFiles.length > 0) {
                const isContinue = await vscode.window.showWarningMessage(
                    `所选文件夹(${uri.fsPath})非空，这有可能会覆盖你的文件，请确认是否继续创建？`,
                    '是',
                    '否'
                );
                if (isContinue !== '是') {
                    Ui.outputWarn(`新建工程失败: 已取消`);
                    return;
                }
            }
        } else {
            uri = (
                await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    openLabel: '在此处新建工程',
                })
            )?.[0];
        }
        if (!uri) {
            Ui.outputWarn(`新建工程失败: 未指定路径`);
            return;
        }
        const docs = [
            { dir: path.join(uri.fsPath, 'main.lua'), txt: `local main = function() toast('Hello,world!') end\nmain()` },
            { dir: path.join(uri.fsPath, 'maintest.lua'), txt: `local main = function() toast('Hello,test!') end\nmain()` },
            {
                dir: path.join(uri.fsPath, 'luaconfig.lua'),
                txt: `return {\n['id'] = '123456',\n['version'] = '1.0.0',\n}`,
            },
            {
                dir: path.join(uri.fsPath, 'CHANGELOG.md'),
                txt: `# [0.0.1]\n\n-   initial commit`,
            },
            {
                dir: path.join(uri.fsPath, 'README.md'),
                txt: `## 使用帮助\n\n现在已经创建好了基础的工程文件，你可以随时删除和修改他们。\n\n-   main.lua 工程主引导文件\n-   maintest.lua 工程主引导文件\n-   luaconfig.lua 配置文件\n-   CHANGELOG.md 更新日志文件\n-   README.md 说明文\n\n使用以下快捷键进行操作\n-   F5 运行主工程引导文件\n-   F6 运行测试工程引导文件\n-   F7 运行单脚本文件\n-   F8 打开取色器\n\nEnjoy~`,
            },
        ];
        try {
            docs.forEach(doc => {
                fs.writeFileSync(doc.dir, doc.txt);
            });
        } catch (err) {
            if (err instanceof Error) {
                Ui.outputWarn(`新建工程失败: ${err.toString()}`);
            }
            return;
        }
        if (!workspaceFolders) {
            await vscode.commands.executeCommand('vscode.openFolder', uri);
        }
        Ui.output(`新建工程成功`);
    }

    public test() {}
}
