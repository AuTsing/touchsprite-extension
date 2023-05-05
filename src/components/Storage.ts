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
}

export default class Storage {
    private readonly state: Vscode.Memento;
    private readonly configuration: Vscode.WorkspaceConfiguration;

    constructor(context: Vscode.ExtensionContext) {
        this.state = context.globalState;
        this.configuration = Vscode.workspace.getConfiguration(TS_NS);
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

    getConfiguration(key: Configurations): string | string[] {
        switch (key) {
            case Configurations.Cookie:
                return this.configuration.get<string>(Configurations.Cookie) ?? '';
            case Configurations.AccessKey:
                return this.configuration.get<string>(Configurations.AccessKey) ?? '';
            case Configurations.SnapOrient:
                return this.configuration.get<string>(Configurations.SnapOrient) ?? '';
            case Configurations.SnapDir:
                return this.configuration.get<string>(Configurations.SnapDir) ?? '';
            case Configurations.IncludeWhenSend:
                return this.configuration.get<string[]>(Configurations.IncludeWhenSend) ?? [];
            case Configurations.ExcludeWhenSend:
                return this.configuration.get<string[]>(Configurations.ExcludeWhenSend) ?? [];
            case Configurations.IncludeWhenZip:
                return this.configuration.get<string[]>(Configurations.IncludeWhenZip) ?? [];
            case Configurations.ExcludeWhenZip:
                return this.configuration.get<string[]>(Configurations.ExcludeWhenZip) ?? [];
        }
    }
}
