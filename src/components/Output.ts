import * as Vscode from 'vscode';
import * as Util from 'util';
import * as Fs from 'node:fs';
import * as Path from 'node:path';

export default class Output implements Vscode.Disposable {
    static instance?: Output;

    static println(...args: any[]) {
        Output.instance?.println(...args);
    }

    static printlnAndShow(...args: any[]) {
        Output.instance?.println(...args);
        Output.instance?.show();
    }

    static wprintln(...args: any[]) {
        Output.instance?.wprintln(...args);
    }

    static eprintln(...args: any[]) {
        Output.instance?.eprintln(...args);
    }

    static logln(...args: any[]) {
        Output.instance?.logln(...args);
    }

    static wlogln(...args: any[]) {
        Output.instance?.wlogln(...args);
    }

    static elogln(...args: any[]) {
        Output.instance?.elogln(...args);
    }

    private readonly context: Vscode.ExtensionContext;
    private readonly channel: Vscode.LogOutputChannel;

    constructor(context: Vscode.ExtensionContext) {
        this.context = context;
        this.channel = Vscode.window.createOutputChannel('触动插件', { log: true });
    }

    println(...args: any[]) {
        this.channel.info(Util.format(...args));
    }

    wprintln(...args: any[]) {
        this.channel.warn(Util.format(...args));
    }

    eprintln(...args: any[]) {
        this.channel.error(Util.format(...args));
        this.show();
    }

    show() {
        this.channel.show(true);
    }

    dispose() {
        Output.instance = undefined;
    }

    private getLogFilename(): string {
        const date = new Date();
        const y = `${date.getFullYear()}`;
        const m = `00${date.getMonth() + 1}`.slice(-2);
        const d = `00${date.getDate()}`.slice(-2);
        return `Log_${y}${m}${d}.log`;
    }

    logln(...args: any[]) {
        const filename = this.getLogFilename();
        const timestamp = new Date().toLocaleString();
        const content = `[${timestamp}] ${Util.format(...args)}\n`;
        const logDir = this.context.storageUri?.fsPath;
        if (!logDir) {
            return;
        }
        if (!Fs.existsSync(logDir)) {
            Fs.mkdirSync(logDir);
        }
        const path = Path.join(logDir, filename);
        Fs.appendFileSync(path, content);
    }

    wlogln(...args: any[]) {
        this.logln('[Warn]', ...args);
    }

    elogln(...args: any[]) {
        this.logln('[Error]', ...args);
    }
}
