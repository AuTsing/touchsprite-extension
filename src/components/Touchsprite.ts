import * as Vscode from 'vscode';
import * as Os from 'os';
import * as Path from 'path';
import * as Net from 'net';
import * as Fs from 'fs';
import Axios from 'axios';
import * as Ui from './Ui';
import Device, { ETsFileRoot, ITsFile, ETsApiStatusResponseData } from './Device';
import DeviceSearcher from './DeviceSearcher';
import Projector, { EProjectMode } from './Projector';

interface ITsOpenApiResponseData {
    status: number;
    message: string;
    time: number;
    auth: string;
    valid: string;
    remainder_token: number;
}

export default class Touchsprite {
    private readonly context: Vscode.ExtensionContext;
    private readonly output: Ui.Output;
    private readonly statusBar: Ui.StatusBar;
    private usingDevice?: Device;
    private usingDeviceStatusBarItem?: Ui.StatusBarItem;
    private hostIp?: string;
    private readonly loggerPort: number;

    constructor(context: Vscode.ExtensionContext) {
        this.context = context;
        this.output = Ui.useOutput();
        this.statusBar = Ui.useStatusBar();
        this.loggerPort = Math.round(Math.random() * (20000 - 24999 + 1) + 24999);
        this.runLogger();
    }

    private async runLogger() {
        const logger = Net.createServer(socket => {
            socket.on('data', data => this.output.info(data.toString('utf8', 4, data.length - 2)));
        });
        logger.on('error', e => {
            logger.close();
            this.output.error('日志服务器启用失败，这可能导致设备日志无法正常接收: ' + e.message);
        });
        logger.listen(this.loggerPort);
    }

    private async getAuth(accessKey: string, id: string): Promise<string> {
        const postData = JSON.stringify({
            action: 'getAuth',
            key: accessKey,
            devices: [id],
            valid: 3600,
            time: Math.floor(Date.now() / 1000),
        });
        const postDataLength = Buffer.byteLength(postData);
        const resp = await Axios.post<ITsOpenApiResponseData>(`/api/openapi`, postData, {
            baseURL: 'http://openapi.touchsprite.com',
            headers: {
                Connection: 'close',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postDataLength,
            },
        });
        if (!resp.data.auth) {
            throw Error('获取授权失败');
        }

        return resp.data.auth;
    }

    private async getAccessKey(): Promise<string> {
        let accessKey = Vscode.workspace.getConfiguration('touchsprite-extension').get<string>('accessKey') ?? '';
        if (accessKey === '') {
            accessKey = (await Vscode.window.showInputBox({ prompt: '请输入开发者AccessKey', value: '' })) ?? '';
            Vscode.workspace.getConfiguration('touchsprite-extension').update('accessKey', accessKey, true);
        }
        if (accessKey === '') {
            throw new Error('开发者AccessKey不正确');
        }

        return accessKey;
    }

    public getHostIp(): string {
        if (!this.hostIp) {
            const interfaces = Os.networkInterfaces();
            forInterfaces: for (const interfaceKey in interfaces) {
                if (interfaceKey.toLocaleLowerCase().indexOf('vmware') >= 0) {
                    continue;
                }
                if (interfaceKey.toLocaleLowerCase().indexOf('virtualbox') >= 0) {
                    continue;
                }
                if (interfaceKey.toLocaleLowerCase().indexOf('vethernet') >= 0) {
                    continue;
                }
                const infos = interfaces[interfaceKey]!;
                for (const info of infos) {
                    if (info.family !== 'IPv4') {
                        continue;
                    }
                    if (info.address === '127.0.0.1') {
                        continue;
                    }
                    if (info.internal === true) {
                        continue;
                    }
                    this.hostIp = info.address;
                    break forInterfaces;
                }
            }
        }

        if (!this.hostIp) {
            throw Error('无法获取本机IP');
        }

        return this.hostIp;
    }

    private async attachDevice(ip: string): Promise<Device> {
        const accessKey = await this.getAccessKey();
        const axios = Axios.create({ baseURL: `http://${ip}:50005`, timeout: 10000 });
        const id = (await axios.get<string>('/deviceid', { headers: { Connection: 'close', 'Content-Length': 0 } })).data;
        const auth = await this.getAuth(accessKey, id);
        const name = (await axios.get<string>('/devicename', { headers: { Connection: 'close', 'Content-Length': 0, auth } })).data;

        let platform!: 'ios' | 'android';
        if (id.length === 32) {
            platform = 'ios';
        }
        if (id.length === 33) {
            platform = 'android';
        }

        let userPath!: string;
        if (platform === 'ios') {
            userPath = '/var/mobile/Media/TouchSprite/';
        }
        if (platform === 'android') {
            userPath = '/sdcard/TouchSprite/';
        }

        const device = new Device(ip, id, auth, name, platform, userPath, axios);
        if (this.usingDevice) {
            this.detachDevice();
        }
        this.usingDevice = device;
        this.usingDeviceStatusBarItem = this.statusBar.attach(ip);
        this.context.globalState.update('lastAttachedIp', ip);

        return device;
    }

    public async attachDeviceByInput(): Promise<void> {
        const doing = this.statusBar.doing('连接中');
        try {
            const ip = (await Vscode.window.showInputBox({ prompt: '请输入设备IP地址', value: '192.168.', placeHolder: 'x.x.x.x' })) ?? '';
            if (!/^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(ip)) {
                throw new Error('IP格式不正确');
            }
            await this.attachDevice(ip);
        } catch (e) {
            this.output.error('连接设备失败: ' + (e as Error).message);
        }
        doing.dispose();
    }

    public async attachDeviceBySearch(): Promise<void> {
        let doing: Ui.StatusBarItem | undefined;
        const deviceSearcher = new DeviceSearcher(this);
        try {
            const device = await deviceSearcher.search();
            doing = this.statusBar.doing('连接中');
            await this.attachDevice(device.ip);
        } catch (e) {
            this.output.error('连接设备失败: ' + (e as Error).message);
        }
        doing?.dispose();
    }

    private async attachDeviceByDefault(): Promise<Device> {
        const ip = this.context.globalState.get<string>('lastAttachedIp');
        if (!ip) {
            throw new Error('未连接设备');
        }

        const device = await this.attachDevice(ip);

        return device;
    }

    public detachDevice() {
        if (!this.usingDevice) {
            return;
        }

        this.usingDevice = undefined;
        this.usingDeviceStatusBarItem?.dispose();
    }

    private watchScriptStatus(device: Device) {
        const doing = this.statusBar.doing('脚本运行中');
        doing.prefix = '📲';
        const stopWatching = setInterval(async () => {
            try {
                const isRunning = await device.status();
                if (isRunning !== ETsApiStatusResponseData.running) {
                    doing.dispose();
                    clearInterval(stopWatching);
                }
            } catch (e) {
                doing.dispose();
                clearInterval(stopWatching);
            }
        }, 1000);
    }

    public async runProject(mainFilename: string = 'main.lua', boot?: string): Promise<void> {
        const doing = this.statusBar.doing('发送工程中');
        try {
            boot = boot ?? mainFilename;
            const device = this.usingDevice ?? (await this.attachDeviceByDefault());
            const hostIp = this.hostIp ?? this.getHostIp();

            const isRunning = await device.status();
            if (isRunning === ETsApiStatusResponseData.running) {
                await this.stopScript();
            }

            const isSuccessful1 = await device.logServer(hostIp, this.loggerPort);
            if (!isSuccessful1) {
                throw new Error('设置日志服务器失败');
            }

            const isSuccessful2 = await device.setLuaPath(boot);
            if (!isSuccessful2) {
                throw new Error('设置引导文件失败');
            }

            const projector = new Projector(mainFilename, EProjectMode.send);
            const tsFiles = projector.generate();
            const total = tsFiles.length;
            let progress = 0;
            for (const file of tsFiles) {
                const isSuccessful3 = await device.upload(file);
                if (!isSuccessful3) {
                    throw new Error(`上传文件 ${file.url} 失败`);
                }
                doing.updateProgress(++progress / total);
                this.statusBar.refresh();
            }

            const isSuccessful4 = await device.runLua();
            if (!isSuccessful4) {
                throw new Error('运行引导文件失败');
            }

            this.watchScriptStatus(device);
            this.output.info('运行工程成功');
        } catch (e) {
            this.output.error('运行工程失败: ' + (e as Error).message);
        }
        doing.dispose();
    }

    public async runTestProject(): Promise<void> {
        const mainFilename = Vscode.workspace.getConfiguration('touchsprite-extension').get<string>('mainTestFilename');
        return this.runProject(mainFilename);
    }

    public async runScript(): Promise<void> {
        const doing = this.statusBar.doing('发送脚本中');
        try {
            const device = this.usingDevice ?? (await this.attachDeviceByDefault());
            const hostIp = this.hostIp ?? this.getHostIp();

            const isRunning = await device.status();
            if (isRunning === ETsApiStatusResponseData.running) {
                await this.stopScript();
            }

            const isSuccessful1 = await device.logServer(hostIp, this.loggerPort);
            if (!isSuccessful1) {
                throw new Error('设置日志服务器失败');
            }

            const focusingFile = Vscode.window.activeTextEditor?.document;
            if (!focusingFile) {
                throw new Error('未指定脚本');
            }

            const url = focusingFile.fileName;
            const filename = Path.basename(url);
            const ext = Path.extname(filename);
            if (ext !== '.lua') {
                throw new Error('所指定文件非Lua脚本');
            }

            const isSuccessful2 = await device.setLuaPath(filename);
            if (!isSuccessful2) {
                throw new Error('设置引导文件失败');
            }

            const tsFile: ITsFile = {
                url,
                root: ETsFileRoot.lua,
                path: '/',
                filename,
            };
            const isSuccessful3 = await device.upload(tsFile);
            if (!isSuccessful3) {
                throw new Error('上传文件失败');
            }

            const isSuccessful4 = await device.runLua();
            if (!isSuccessful4) {
                throw new Error('运行引导文件失败');
            }

            this.watchScriptStatus(device);
            this.output.info('运行脚本成功');
        } catch (e) {
            this.output.error('运行脚本失败: ' + (e as Error).message);
        }
        doing.dispose();
    }

    public async stopScript(): Promise<void> {
        try {
            const device = this.usingDevice ?? (await this.attachDeviceByDefault());

            const isSuccessful = await device.stopLua();
            if (!isSuccessful) {
                throw new Error('停止脚本失败');
            }

            this.output.info('停止脚本成功');
        } catch (e) {
            this.output.error('停止脚本失败: ' + (e as Error).message);
        }
    }

    public async uploadFile(): Promise<void> {
        const doing = this.statusBar.doing('上传文件中');
        try {
            const device = this.usingDevice ?? (await this.attachDeviceByDefault());

            const list = [ETsFileRoot.lua, ETsFileRoot.res];
            const selectedRoot = await Vscode.window.showQuickPick(list, { placeHolder: '上传至...' });
            const root = selectedRoot as ETsFileRoot;
            if (!root) {
                throw new Error('未选择目标目录');
            }

            const uris = await Vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
            });
            if (!uris) {
                throw new Error('未选择文件');
            }

            const files: ITsFile[] = uris.map(uri => {
                const url = uri.path.substring(1);
                const filename = Path.basename(url);
                const file: ITsFile = {
                    url,
                    root,
                    path: '/',
                    filename,
                };
                return file;
            });

            for (const file of files) {
                const isSuccessful = await device.upload(file);
                if (!isSuccessful) {
                    throw new Error(`上传文件 ${file.url} 失败`);
                }
            }

            this.output.info(`上传文件成功: ${files.length} 个文件`);
        } catch (e) {
            this.output.error('上传文件失败: ' + (e as Error).message);
        }
        doing.dispose();
    }

    public async clearScript(): Promise<void> {
        const doing = this.statusBar.doing('清空脚本中');
        try {
            const device = this.usingDevice ?? (await this.attachDeviceByDefault());

            const dirs: string[] = ['/'];
            const dirsToRm: string[] = [];
            const filesToRm: string[] = [];

            while (dirs.length > 0) {
                const dir = dirs.shift()!;
                const list = await device.getFileList(dir);
                list.Dirs?.forEach(nextDir => dirs.push(dir + nextDir + '/'));
                list.Files?.forEach(nextFile => filesToRm.push(dir + nextFile));
                if (dir !== '/') {
                    dirsToRm.push(dir);
                }
            }

            const total = dirsToRm.length + filesToRm.length;
            let progress = 0;
            for (const file of filesToRm) {
                const isSuccessful = await device.rmFile(file);
                if (!isSuccessful) {
                    throw new Error(`删除文件 ${file} 失败`);
                }
                doing.updateProgress(++progress / total);
                this.statusBar.refresh();
            }
            for (const dir of dirsToRm.reverse()) {
                const isSuccessful = await device.rmFile(dir);
                if (!isSuccessful) {
                    throw new Error(`删除文件夹 ${dir} 失败`);
                }
                doing.updateProgress(++progress / total);
                this.statusBar.refresh();
            }

            this.output.info(`清空脚本成功: ${total} 个文件`);
        } catch (e) {
            this.output.error('清空脚本失败: ' + (e as Error).message);
        }
        doing.dispose();
    }

    public async snap(): Promise<ArrayBuffer | undefined> {
        const doing = this.statusBar.doing('截图中');
        try {
            const device = this.usingDevice ?? (await this.attachDeviceByDefault());
            const orient = Vscode.workspace.getConfiguration('touchsprite-extension').get<string>('snapOrient');
            let numberOfOrient: number;
            switch (orient) {
                case 'home键在下':
                    numberOfOrient = 0;
                    break;
                case 'home键在左':
                    numberOfOrient = 2;
                    break;
                case 'home键在右':
                default:
                    numberOfOrient = 1;
                    break;
            }
            const img = await device.snapshot(numberOfOrient);

            const dir = Vscode.workspace.getConfiguration('touchsprite-extension').get<string>('snapDir');
            if (dir) {
                const url = Path.join(dir, `PIC_${Date.now()}.png`);
                Fs.writeFile(url, Buffer.from(img), e => {
                    if (e) {
                        Vscode.window.showWarningMessage((e as Error).message);
                    }
                });
            }

            doing.dispose();
            return img;
        } catch (e) {
            this.output.error('截图失败: ' + (e as Error).message);
        }
        doing.dispose();
    }
}
