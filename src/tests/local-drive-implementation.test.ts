import { from } from "rxjs";
import { mergeMap, tap } from "rxjs/operators";
import { LocalDrive, LocalFile, LocalFolder } from "../lib/implementation/local-drive"
import {Interfaces} from '../lib/implementation/interfaces'

import {MockFolderHandler} from './mock-folder-handler'


console.log = () =>{}

let driveName = 'local-drive'

function getMockData(){
    return {
        '':{
            files:{
                [`file0`]: new Blob(["text content of file0"])
            },
            folders:[
                `folderA`
            ]
        },
        'folderA':{
            files:{},
            folders:[]
        }
    }
}

test('getFolderOrCreate', (done) =>{
    let mock = new MockFolderHandler(getMockData())
    let drive = new LocalDrive('', driveName, mock)
    Interfaces.getFolderOrCreateRec(drive, ['tata','toto']).pipe(
        tap( (response) => {
            expect(response.created).toBeTruthy()
            expect(mock.getData()['tata']).toBeDefined()
            expect(mock.getData()['tata'].folders).toEqual(['tata/toto'])
            expect(mock.getData()['tata/toto']).toBeDefined()
        }),
        mergeMap( () => Interfaces.getFolderOrCreateRec(drive, ['tata'])),
        tap( (response) => expect(response.created).toBeFalsy()),
        mergeMap( () => Interfaces.getFolderOrCreateRec(drive, ['tata','toto', 'tutu']))
        ).subscribe(
        (response) => {
            expect(response.created).toBeTruthy()
            expect(mock.getData()['tata/toto']).toBeDefined()
            expect(mock.getData()['tata/toto'].folders).toEqual(['tata/toto/tutu'])
            expect(mock.getData()['tata/toto/tutu']).toBeDefined()
            done()
        }
    )
})


test('read', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(getMockData()))

    drive.blob('file0').pipe(
        mergeMap( (blob:Blob) => 
            from(new Promise( (cb) => {
                var reader = new FileReader();
                reader.onload = () => cb(reader.result)
                reader.readAsText(blob);
            })) 
        )
    )
    .subscribe( (content: string) => {
        expect(content).toEqual("text content of file0")
        done()
    })
})

test('listItems drive', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(getMockData()))

    drive.listItems('')
    .subscribe( ({folders, files}: {files: Array<LocalFile> , folders: Array<LocalFolder>}) => {
        expect(files.length).toEqual(1)
        expect(files[0].id).toEqual("file0")
        expect(folders.length).toEqual(1)
        expect(folders[0].id).toEqual("folderA")

        done()
    })
})

test('listItems folder', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(getMockData()))

    drive.getFolder('folderA').pipe(
        mergeMap( (folder: LocalFolder) => {
            return folder.listItems()
        })
    )
    .subscribe( ({folders, files}: {files: Array<LocalFile> , folders: Array<LocalFolder>}) => {
        expect(files.length).toEqual(0)
        expect(folders.length).toEqual(0)

        done()
    })
})

test('getFolder', (done) => {
    
    let drive = new LocalDrive("", 'local-drive', new MockFolderHandler(getMockData()))

    drive.getFolder('folderA')
    .subscribe( (folder: LocalFolder) => {
        expect(folder.id).toEqual("folderA")
        done()
    })
})


test('create/delete/get file', (done) => {
    let handler = new MockFolderHandler(getMockData())
    let drive = new LocalDrive("", 'local-drive', handler)
    let finished = false
    drive.createFile('folderA', "fileA0", new Blob(["text content of fileA0"])).pipe(
        tap((file: LocalFile) => {
            expect(file.id).toEqual("folderA/fileA0")
            expect(file.name).toEqual("fileA0")
            expect(file.parentFolderId).toEqual("folderA")
            expect(file.drive).toEqual(drive)
            let d = handler.getData()
            expect(handler.getData()['folderA'].files['folderA/fileA0']).toBeDefined()
        }),
        mergeMap( (file: LocalFile) => drive.deleteFile(file.id)),
        tap( () => {
            expect(handler.getData()['folderA'].files['folderA/fileA0']).toBeUndefined()
            finished = true
        }),
        mergeMap( () => {
           return drive.getFile('folderA/fileA0')
        })
    )
    .subscribe( 
        (resp) => {},
        (error) => { 
            finished && done()
        }
    )
})

test('create/delete/get folder', (done) => {
    let handler = new MockFolderHandler(getMockData())
    let drive = new LocalDrive("", 'local-drive', handler)
    let finished = false

    drive.createFolder('folderA', "folderB" ).pipe(
        tap((folder: LocalFolder) => {
            expect(folder.id).toEqual("folderA/folderB")
            expect(folder.name).toEqual("folderB")
            expect(folder.parentFolderId).toEqual("folderA")
            expect(folder.drive).toEqual(drive)
            expect(handler.getData()['folderA'].folders.includes('folderA/folderB')).toBeTruthy()
        }),
        mergeMap( (folder: LocalFolder) => drive.deleteFolder(folder.id)),
        tap( (resp) => {
            expect(resp.folders.includes('folderA/folderB')).toBeFalsy()
            finished = true
        }),
        mergeMap( () => drive.getFolder('folderA/folderB'))
    )
    .subscribe( 
        (resp) => {},
        (error) => { 
            finished && done()
            if(!finished) 
                throw error
        }        
    )
})

test('rename file', (done) => {
    let handler = new MockFolderHandler(getMockData())
    let drive = new LocalDrive("", 'local-drive', handler)
    let finished = false

    drive.getFile("file0" ).pipe(
        mergeMap( (file: LocalFile) => drive.renameItem(file, "new_file0")),
        tap( (file: LocalFile) => {
            expect(file.id).toEqual("/new_file0")
            expect(file.name).toEqual("new_file0")
            expect(file.parentFolderId).toEqual("")
            let d = handler.getData()
            expect(handler.getData()[''].files['new_file0']).toBeTruthy()
        }),
        mergeMap( () => {
            return drive.readAsText('new_file0')
        }),
        tap( (content: string) => expect(content).toEqual("text content of file0") ),
        mergeMap( () => {
            finished = true
            return drive.getFile('file0')
        }),
    )
    .subscribe( 
        () => {},
        (error) => { 
            finished && done()
            if(!finished) 
                throw error
        })
})


test('rename folder', (done) => {
    // Rename folder not available for now
    let handler = new MockFolderHandler(getMockData())
    let drive = new LocalDrive("", 'local-drive', handler)
    let finished = false

    drive.getFolder("folderA" ).pipe(
        mergeMap( (folder: LocalFolder) => {
            finished = true
            return drive.renameItem(folder, "new_folderA")
        })
    )
    .subscribe( 
        () => {},
        (error) => { 
            finished && done()
            if(!finished) 
                throw error
        })
})

