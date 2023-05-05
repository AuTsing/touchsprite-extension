import * as FsPromises from 'fs/promises';
import * as Fs from 'fs';
import * as Path from 'path';
import * as Jszip from 'jszip';
import { TsFile } from './Device';
import Projector, { ProjectMode } from './Projector';
import StatusBar from './StatusBar';
import Output from './Output';
import Storage from './Storage';

export default class Zipper extends Jszip {
    private readonly storage: Storage;

    constructor(storage: Storage) {
        super();
        this.storage = storage;
    }

    private async addFiles(files: TsFile[]): Promise<void> {
        for (const file of files) {
            const data = await FsPromises.readFile(file.url);
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

    public async handleZipProject(): Promise<string> {
        const doing = StatusBar.doing('打包工程中');
        try {
            const projector = new Projector(this.storage, undefined, ProjectMode.zip);
            const tsFiles = await projector.generate();
            await this.addFiles(tsFiles);
            const root = await projector.locateRoot();
            const dir = Path.dirname(root);
            const filename = Path.basename(root) + '.zip';
            const url = await this.zip(dir, filename);

            Output.println('打包工程成功:', url);
            StatusBar.result('打包工程成功');
            return url;
        } catch (e) {
            Output.eprintln('打包工程失败:', (e as Error).message ?? e);
            return '';
        } finally {
            doing?.dispose();
        }
    }
}
