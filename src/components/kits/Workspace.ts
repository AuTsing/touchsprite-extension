import ProjectGenerator from '../ProjectGenerator';

export default class Workspace {
    public getRoot() {
        const pjg = new ProjectGenerator();
        pjg.generateZip();
        if (!pjg.focusing) {
            return Promise.reject('未指定工程');
        }
        if (!pjg.projectRoot) {
            return Promise.reject('所选工程不包含引导文件 main.lua');
        }
        return Promise.resolve(pjg.projectRoot);
    }
}
