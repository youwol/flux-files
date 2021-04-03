

class MockFileHandler{
    public readonly kind = 'file'
    public readonly name

    constructor(public readonly mockData, public readonly id, public readonly content){
        if(id[0]=='/') {
            id = id.slice(1) 
        }
        this.name = this.id.split('/').slice(-1)[0]
    }

    async getFile() {
        return new Promise((cb) => cb(new Blob([this.content])) )
    }

    async createWritable(){
        return {
            write: (content) =>{
                let folder = this.id.split('/').slice(0,-1).join('/')
                this.mockData[folder].files[this.id] = content
            },
            close: () => {}
        }
    }
}

async function* generateSequence( mockData, files, folders) {
    
    for (let [name, content] of Object.entries(files)) {  
      let fileHandler = new MockFileHandler(mockData, name, content)
      yield [name, fileHandler];
    }  
    for (let name of folders) {
        let handler = new MockFolderHandler(mockData, name )    
        yield [name, handler];
      }  
}

export class MockFolderHandler{

    kind = 'directory'
    name: string
    constructor(public readonly mockData, public readonly id: string = ""){
        this.name = this.id.split('/').slice(-1)[0]
    }

    async getFile(fileId: string){
        return new Promise( (cb) => cb(this.mockData[this.id].files[fileId]) )
    }
    getData(){
        return this.mockData
    }
    entries(){
        
        return generateSequence(this.mockData, this.mockData[this.id].files, this.mockData[this.id].folders);
    }

    async resolve(fileHandle: MockFileHandler) {
        return fileHandle.id.split('/')
    }

    async getFileHandle(filename: string, {create} : {create:boolean}) {
        let path = this.id != "" ? this.id+'/'+filename : filename
        let content = ""
        !this.mockData[this.id] && (this.mockData[this.id] = { files:{}, folders:[]})
        this.mockData[this.id].files[path] = content 
        return new MockFileHandler(this.mockData, path, content)
    }

    async getDirectoryHandle(foldername: string, {create} : {create:boolean}) {
        let path = this.id != "" ? this.id+'/'+foldername : foldername
        !this.mockData[this.id] && (this.mockData[this.id] = { files:{}, folders:[]})
        this.mockData[this.id].folders = [...this.mockData[this.id].folders, path] 
        this.mockData[path] = {files:{}, folders:[]}
        return new MockFolderHandler(this.mockData, path)
    }

    async removeEntry(name: string, {recursive} : {recursive?:boolean} = {} ) {
        let id = this.id != "" ? this.id + "/" + name : name
        
        if (this.mockData[this.id].folders.includes(id))
            this.mockData[this.id].folders = this.mockData[this.name].folders.filter( f => f!=id)
        if (this.mockData[this.id].files[id] != undefined)
            delete this.mockData[this.id].files[id]
        return this.mockData[this.id]
    }
}
