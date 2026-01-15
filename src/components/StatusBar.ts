import * as Vscode from 'vscode';

export class StatusItem {
    prefix: string;
    content: string;
    surfix: string;
    private readonly statusItems: StatusItem[];

    constructor(content: string, statusItems: StatusItem[], prefix: string = '', surfix: string = '') {
        this.content = content;
        this.statusItems = statusItems;
        this.prefix = prefix;
        this.surfix = surfix;
    }

    public display(): string {
        return `${this.prefix} ${this.content} ${this.surfix}`;
    }

    public dispose() {
        const index = this.statusItems.indexOf(this);
        if (index > -1) {
            this.statusItems.splice(index, 1);
        }
    }

    public updateProgress(percent: number) {
        this.prefix = `${Math.round(percent * 100)}%`;
    }
}

export default class StatusBar implements Vscode.Disposable {
    static instance?: StatusBar;

    static connected(label: string) {
        if (!StatusBar.instance) {
            return;
        }
        const statusItem = new StatusItem(label, StatusBar.instance.statusItems, '📱', '已连接');
        StatusBar.instance.statusItems.push(statusItem);
    }

    static disconnected() {
        if (!StatusBar.instance) {
            return;
        }
        for (let i = 1; i < StatusBar.instance.statusItems.length; i++) {
            StatusBar.instance.statusItems[i]?.dispose();
        }
    }

    static doing(task: string): StatusItem | undefined {
        if (!StatusBar.instance) {
            return;
        }
        const statusItem = new StatusItem(task, StatusBar.instance.statusItems, '$(loading~spin)', '...');
        StatusBar.instance.statusItems.push(statusItem);
        StatusBar.instance.refresh();
        return statusItem;
    }

    static running(label?: string) {
        if (!StatusBar.instance) {
            return;
        }
        if (!label) {
            StatusBar.instance.runningStatusItem.dispose();
            return;
        }
        StatusBar.instance.runningStatusItem.content = label;
        StatusBar.instance.statusItems.push(StatusBar.instance.runningStatusItem);
        StatusBar.instance.refresh();
    }

    static result(label: string) {
        if (!StatusBar.instance) {
            return;
        }
        const statusItem = new StatusItem(label, StatusBar.instance.statusItems, '✅');
        StatusBar.instance.statusItems.push(statusItem);
        StatusBar.instance.refresh();
        setTimeout(() => statusItem.dispose(), 1500);
    }

    static refresh() {
        if (!StatusBar.instance) {
            return;
        }
        StatusBar.instance.refresh();
    }

    private readonly statusBarItem: Vscode.StatusBarItem;
    private readonly statusItems: StatusItem[];
    private refresher: NodeJS.Timeout;
    private runningStatusItem: StatusItem;

    constructor() {
        this.statusBarItem = Vscode.window.createStatusBarItem(Vscode.StatusBarAlignment.Left);
        this.statusItems = [];
        this.refresher = setInterval(() => this.refresh(), 1000);
        this.runningStatusItem = new StatusItem('', this.statusItems, '$(loading~spin)', '运行中');
        const defaultStatusItem = new StatusItem('触动插件', this.statusItems, '📴');
        this.statusItems.push(defaultStatusItem);
        this.statusBarItem.text = defaultStatusItem.display();
        this.statusBarItem.tooltip = '触动插件';
        this.statusBarItem.command = 'touchsprite-extension.clickStatusBarItem';
        this.statusBarItem.show();
    }

    private refresh() {
        const statusItem = this.statusItems[this.statusItems.length - 1];
        this.statusBarItem.text = statusItem.display();
        if (this.statusItems.includes(this.runningStatusItem)) {
            this.statusBarItem.tooltip = '停止工程';
        } else if (this.statusItems.length > 1) {
            this.statusBarItem.tooltip = '断开设备';
        } else {
            this.statusBarItem.tooltip = '连接设备';
        }
    }

    handleClickStatusBarItem() {
        if (this.statusItems.includes(this.runningStatusItem)) {
            Vscode.commands.executeCommand('touchsprite-extension.stopScript');
            return;
        }
        if (this.statusItems.length > 1) {
            Vscode.commands.executeCommand('touchsprite-extension.detachDevice');
            return;
        }
        Vscode.commands.executeCommand('touchsprite-extension.attachDeviceByInput');
    }

    dispose() {
        this.statusBarItem.hide();
        clearInterval(this.refresher);
        StatusBar.instance = undefined;
    }
}
