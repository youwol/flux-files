import { instantiateModules, MockEnvironment, ModuleError, parseGraph, Runner,  } from "@youwol/flux-core"
import { ModuleFilePicker } from "../lib/file-picker.module"
import { ModuleLocalDrive } from "../lib/local-drive.module"
import { ModuleReader } from "../lib/reader.module"
import { MockFolderHandler } from "./mock-folder-handler"


let environment = new MockEnvironment({
    console: {
        log: () => {},
        error: (...args) => { console.error(args)},
        warn: (...args) => { console.warn(args)}
    }
})

export let mockData = {
    "":{
        files:{
            "fileText": new Blob(["text content"]),
            "fileJson": new Blob([JSON.stringify({value:"json content"})]),
            "fileJavascript": new Blob(["return () => 4"]),
            "fileJavascriptError": new Blob(["return ( :> 4"]),
        },
        folders:[
        ]
    }
}

window['showDirectoryPicker'] = () => {
    return new Promise(cb => cb(new MockFolderHandler(mockData)))
}

function createWorkflow({fileId, mode}){

    let branches = [
        '-|~localDrive~|---|~filePicker~|---|~reader~|-'
    ] 
    let modules     : {
        localDrive: ModuleLocalDrive.Module,
        filePicker: ModuleFilePicker.Module,
        reader:     ModuleReader.Module
    } = instantiateModules({
        localDrive: ModuleLocalDrive,
        filePicker: [ModuleFilePicker, {fileId}],
        reader: [ModuleReader, {mode}]
    },{environment}) 
    let graph       = parseGraph( { branches, modules } )
    return {graph, modules}
}

test('reader text OK', (done) => {
    
    let {graph, modules}       = createWorkflow({fileId: 'fileText', mode:ModuleReader.Mode.TEXT})
    
    new Runner( graph )
    document.querySelectorAll('button').item(0).dispatchEvent(new MouseEvent('click'))

    modules.reader.content$.pipe(
    ).subscribe( ({data}) => {
        expect(data.content).toEqual("text content")
        done()
    })
})

test('reader json OK', (done) => {
    
    let {graph, modules}       = createWorkflow({fileId: 'fileJson', mode:ModuleReader.Mode.JSON})
    
    new Runner( graph )
    document.querySelectorAll('button').item(0).dispatchEvent(new MouseEvent('click'))

    modules.reader.content$.pipe(
    ).subscribe( ({data}) => {
        expect(data.content).toEqual({value:"json content"})
        done()
    })
})

test('reader json error', (done) => {
    
    let {graph, modules}       = createWorkflow({fileId: 'fileText', mode:ModuleReader.Mode.JSON})
    
    new Runner( graph )
    document.querySelectorAll('button').item(0).dispatchEvent(new MouseEvent('click'))

    environment.errors$.subscribe(
        (message) => {
            expect(message.error).toBeInstanceOf(ModuleError)
            done()
    })
})



test('reader javascript OK', (done) => {
    
    let {graph, modules}       = createWorkflow({fileId: 'fileJavascript', mode:ModuleReader.Mode.JAVASCRIPT})
    
    new Runner( graph )
    document.querySelectorAll('button').item(0).dispatchEvent(new MouseEvent('click'))

    modules.reader.content$.pipe(
    ).subscribe( ({data}) => {
        expect(data.content()).toEqual(4)
        done()
    })
})

test('reader javascript parse error', (done) => {
    
    let {graph, modules}       = createWorkflow({fileId: 'fileJavascriptError', mode:ModuleReader.Mode.JAVASCRIPT})
    
    new Runner( graph )
    document.querySelectorAll('button').item(0).dispatchEvent(new MouseEvent('click'))

    environment.errors$.subscribe(
        (message) => {
            expect(message.error).toBeInstanceOf(ModuleError)
            done()
    })
})