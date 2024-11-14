import * as Vscode from 'vscode';
import { TS_NS } from '../values/Constants';

export enum Configurations {
    Cookie = 'cookie',
    AccessKey = 'accessKey',
    SnapOrient = 'snapOrient',
    SnapDir = 'snapDir',
    IncludeWhenSend = 'includeWhenSend',
    ExcludeWhenSend = 'excludeWhenSend',
    IncludeWhenZip = 'includeWhenZip',
    ExcludeWhenZip = 'excludeWhenZip',
    IsIosPersonal = 'isIosPersonal',
}

export default class Storage {
    private readonly state: Vscode.Memento;

    constructor(context: Vscode.ExtensionContext) {
        this.state = context.globalState;
    }

    getDeviceIps(): string[] {
        return this.state.get('deviceIps', []);
    }

    setDeviceIps(deviceIps: string[] = []) {
        this.state.update('deviceIps', deviceIps);
    }

    addDeviceIp(deviceIp: string) {
        const deviceIps = this.getDeviceIps();
        const index = deviceIps.indexOf(deviceIp);
        if (index > -1) {
            deviceIps.splice(index, 1);
        }
        deviceIps.push(deviceIp);
        this.setDeviceIps(deviceIps);
    }

    getStringConfiguration(key: Configurations): string {
        const configuration = Vscode.workspace.getConfiguration(TS_NS);
        switch (key) {
            case Configurations.Cookie:
                return configuration.get<string>(Configurations.Cookie) ?? '';
            case Configurations.AccessKey:
                return configuration.get<string>(Configurations.AccessKey) ?? '';
            case Configurations.SnapOrient:
                return configuration.get<string>(Configurations.SnapOrient) ?? '';
            case Configurations.SnapDir:
                return configuration.get<string>(Configurations.SnapDir) ?? '';
        }
        throw Error('未定义的设置项');
    }

    getStringArrayConfiguration(key: Configurations): string[] {
        const configuration = Vscode.workspace.getConfiguration(TS_NS);
        switch (key) {
            case Configurations.IncludeWhenSend:
                return configuration.get<string[]>(Configurations.IncludeWhenSend) ?? [];
            case Configurations.ExcludeWhenSend:
                return configuration.get<string[]>(Configurations.ExcludeWhenSend) ?? [];
            case Configurations.IncludeWhenZip:
                return configuration.get<string[]>(Configurations.IncludeWhenZip) ?? [];
            case Configurations.ExcludeWhenZip:
                return configuration.get<string[]>(Configurations.ExcludeWhenZip) ?? [];
        }
        throw Error('未定义的设置项');
    }

    getBooleanConfiguration(key: Configurations): boolean {
        const configuration = Vscode.workspace.getConfiguration(TS_NS);
        switch (key) {
            case Configurations.IsIosPersonal:
                return configuration.get<boolean>(Configurations.IsIosPersonal) ?? false;
        }
        throw Error('未定义的设置项');
    }
}
