export default class Version {
    private ver: string;
    private verMajor: number;
    private verMinor: number;
    private verPatch: number;

    constructor(ver: string) {
        this.ver = ver;
        const vers = ver.split('.');
        this.verMajor = parseInt(vers[0]);
        this.verMinor = parseInt(vers[1]);
        this.verPatch = parseInt(vers[2]);
    }

    public major() {
        this.verMajor += 1;
        this.verMinor = 0;
        this.verPatch = 0;
        this.ver = `${this.verMajor}.${this.verMinor}.${this.verPatch}`;
        return this;
    }

    public minor() {
        this.verMinor += 1;
        this.verPatch = 0;
        this.ver = `${this.verMajor}.${this.verMinor}.${this.verPatch}`;
        return this;
    }

    public patch() {
        this.verPatch += 1;
        this.ver = `${this.verMajor}.${this.verMinor}.${this.verPatch}`;
        return this;
    }

    public get() {
        return this.ver;
    }
}
