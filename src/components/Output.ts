import * as Vscode from 'vscode';
import * as Util from 'util';

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

    private readonly channel: Vscode.LogOutputChannel;

    constructor() {
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
}
