export default class Device {
    public ip: string;
    public id: string;
    public auth: string;
    public name: string;
    public osType: string;

    constructor(ip: string, id: string, auth: string, name: string, osType: string) {
        this.ip = ip;
        this.id = id;
        this.auth = auth;
        this.name = name;
        this.osType = osType;
    }
}
