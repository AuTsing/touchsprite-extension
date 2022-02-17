import * as Vscode from 'vscode';

export class Output {
    private static instance: Output;
    private readonly channel: Vscode.OutputChannel;

    private constructor() {
        this.channel = Vscode.window.createOutputChannel('触动插件');
    }

    public static getInstance() {
        if (!Output.instance) {
            Output.instance = new Output();
        }

        return Output.instance;
    }

    private getTimestamp() {
        const time = new Date().toLocaleString('chinese', { hour12: false });
        return `[${time}]`;
    }

    public info(content: string, level: number = 0) {
        content = `${this.getTimestamp()} ${content}`;
        switch (level) {
            case 1:
                this.channel.appendLine(content);
                this.channel.show(true);
                break;
            case 2:
                this.channel.appendLine(content);
                this.channel.show();
                break;
            case 0:
            default:
                this.channel.appendLine(content);
                break;
        }
    }

    public warning(content: string) {
        content = `[WARN] ${content}`;
        return this.info(content, 1);
    }

    public error(content: string) {
        content = `[ERROR] ${content}`;
        return this.info(content, 1);
    }
}

export class Pop {
    private static instance: Pop;

    private constructor() {}

    public static getInstance() {
        if (!Pop.instance) {
            Pop.instance = new Pop();
        }

        return Pop.instance;
    }

    public info(content: string) {
        Vscode.window.showInformationMessage(content);
    }

    public warning(content: string) {
        Vscode.window.showWarningMessage(content);
    }

    public error(content: string) {
        Vscode.window.showErrorMessage(content);
    }
}

export class StatusBarItem {
    public prefix: string;
    public text: string;
    public surfix: string;
    private readonly list: StatusBarItem[];

    constructor(text: string, list: StatusBarItem[], prefix: string = '', surfix: string = '') {
        this.text = text;
        this.list = list;
        this.prefix = prefix;
        this.surfix = surfix;
    }

    public display(): string {
        return `${this.prefix} ${this.text} ${this.surfix}`;
    }

    public dispose() {
        this.list.splice(this.list.indexOf(this), 1);
    }

    public updateProgress(percent: number) {
        this.prefix = `${Math.round(percent * 100)}%`;
    }
}

export class StatusBar {
    private static instance: StatusBar;
    private readonly statusBar: Vscode.StatusBarItem;
    private readonly tasks: StatusBarItem[];
    private readonly devices: StatusBarItem[];
    private readonly txts: StatusBarItem[];

    private constructor() {
        this.tasks = [];
        this.devices = [];
        this.txts = [];
        this.txts.push(new StatusBarItem('触动插件', this.txts, '📴'));

        this.statusBar = Vscode.window.createStatusBarItem(Vscode.StatusBarAlignment.Left);
        this.statusBar.tooltip = '触动插件: 命令菜单';
        this.statusBar.command = 'touchsprite-extension.commandMenu';
        this.statusBar.text = this.txts[0].display();
        this.statusBar.show();
        setInterval(() => this.refresh(), 1000);
    }

    public static getInstance() {
        if (!StatusBar.instance) {
            StatusBar.instance = new StatusBar();
        }

        return StatusBar.instance;
    }

    private getTxt(): string {
        if (this.tasks.length > 0) {
            const last = this.tasks[this.tasks.length - 1];
            const content = last.display();
            return content;
        }

        if (this.devices.length > 0) {
            const last = this.devices[this.devices.length - 1];
            const content = last.display();
            return content;
        }

        const last = this.txts[this.txts.length - 1];
        const content = last.display();
        return content;
    }

    public refresh() {
        const content = this.getTxt();
        if (content === this.statusBar.text) {
            return;
        }

        this.statusBar.text = content;
    }

    public attach(ip: string) {
        const device = new StatusBarItem(ip, this.devices, '📱');
        this.devices.push(device);
        this.refresh();
        return device;
    }

    public doing(text: string) {
        const task = new StatusBarItem(text, this.tasks, '$(loading~spin)', '...');
        this.tasks.push(task);
        this.refresh();
        return task;
    }

    public async menu() {
        const commandTitles = [
            '触动插件: 连接设备(手动输入)',
            '触动插件: 连接设备(搜索设备)',
            '触动插件: 断开连接',
            '触动插件: 运行工程',
            '触动插件: 运行测试工程',
            '触动插件: 运行当前脚本',
            '触动插件: 停止运行',
            '触动插件: 上传文件',
            '触动插件: 清空脚本',
            '触动插件: 打包工程',
            '触动插件: 发布工程',
        ];
        const commands = [
            'touchsprite-extension.attachDeviceByInput',
            'touchsprite-extension.attachDeviceBySearch',
            'touchsprite-extension.detachDevice',
            'touchsprite-extension.runProject',
            'touchsprite-extension.runTestProject',
            'touchsprite-extension.runScript',
            'touchsprite-extension.stopScript',
            'touchsprite-extension.uploadFile',
            'touchsprite-extension.clearScript',
            'touchsprite-extension.zipProject',
            'touchsprite-extension.releaseProject',
        ];

        const selectedTitle = await Vscode.window.showQuickPick(commandTitles);
        if (!selectedTitle) {
            return;
        }

        const selectedIndex = commandTitles.indexOf(selectedTitle);
        const command = commands[selectedIndex];

        Vscode.commands.executeCommand(command);
    }
}

export const useOutput = () => Output.getInstance();
export const usePop = () => Pop.getInstance();
export const useStatusBar = () => StatusBar.getInstance();