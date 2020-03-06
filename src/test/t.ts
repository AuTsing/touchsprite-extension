import { EventEmitter } from 'events';
import * as http from 'http';
import * as fs from 'fs';

export class Device {
  public ip: string;
  public name!: string;
  public deviceId!: string;
  public auth!: string;
  public expire!: number;

  constructor(ip: string) {
    this.ip = ip;
  }
  public init(key: string): Promise<this> {
    return new Promise((resolve, reject) => {
      Ts.GetDeviceId(this)
        .then(value => {
          // console.log(value);
          this.deviceId = value
          return Ts.GetAuth(this, key);
        }).then(value => {
          let json = JSON.parse(value);
          // console.log(json);
          this.auth = json.auth;
          this.expire = json.time + json.valid;
        }).then(() => {
          resolve(this);
        }).catch(err => {
          console.log(err);
          reject(err);
        });
    })
  }
}

export class Server {
  public attachingDev: Device | undefined;
  public key: string;

  constructor() {
    this.key = "IvjV5W5ps1BlzG9sTVDQgWZ7MFGhwZ1FZzshlhiUwo7sE5TKgKhBBcZk9xPpJ91S";
    console.log("服务已开启");
  }

  public async Connect(ip: string) {
    let dev = new Device(ip);
    try {
      const value = await dev.init(this.key);
      this.attachingDev = value;
      console.log(`设备:${dev.ip}添加成功`)
    }
    catch (err) {
      console.log(err);
    }
  }
  public GetAttachedDevice() {
    if (this.attachingDev) {
      console.log("已连接设备:");
      console.log(this.attachingDev);
    } else {
      console.log("未连接设备");
    }
  }
  public GetStatus() {
    if (this.attachingDev) {
      return Ts.GetStatus(this.attachingDev).then(value => console.log("手机状态:" + value), err => console.log(err));
    } else {
      console.log("未连接设备");
    }
  }
  public GetPicture() {
    if (this.attachingDev) {
      return Ts.GetPicture(this.attachingDev).then(value => {
        fs.writeFile("snapshot.png", value, "binary", (err) => {
          if (err) {
            console.log("截图失败");
          } else {
            console.log("截图成功");
          }
        });
      }, err => console.log(err));
    } else {
      console.log("未连接设备");
    }
  }
  public LogServer() {
    if (this.attachingDev) {
      return Ts.LogServer(this.attachingDev).then(value => console.log("远程日志:" + value), err => console.log(err));
    } else {
      console.log("未连接设备");
    }
  }
  public SetLuaPath() {
    if (this.attachingDev) {
      return Ts.SetLuaPath(this.attachingDev).then(value => console.log("设置运行路径:" + value), err => console.log(err));
    } else {
      console.log("未连接设备");
    }
  }
  public RunLua() {
    if (this.attachingDev) {
      return Ts.RunLua(this.attachingDev).then(value => console.log("运行脚本:" + value), err => console.log(err));
    } else {
      console.log("未连接设备");
    }
  }
  public StopLua() {
    if (this.attachingDev) {
      return Ts.StopLua(this.attachingDev).then(value => console.log("停止脚本:" + value), err => console.log(err));
    } else {
      console.log("未连接设备");
    }
  }
  public Upload(filename: string) {
    if (this.attachingDev) {
      return Ts.Upload(this.attachingDev, filename).then(value => console.log("上传文件:" + value), err => console.log(err));
    } else {
      console.log("未连接设备");
    }
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
        'Content-Length': 0
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
    let options = {
      hostname: dev.ip,
      port: 50005,
      path: '/snapshot',
      method: 'GET',
      ext: "png",
      orient: 0,
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
        'auth': dev.auth
      }
    }
    return this.MyHttpGet(options);
  }
  public static SetLuaPath(dev: Device): Promise<string> {
    let postData = JSON.stringify({
      "path": "/var/mobile/Media/TouchSprite/lua/main.lua"
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
  public static async Upload(dev: Device, filename: string): Promise<any> {
    try {
      let postData: Buffer = await new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
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
let server = new Server();

class Extension {
  public TsConnect(ip: string = "192.168.6.112"): void {
    server.Connect(ip);
  }
  public TsCheck(): void {
    server.GetAttachedDevice();
    // server.GetStatus();
  }
  public TsSnapshot(): void {
    server.GetPicture();
  }
};

let ext = new Extension();

function delay(t: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, t));
}

server.Connect("192.168.6.111")
  .then(() => {
    server.GetAttachedDevice();
    return server.GetStatus();
  })
  // .then(() => {
  //   server.GetPicture();
  //   return Promise.reject("停止");
  // })
  // .then(() => {
  //   return server.SetLuaPath();
  // })
  .then(() => {
    return delay(1000);
  })
  // .then(() => {
  //   return server.GetStatus();
  // })
  // .then(() => {
  //   return delay(3000);
  // })
  // .then(() => {
  //   return server.StopLua();
  // })
  .then(() => {
    return server.Upload("main.lua");
  })
  .then(() => {
    return server.RunLua();
  })
  .catch(err => console.log(err));

// fs.readFile('test.lua', (err, data) => {
//   if (err) {
//     console.log(err);
//   } else {
//     console.log(data);
//   }
// });