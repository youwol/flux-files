import { instantiateModules, ModuleError, parseGraph, Runner,  } from "@youwol/flux-core"
import { mergeMap, tap } from "rxjs/operators"
import { ModuleFilePicker } from "../lib/file-picker.module"
import { Interfaces } from "../lib/implementation/interfaces"
import { LocalDrive } from "../lib/implementation/local-drive"
import { ModuleLocalDrive } from "../lib/local-drive.module"
import { MockFolderHandler } from "./mock-folder-handler"


export let mockData = {
    "":{
        files:{
            "fileText": new Blob(["text content"]),
            "fileJson": new Blob([JSON.stringify({content:"text content"})]),
            "fileBytes": new Blob([new Float32Array([0,1,2,3,4])]),
        },
        folders:[
        ]
    }
}

window['showDirectoryPicker'] = () => {
    return new Promise(cb => cb(new MockFolderHandler(mockData)))
}

function createWorkflow({fileId}){

    let branches = [
        '-|~localDrive~|---|~filePicker~|--'
    ] 
    let modules     : {
        localDrive: ModuleLocalDrive.Module,
        filePicker: ModuleFilePicker.Module
    } = instantiateModules({
        localDrive: ModuleLocalDrive,
        filePicker: [ModuleFilePicker, {fileId}]
    }) 
    let graph       = parseGraph( { branches, modules } )
    return {graph, modules}
}

test('picker OK', (done) => {
    
    let {graph, modules}       = createWorkflow({fileId: 'fileText'})
    
    new Runner( graph )
    let modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
    expect(modalDiv).toBeDefined()
    let buttons = modalDiv.querySelectorAll('button')
    let okBttn = buttons.item(0)
    okBttn.dispatchEvent(new MouseEvent('click'))

    modules.localDrive.drive$.subscribe( (drive) => {
        expect(drive.data).toBeInstanceOf(LocalDrive)
        let modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
        expect(modalDiv).toBeNull()
    })

    modules.filePicker.file$.pipe(
        tap(( {data}: {data: Interfaces.File}) => {
            expect(data.id).toEqual('fileText')
        }),
        mergeMap( ({data}: {data: Interfaces.File}) => {
            return data.readAsText()
        })
    ).subscribe( (content) => {
        expect(content).toEqual("text content")
        done()
    })
})


test('picker Error', (done) => {
    
    let {graph, modules}       = createWorkflow({fileId: 'noFile'})
    
    new Runner( graph )
    let modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
    expect(modalDiv).toBeDefined()
    let buttons = modalDiv.querySelectorAll('button')
    let okBttn = buttons.item(0)
    okBttn.dispatchEvent(new MouseEvent('click'))

    modules.localDrive.drive$.subscribe( (drive) => {
        expect(drive.data).toBeInstanceOf(LocalDrive)
        let modalDiv = document.getElementById("yw-flux-files-local-drive-modal")
        expect(modalDiv).toBeNull()
    })

    modules.filePicker.notifier$.subscribe(
        (message) => {
            expect(message).toBeInstanceOf(ModuleError)
            done()
    })     
})

