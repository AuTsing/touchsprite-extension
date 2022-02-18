import * as Fs from 'fs';
import * as Path from 'path';
import * as Jszip from 'jszip';
import { ITsFile } from './Device';
import * as Ui from './Ui';
import Projector, { EProjectMode } from './Projector';

export default class Zipper extends Jszip {
    private readonly output: Ui.Output;
    private readonly statusBar: Ui.StatusBar;

    constructor() {
        super();
        this.output = Ui.useOutput();
        this.statusBar = Ui.useStatusBar();
    }

    private addFiles(files: ITsFile[]) {
        for (const file of files) {
            const data = Fs.readFileSync(file.url);
            const relativePath = file.path.substring(1);
            const path = Path.join(relativePath, file.filename).replace(/\\/g, '/');
            this.file(path, data);
        }
    }

    private async zip(dir: string, filename: string): Promise<string> {
        const url = await new Promise<string>((resolve, reject) => {
            const url = Path.join(dir, filename);
            this.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
                .pipe(Fs.createWriteStream(url))
                .on('finish', () => resolve(url))
                .on('error', e => reject(e));
        });
        return url;
    }

    public async zipProject(): Promise<string | undefined> {
        const doing = this.statusBar.doing('打包工程中');
        try {
            const projector = new Projector(undefined, EProjectMode.zip);
            const tsFiles = projector.generate();
            this.addFiles(tsFiles);
            const root = projector.locateRoot();
            const dir = Path.dirname(root);
            const filename = Path.basename(root) + '.zip';
            const url = await this.zip(dir, filename);

            this.output.info('打包工程成功: ' + url);
            doing.dispose();
            return url;
        } catch (e) {
            this.output.error('打包工程失败: ' + (e as Error).message);
        }
        doing.dispose();
    }
}
