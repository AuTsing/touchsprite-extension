import * as vscode from 'vscode';
import Device from '../Device';

interface ITaks {
    prefix: string;
    text: string;
    surfix: string;
}

class StatusBar {
    private readonly statusBar: vscode.StatusBarItem;
    private attachingDevice: Device | undefined;
    private readonly defaultText = '触动插件';
    private taskList: ITaks[] = [];

    constructor() {
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.statusBar.tooltip = '触动插件: 连接/断开设备';
        this.statusBar.command = 'extension.menus';
        this.statusBar.text = this.defaultText;
        setInterval(() => this.refresh(), 1000);
        this.statusBar.show();
    }

    private getText(): string {
        if (this.taskList.length > 0) {
            const task = this.taskList[this.taskList.length - 1];
            const text = `${task.prefix} ${task.text} ${task.surfix}`;
            return text;
        } else if (this.attachingDevice) {
            return `📱 ${this.attachingDevice.ip}`;
        } else {
            return `📴 触动插件`;
        }
    }

    public refresh() {
        const text = this.getText();
        if (text === this.statusBar.text) {
            return;
        } else {
            this.statusBar.text = text;
        }
    }

    public doing(text: string, prefix: string = '$(loading~spin)') {
        const task: ITaks = { prefix: prefix, text: text, surfix: '...' };
        this.taskList.push(task);
        this.refresh();
        return {
            disposer: () => {
                this.taskList.splice(this.taskList.indexOf(task), 1);
            },
            setProgress: (percent: number) => {
                this.taskList[this.taskList.indexOf(task)].prefix = `${Math.round(percent * 100)}%`;
                this.refresh();
            },
        };
    }

    public attachDevice(device: Device) {
        this.attachingDevice = device;
    }

    public detachDevice() {
        this.attachingDevice = undefined;
    }
}

export default StatusBar;
