import StatusBar from './StatusBar';
import Output from './Output';
import Pop from './Pop';
import Device from '../Device';

export default class Ui {
    private static statusBar: StatusBar = new StatusBar();
    private static outputChannel: Output = new Output();
    private static pop: Pop = new Pop();

    public static doing = (text: string, prefix?: string) => Ui.statusBar.doing(text, prefix);
    public static attachDevice = (device: Device) => Ui.statusBar.attachDevice(device);
    public static detachDevice = () => Ui.statusBar.detachDevice();

    public static output = (content: string, level?: number) => Ui.outputChannel.output(content, level);
    public static outputWarn = (content: string) => Ui.outputChannel.outputWarn(content);
    public static outputError = (content: string) => Ui.outputChannel.outputError(content);
    public static outputShow = () => Ui.outputChannel.outputShow();
    public static enableDebugChannel = () => Ui.outputChannel.enableDebugChannel();
    public static outputDebug = (content: string) => Ui.outputChannel.outputDebug(content);

    public static popMessage = (content: string) => Ui.pop.popMessage(content);
    public static popError = (content: string) => Ui.pop.popError(content);
    public static popWarning = (content: string) => Ui.pop.popMessage(content);
}
