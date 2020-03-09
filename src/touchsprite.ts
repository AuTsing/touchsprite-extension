import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as JSZip from "jszip";

export class Device {
    public ip: string;
    public name!: string;
    public deviceId!: string;
    public auth!: string;
    public expire!: number;

    constructor(ip: string) {
        this.ip = ip;
    }
    public init(key: string | undefined): Promise<Device> {
        if (key) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    reject("连接超时")
                }, 3000)
                Ts.GetDeviceId(this)
                    .then(value => {
                        console.log("成功获取设备ID");
                        this.deviceId = value;
                        return Ts.GetAuth(this, key);
                    })
                    .then(value => {
                        console.log("成功获取Auth");
                        let json = JSON.parse(value);
                        this.auth = json.auth;
                        this.expire = json.time + json.valid;
                        return Ts.GetDeviceName(this);
                    })
                    .then(value => {
                        console.log("成功获取设备名");
                        this.name = value;
                        return Ts.LogServer(this);
                    })
                    .then((value) => {
                        console.log("设置日志服务器:" + value)
                        resolve(this);
                    })
                    .catch(err => {
                        reject(err);
                    });
            })
        } else {
            return Promise.reject("未填写开发者key");
        }
    }
}

export class Server {
    public tsChannel = vscode.window.createOutputChannel("触动精灵日志")
    public logServer: net.Server;
    public attachingDev!: Device;
    public key: string | undefined;

    constructor() {
        let key: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.accessKey');
        if (key && key != "") {
            this.key = key;
            vscode.window.showInformationMessage("触动服务已启动");
        } else {
            vscode.window
                .showInformationMessage("开发者key未填写，是否现在填写？", "是", "否", "不再提示")
                .then(result => {
                    if (result === "是") {
                        vscode.window.showInputBox({
                            prompt: "请输入开发者key",
                            value: "",
                            placeHolder: "开发者key请浏览触动官网查询",
                            ignoreFocusOut: true
                        })
                            .then(inputValue => {
                                if (typeof inputValue === "undefined") {
                                    vscode.window.showWarningMessage('开发者key未填写将导致插件无法正常使用');
                                    return new Server();
                                };
                                vscode.workspace.getConfiguration().update('touchsprite-extension.accessKey', inputValue, true)
                                this.key = inputValue;
                            })
                    } else if (result === "否") {
                        vscode.window.showWarningMessage('开发者key未填写将导致插件无法正常使用');
                        return new Server();
                    } else if (result === "不再提示") {
                        return;
                    }
                });
        }
        this.logServer = net.createServer((socket: net.Socket) => {
            socket.on('data', (data) => {
                this.tsChannel.append(`[${new Date().toLocaleString('chinese', { hour12: false })}] `);
                this.tsChannel.appendLine(data.toString('utf8', 4, data.length - 2));
                this.tsChannel.show(true);
            });
            // socket.on('end', () => {
            //     this.logServer.close(() => console.log("日志服务器已关闭"));
            // })
        });
        this.logServer.on('error', (err: any) => {
            throw err;
        });
        this.logServer.listen(14088, () => {
            this.tsChannel.appendLine("日志服务器已启用");
            this.tsChannel.show(true);
        })
    }

    public ReceiveIp() {
        return new Promise<string>((resolve, reject) => {
            vscode.window.showInputBox({
                prompt: "请输入设备IP地址",
                value: "",
                placeHolder: "x.x.x.x"
            }).then(inputValue => {
                if (typeof inputValue === undefined) {
                    reject();
                } else {
                    resolve(inputValue);
                };
            })
        })
    }
    public Connect(ip: string) {
        let dev = new Device(ip);
        dev.init(this.key)
            .then(value => {
                this.attachingDev = value;
                vscode.window.showInformationMessage(`设备:${dev.ip}连接成功`);
            })
            .catch(err => {
                vscode.window.showWarningMessage(`设备:${dev.ip}连接失败`);
                console.log(err);
            });
    }
    private IsConnected() {
        if (this.attachingDev) {
            console.log("已连接设备:");
            console.log(this.attachingDev);
            return true;
        } else {
            vscode.window.showErrorMessage('未连接设备！');
            return false;
        }
    }
    public GetStatus() {
        if (this.IsConnected()) {
            return Ts.GetStatus(this.attachingDev)
                .then(value => {
                    if (value == "f00") {
                        vscode.window.showInformationMessage(`设备:${this.attachingDev.ip}空闲`)
                    } else if (value == "f01") {
                        vscode.window.showInformationMessage(`设备:${this.attachingDev.ip}运行中`)
                    }
                }, err => console.log(err));
        }
    }
    public GetPicture() {
        if (this.IsConnected()) {
            return Ts.GetPicture(this.attachingDev).then(value => {
                return new Promise((resolve, reject) => {
                    let saveName: string;
                    let snapshotDir: string | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
                    if (snapshotDir) {
                        saveName = `${snapshotDir}\\PIC_${Date.now()}.png`;
                        fs.writeFile(saveName, value, "binary", (err) => {
                            if (err) {
                                console.log("截图失败" + err.message);
                                vscode.window.showWarningMessage("截图失败");
                            } else {
                                console.log("截图成功");
                                vscode.window.showInformationMessage("截图成功");
                            }
                        });
                    } else {
                        let name = vscode.window.activeTextEditor?.document;
                        if (name) {
                            saveName = path.dirname(name.fileName) + "\\snapshot.png";
                            fs.writeFile(saveName, value, "binary", (err) => {
                                if (err) {
                                    console.log("截图失败" + err.message);
                                    vscode.window.showWarningMessage("截图失败");
                                } else {
                                    console.log("截图成功");
                                    vscode.window.showInformationMessage("截图成功");
                                }
                            });
                        } else {
                            vscode.window.showInformationMessage("未选择保存路径");
                        }
                    }


                })
            }, err => console.log(err));
        }
    }
    public SetLogServer() {
        if (this.IsConnected()) {
            return Ts.LogServer(this.attachingDev).then(value => console.log("远程日志:" + value), err => console.log(err));
        }
    }
    public SetLuaPath() {
        if (this.IsConnected()) {
            return Ts.SetLuaPath(this.attachingDev).then(value => console.log("设置运行路径:" + value), err => console.log(err));
        }
    }
    public RunLua() {
        if (this.IsConnected()) {
            return Ts.RunLua(this.attachingDev)
                .then(value => {
                    console.log("运行脚本:" + value);
                    if (value == "ok") {
                        vscode.window.showInformationMessage("运行脚本成功");
                    } else if (value == "fail") {
                        vscode.window.showInformationMessage("运行脚本失败");
                    }
                }, err => console.log(err));
        }
    }
    public StopLua() {
        if (this.IsConnected()) {
            return Ts.StopLua(this.attachingDev)
                .then(value => {
                    console.log("停止脚本:" + value);
                    if (value == "ok") {
                        vscode.window.showInformationMessage("运行停止成功");
                    } else if (value == "fail") {
                        vscode.window.showInformationMessage("运行停止失败");
                    }
                }, err => console.log(err));
        }
    }
    public async Upload() {
        if (this.IsConnected()) {
            let name = vscode.window.activeTextEditor?.document;
            if (name) {
                let pathName: string = path.dirname(name.fileName);
                let fileArr: string[] = fs.readdirSync(pathName);
                let newArr = fileArr.filter(str => {
                    return str.indexOf(".lua") >= 0 || str.indexOf(".png") >= 0 || str.indexOf(".txt") >= 0;
                });
                if (fileArr.includes("main.lua")) {
                    for (let f of newArr) {
                        await Ts.Upload(this.attachingDev, f, pathName).then(null, (err: any) => console.log(err));
                    }
                } else {
                    vscode.window.showErrorMessage('所选工程必须包含main.lua文件');
                }
            }
        }
    }
    public async UploadInclude() {
        if (this.IsConnected()) {
            let pathArr: Array<string> | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
            if (pathArr && pathArr.length > 0) {
                return Promise.all(pathArr.map(async (value) => {
                    let pathName: string = value;
                    let fileArr: string[] = fs.readdirSync(pathName);
                    let newArr = fileArr.filter(str => {
                        return str.indexOf(".lua") >= 0 || str.indexOf(".png") >= 0 || str.indexOf(".txt") >= 0;
                    });
                    for (let f of newArr) {
                        await Ts.Upload(this.attachingDev, f, pathName).then(null, (err: any) => console.log(err));
                    }
                }))
            } else {
                return Promise.resolve()
            }
        }
    }

    public ZipProject() {
        let ziper = new Ziper();
        this.GetProjectFileList()
            .then((arr) => {
                // console.log(arr);
                for (let value of arr) {
                    ziper.addFile(value.f, value.dir);
                }
                return arr.pop();
            })
            .then((value) => {
                ziper.zipFiles(value.dir);
            })
            .catch(reason => vscode.window.showErrorMessage(reason));
    }
    public MyTest() {
        Ts.LogServer(this.attachingDev).then(value => console.log(value), err => console.log(err));
    }
    private GetProjectFileList(): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            let ret = new Array();

            let includePathArr: Array<string> | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
            if (includePathArr && includePathArr.length > 0) {
                Promise.all(includePathArr.map((value) => {
                    let pathName: string = value;
                    let fileArr: string[] = fs.readdirSync(pathName);
                    let newArr = fileArr.filter(str => {
                        return str.indexOf(".lua") >= 0 || str.indexOf(".png") >= 0 || str.indexOf(".txt") >= 0;
                    });
                    for (let f of newArr) {
                        ret.push({ dir: pathName, f: f });
                    }
                }))
            }

            let name = vscode.window.activeTextEditor?.document;
            if (name) {
                let pathName: string = path.dirname(name.fileName);
                let fileArr: string[] = fs.readdirSync(pathName);
                let newArr = fileArr.filter(str => {
                    return str.indexOf(".lua") >= 0 || str.indexOf(".png") >= 0 || str.indexOf(".txt") >= 0;
                });
                if (fileArr.includes("main.lua")) {
                    for (let f of newArr) {
                        ret.push({ dir: pathName, f: f });
                    }
                    resolve(ret);
                } else {
                    reject('所选工程必须包含main.lua文件')
                }
            } else {
                reject('请先选择工程');
            }
        })
    }
    private GetIncludeFileList(): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            let ret = new Array();
            let pathArr: Array<string> | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.includePath');
            if (pathArr && pathArr.length > 0) {
                Promise.all(pathArr.map((value) => {
                    let pathName: string = value;
                    let fileArr: string[] = fs.readdirSync(pathName);
                    let newArr = fileArr.filter(str => {
                        return str.indexOf(".lua") >= 0 || str.indexOf(".png") >= 0 || str.indexOf(".txt") >= 0;
                    });
                    for (let f of newArr) {
                        ret.push({ dir: pathName, f: f });
                    }
                }))
                    .then(() => { resolve(ret); })
            } else {
                reject();
            }
        })
    }
}

class Ts {
    public static MyHttpPost(options: http.RequestOptions, postData: any): Promise<string> {
        return new Promise((resolve, reject) => {
            let req = http.request(options, (res) => {
                if (res.statusCode != 200) {
                    res.resume();
                    reject('请求失败\n' + `状态码: ${res.statusCode}`);
                } else {
                    res.setEncoding('utf8');
                    let rawData = '';
                    res.on('data', (chunk) => { rawData += chunk; });
                    res.on('end', () => { resolve(rawData); });
                }
            }).on('error', (e) => {
                reject(e.message);
            });
            req.write(postData);
            req.end();
        });
    }
    public static MyHttpGet(options: http.RequestOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            let req = http.request(options, (res) => {
                if (res.statusCode != 200) {
                    res.resume();
                    reject('请求失败\n' + `状态码: ${res.statusCode}`);
                } else {
                    res.setEncoding('utf8');
                    let rawData = '';
                    res.on('data', (chunk) => { rawData += chunk; });
                    res.on('end', () => { resolve(rawData); });
                }
            }).on('error', (e) => {
                reject(e.message);
            });
            req.end()
        })
    }
    public static GetAuth(dev: Device, key: string) {
        let postData = JSON.stringify({
            "action": "getAuth",
            "key": key,
            "devices": [dev.deviceId],
            "valid": 3600,
            "time": Math.floor(Date.now() / 1000)
        });
        let options = {
            hostname: 'openapi.touchsprite.com',
            port: 80,
            path: '/api/openapi',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            }
        };
        return this.MyHttpPost(options, postData);
    }
    public static GetDeviceId(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/deviceid',
            method: 'GET',
            headers: {
                'Connection': 'close',
                'Content-Length': 0
            }
        };
        return this.MyHttpGet(options);
    }
    public static GetDeviceName(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/devicename',
            method: 'GET',
            headers: {
                'Connection': 'close',
                'Content-Length': 0,
                'auth': dev.auth
            }
        };
        return this.MyHttpGet(options);
    }
    public static GetStatus(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/status',
            method: 'GET',
            headers: {
                'auth': dev.auth
            }
        };
        return this.MyHttpGet(options);
    }
    public static GetPicture(dev: Device): Promise<string> {
        let ori: number | undefined = vscode.workspace.getConfiguration().get('touchsprite-extension.snapshotDir');
        if (ori == 0 || ori == 1) {
            ori = ori;
        } else {
            ori = 0;
        }
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/snapshot',
            method: 'GET',
            ext: "png",
            orient: ori,
            headers: {
                'auth': dev.auth
            }
        };
        return new Promise((resolve, reject) => {
            let req = http.request(options, (res) => {
                if (res.statusCode != 200) {
                    res.resume();
                    reject('请求失败\n' + `状态码: ${res.statusCode}`);
                } else {
                    res.setEncoding('binary');
                    let rawData = '';
                    res.on('data', (chunk) => { rawData += chunk; });
                    res.on('end', () => { resolve(rawData); });
                }
            }).on('error', (e) => {
                reject(e.message);
            });
            req.end()
        })
    }
    public static LogServer(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/logServer',
            method: 'GET',
            headers: {
                'auth': dev.auth,
                'server': '192.168.6.100',
                'port': 14088
            }
        }
        return this.MyHttpGet(options);
    }
    public static SetLuaPath(dev: Device): Promise<string> {
        let luaPath: string;
        if (dev.name == "iPhone") {
            luaPath = "/var/mobile/Media/TouchSprite/lua/main.lua"
        } else {
            luaPath = "/storage/emulated/0/TouchSprite/lua/main.lua"
        }
        let postData = JSON.stringify({
            "path": luaPath
        });
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/setLuaPath',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'auth': dev.auth
            }
        };
        return this.MyHttpPost(options, postData);
    }
    public static RunLua(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/runLua',
            method: 'GET',
            headers: {
                'auth': dev.auth
            }
        }
        return this.MyHttpGet(options);
    }
    public static StopLua(dev: Device): Promise<string> {
        let options = {
            hostname: dev.ip,
            port: 50005,
            path: '/stopLua',
            method: 'GET',
            headers: {
                'auth': dev.auth
            }
        }
        return this.MyHttpGet(options)
    }
    public static async Upload(dev: Device, filename: string, filepath: string): Promise<any> {
        try {
            console.log(`${filepath}\\${filename}`)
            let postData: Buffer = await new Promise((resolve, reject) => {
                fs.readFile(`${filepath}\\${filename}`, (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            })
            let options = {
                hostname: dev.ip,
                port: 50005,
                path: '/upload',
                method: 'POST',
                headers: {
                    'Content-Type': 'touchsprite/uploadfile',
                    'Content-Length': Buffer.byteLength(postData),
                    'auth': dev.auth,
                    'root': 'lua',
                    'path': '/',
                    'filename': filename,
                    'Connection': 'close'
                }
            };
            return Ts.MyHttpPost(options, postData);
        }
        catch (err) {
            console.log("上传失败:" + err);
        }
    }
}

class Ziper extends JSZip {
    public addFiles(files: string[], pathName: string) {
        return Promise.all(files.map(file => {
            let data = fs.readFileSync(pathName + "\\" + file);
            this.file(file, data);
        }))
    }
    public addFile(fileName: string, pathName: string) {
        let data = fs.readFileSync(pathName + "\\" + fileName);
        this.file(fileName, data);
    }
    public zipFiles(pathName: string) {
        this.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
            .pipe(fs.createWriteStream(pathName + '.zip'))
            .on('finish', function () {
                vscode.window.showInformationMessage("项目已打包完成");
            })
    }
}