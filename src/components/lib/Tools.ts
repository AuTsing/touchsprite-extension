import * as path from 'path';

export default class Tools {
    public static vscodeExtensionPath: string;
    public static adapterVersion: string;
    public static developmentMode: boolean = false;

    // 获取扩展中预置的lua文件位置
    public static getClibPathInExtension(): string {
        let ClibPathInVSCodeExtension = this.vscodeExtensionPath + '/Debugger/debugger_lib/plugins/';
        return ClibPathInVSCodeExtension;
    }

    // 把传入的路径转为标准路径
    public static genUnifiedPath(beProcessPath: string): string {
        //全部使用 /
        beProcessPath = beProcessPath.replace(/\\/g, '/');
        while (beProcessPath.match(/\/\//)) {
            beProcessPath = beProcessPath.replace(/\/\//g, '/');
        }
        //win盘符转为小写
        beProcessPath = beProcessPath.replace(/^\w:/, function ($1) {
            return $1.toLocaleLowerCase();
        });
        return beProcessPath;
    }

    // 从URI分析出文件名和后缀
    public static getPathNameAndExt(UriOrPath: string) {
        let name_and_ext = path.basename(UriOrPath).split('.');
        let name = name_and_ext[0]; //文件名
        let ext = name_and_ext[1] || ''; //文件后缀
        for (let index = 2; index < name_and_ext.length; index++) {
            ext = ext + '.' + name_and_ext[index];
        }
        return { name, ext, dir: '.' };
    }
}
